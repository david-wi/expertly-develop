"""Voice call flow orchestration.

Manages the lifecycle of a voice-based intake session: starting the call,
authenticating the caller via intake code, stepping through questions,
storing answers, and ending the session with a summary.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from ..core.database import get_collection
from ..core.security import verify_intake_code


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------

def _sessions():
    return get_collection("sessions")


def _session_participants():
    return get_collection("session_participants")


def _transcripts():
    return get_collection("transcripts")


def _transcript_segments():
    return get_collection("transcript_segments")


def _evidence_items():
    return get_collection("evidence_items")


def _answer_revisions():
    return get_collection("answer_revisions")


def _current_answers():
    return get_collection("current_answers")


def _question_instances():
    return get_collection("intake_question_instances")


def _section_instances():
    return get_collection("intake_section_instances")


def _intakes():
    return get_collection("intakes")


def _usage_ledger():
    return get_collection("usage_ledger")


def _follow_up_plans():
    return get_collection("follow_up_plans")


def _template_questions():
    return get_collection("template_questions")


def _template_sections():
    return get_collection("template_sections")


# ---------------------------------------------------------------------------
# Call lifecycle
# ---------------------------------------------------------------------------

async def start_call(
    intake_id: str,
    *,
    caller_phone: Optional[str] = None,
    caller_name: Optional[str] = None,
    voice_profile_id: Optional[str] = None,
) -> dict:
    """Create a new voice session and return an initial prompt.

    Returns:
        A dict with ``sessionId`` and ``initialPrompt`` (the greeting /
        first instruction to read to the caller).
    """
    now = datetime.now(timezone.utc)

    session_doc: dict[str, Any] = {
        "intakeId": intake_id,
        "sessionType": "voice_call",
        "status": "in_progress",
        "voiceProfileId": voice_profile_id,
        "startedAt": now,
        "endedAt": None,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await _sessions().insert_one(session_doc)
    session_id = str(result.inserted_id)

    # Record participant
    if caller_phone or caller_name:
        await _session_participants().insert_one({
            "sessionId": session_id,
            "phone": caller_phone,
            "name": caller_name,
            "role": "caller",
            "joinedAt": now,
        })

    # Create a transcript container for this session
    await _transcripts().insert_one({
        "sessionId": session_id,
        "createdAt": now,
        "updatedAt": now,
    })

    # Fetch intake title for the greeting
    intake = await _intakes().find_one({"_id": ObjectId(intake_id)})
    title = intake.get("title", "your intake") if intake else "your intake"

    initial_prompt = (
        f"Hello! Thank you for calling about {title}. "
        "Before we begin, could you please provide your intake code so I "
        "can pull up the right information?"
    )

    return {
        "sessionId": session_id,
        "initialPrompt": initial_prompt,
    }


async def authenticate_call(
    session_id: str,
    plain_code: str,
) -> dict:
    """Verify the caller's intake code and load context.

    Returns:
        A dict with ``authenticated`` (bool), ``intakeId``, and
        ``intakeContext`` (summary of what the intake is about).

    Raises:
        ValueError: When the code does not match.
    """
    session = await _sessions().find_one({"_id": ObjectId(session_id)})
    if not session:
        raise ValueError("Session not found")

    intake_id = session["intakeId"]
    intake = await _intakes().find_one({"_id": ObjectId(intake_id)})
    if not intake:
        raise ValueError("Intake not found")

    if not verify_intake_code(plain_code, intake.get("intakeCodeHash", "")):
        return {
            "authenticated": False,
            "intakeId": intake_id,
            "intakeContext": None,
        }

    # Build a lightweight context dict for the voice agent
    context: dict[str, Any] = {
        "title": intake.get("title", ""),
        "description": intake.get("description", ""),
        "status": intake.get("intakeStatus", ""),
    }

    return {
        "authenticated": True,
        "intakeId": intake_id,
        "intakeContext": context,
    }


# ---------------------------------------------------------------------------
# Question navigation
# ---------------------------------------------------------------------------

async def get_next_step(
    intake_id: str,
    *,
    current_section_instance_id: Optional[str] = None,
    current_question_instance_id: Optional[str] = None,
) -> dict:
    """Determine the next question to ask based on progress.

    Strategy:
    1. If a current section is provided, look for the next unanswered
       question in that section.
    2. If the current section is complete, move to the next section with
       unanswered questions.
    3. If all questions are handled, return ``done=True``.

    Returns:
        A dict with ``done``, ``sectionInstanceId``,
        ``questionInstanceId``, ``questionText``, and ``questionType``.
    """
    # Gather all section instances in order
    section_instances = await _section_instances().find(
        {"intakeId": intake_id}
    ).to_list(length=None)

    if not section_instances:
        return {"done": True, "sectionInstanceId": None, "questionInstanceId": None}

    # Resolve section ordering by template section order
    section_order_map: dict[str, int] = {}
    for si in section_instances:
        ts = await _template_sections().find_one(
            {"_id": ObjectId(si["templateSectionId"])}
        )
        section_order_map[str(si["_id"])] = ts.get("sectionOrder", 0) if ts else 0

    section_instances.sort(key=lambda s: section_order_map.get(str(s["_id"]), 0))

    # If a current section is specified, start searching from there
    start_idx = 0
    if current_section_instance_id:
        for idx, si in enumerate(section_instances):
            if str(si["_id"]) == current_section_instance_id:
                start_idx = idx
                break

    # Search through sections starting from start_idx, then wrapping
    ordered = section_instances[start_idx:] + section_instances[:start_idx]

    for si in ordered:
        si_id = str(si["_id"])
        # Find the first question that is unanswered or marked "later"
        question = await _question_instances().find_one(
            {
                "intakeSectionInstanceId": si_id,
                "questionStatus": {"$in": ["unanswered", "later"]},
            },
            sort=[("_id", 1)],  # deterministic ordering
        )
        if question:
            # Fetch the template question for text/type
            tq = await _template_questions().find_one(
                {"_id": ObjectId(question["templateQuestionId"])}
            )
            return {
                "done": False,
                "sectionInstanceId": si_id,
                "questionInstanceId": str(question["_id"]),
                "templateQuestionId": question["templateQuestionId"],
                "questionText": tq.get("questionText", "") if tq else "",
                "questionType": tq.get("questionType", "text") if tq else "text",
                "questionKey": tq.get("questionKey", "") if tq else "",
            }

    return {"done": True, "sectionInstanceId": None, "questionInstanceId": None}


# ---------------------------------------------------------------------------
# Answer processing
# ---------------------------------------------------------------------------

async def process_answer(
    session_id: str,
    question_instance_id: str,
    answer_value: Any,
    *,
    transcript_text: Optional[str] = None,
    start_ms: Optional[int] = None,
    end_ms: Optional[int] = None,
    source: str = "voice",
    contributor_id: Optional[str] = None,
) -> dict:
    """Process a caller's answer to a question.

    Steps:
    1. Store transcript segment (if transcript text provided).
    2. Create evidence item linking segment to the question.
    3. Create answer revision.
    4. Set as current answer.
    5. Update question status to ``answered``.

    Returns:
        Dict with ``answerRevisionId`` and ``currentAnswerId``.
    """
    now = datetime.now(timezone.utc)

    # 1. Transcript segment
    segment_id: Optional[str] = None
    if transcript_text:
        transcript = await _transcripts().find_one({"sessionId": session_id})
        if transcript:
            seg_result = await _transcript_segments().insert_one({
                "transcriptId": str(transcript["_id"]),
                "speaker": "caller",
                "text": transcript_text,
                "startMs": start_ms,
                "endMs": end_ms,
                "createdAt": now,
            })
            segment_id = str(seg_result.inserted_id)

    # 2. Evidence item
    qi = await _question_instances().find_one({"_id": ObjectId(question_instance_id)})
    intake_id = None
    if qi:
        si = await _section_instances().find_one(
            {"_id": ObjectId(qi["intakeSectionInstanceId"])}
        )
        intake_id = si["intakeId"] if si else None

    evidence_id: Optional[str] = None
    if intake_id:
        ev_result = await _evidence_items().insert_one({
            "intakeId": intake_id,
            "sessionId": session_id,
            "questionInstanceId": question_instance_id,
            "transcriptSegmentId": segment_id,
            "evidenceType": "voice_transcript",
            "content": transcript_text or str(answer_value),
            "createdAt": now,
        })
        evidence_id = str(ev_result.inserted_id)

    # 3. Answer revision
    revision_doc = {
        "intakeQuestionInstanceId": question_instance_id,
        "answerValue": answer_value,
        "source": source,
        "contributorId": contributor_id,
        "evidenceId": evidence_id,
        "createdAt": now,
    }
    rev_result = await _answer_revisions().insert_one(revision_doc)
    revision_id = str(rev_result.inserted_id)

    # 4. Upsert current answer
    current_doc = {
        "intakeQuestionInstanceId": question_instance_id,
        "answerRevisionId": revision_id,
        "answerValue": answer_value,
        "updatedAt": now,
    }
    await _current_answers().update_one(
        {"intakeQuestionInstanceId": question_instance_id},
        {"$set": current_doc},
        upsert=True,
    )
    current = await _current_answers().find_one(
        {"intakeQuestionInstanceId": question_instance_id}
    )
    current_id = str(current["_id"]) if current else None

    # 5. Mark question as answered
    await _question_instances().update_one(
        {"_id": ObjectId(question_instance_id)},
        {"$set": {"questionStatus": "answered", "updatedAt": now}},
    )

    return {
        "answerRevisionId": revision_id,
        "currentAnswerId": current_id,
    }


# ---------------------------------------------------------------------------
# End call
# ---------------------------------------------------------------------------

async def end_call(
    session_id: str,
    *,
    create_follow_up: bool = False,
    follow_up_notes: Optional[str] = None,
    next_contact_at: Optional[datetime] = None,
) -> dict:
    """Finalize a voice session.

    1. Mark session as ``completed``.
    2. Create usage ledger entries.
    3. Optionally create a follow-up plan.
    4. Generate a call summary.

    Returns:
        Dict with ``summary`` and optional ``followUpPlanId``.
    """
    now = datetime.now(timezone.utc)

    session = await _sessions().find_one({"_id": ObjectId(session_id)})
    if not session:
        raise ValueError("Session not found")

    intake_id = session["intakeId"]

    # 1. Close session
    await _sessions().update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "completed", "endedAt": now, "updatedAt": now}},
    )

    # 2. Usage ledger: record call duration
    started_at = session.get("startedAt", now)
    duration_seconds = int((now - started_at).total_seconds())
    await _usage_ledger().insert_one({
        "intakeId": intake_id,
        "sessionId": session_id,
        "usageType": "voice_call",
        "quantity": duration_seconds,
        "unit": "seconds",
        "recordedAt": now,
    })

    # Count segments for transcript usage
    transcript = await _transcripts().find_one({"sessionId": session_id})
    segment_count = 0
    if transcript:
        segment_count = await _transcript_segments().count_documents(
            {"transcriptId": str(transcript["_id"])}
        )
        await _usage_ledger().insert_one({
            "intakeId": intake_id,
            "sessionId": session_id,
            "usageType": "transcript_segments",
            "quantity": segment_count,
            "unit": "segments",
            "recordedAt": now,
        })

    # 3. Follow-up plan (optional)
    follow_up_plan_id: Optional[str] = None
    if create_follow_up:
        fp_result = await _follow_up_plans().insert_one({
            "intakeId": intake_id,
            "sessionId": session_id,
            "status": "pending",
            "notes": follow_up_notes or "",
            "nextContactAt": next_contact_at,
            "createdAt": now,
            "updatedAt": now,
        })
        follow_up_plan_id = str(fp_result.inserted_id)

    # 4. Generate summary
    summary = await generate_summary(session_id)

    return {
        "sessionId": session_id,
        "durationSeconds": duration_seconds,
        "segmentCount": segment_count,
        "followUpPlanId": follow_up_plan_id,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Summary generation
# ---------------------------------------------------------------------------

async def generate_summary(session_id: str) -> str:
    """Create a human-readable summary of what was covered in the call.

    Collects all transcript segments, groups by question, and produces a
    short narrative.
    """
    session = await _sessions().find_one({"_id": ObjectId(session_id)})
    if not session:
        return "Session not found."

    intake_id = session["intakeId"]
    intake = await _intakes().find_one({"_id": ObjectId(intake_id)})
    title = intake.get("title", "Unknown Intake") if intake else "Unknown Intake"

    # Gather transcript segments
    transcript = await _transcripts().find_one({"sessionId": session_id})
    segments: list[dict] = []
    if transcript:
        segments = await _transcript_segments().find(
            {"transcriptId": str(transcript["_id"])}
        ).sort("startMs", 1).to_list(length=None)

    # Gather answers created in this session via evidence
    evidence_items = await _evidence_items().find(
        {"sessionId": session_id}
    ).to_list(length=None)

    answered_question_ids = {
        e["questionInstanceId"]
        for e in evidence_items
        if "questionInstanceId" in e
    }

    started = session.get("startedAt")
    ended = session.get("endedAt") or datetime.now(timezone.utc)
    duration_min = int((ended - started).total_seconds() / 60) if started else 0

    lines = [
        f"Call Summary for '{title}'",
        f"Duration: {duration_min} minute(s)",
        f"Transcript segments: {len(segments)}",
        f"Questions addressed: {len(answered_question_ids)}",
    ]

    if segments:
        lines.append("")
        lines.append("Key points:")
        # Take the first few segments as highlights
        for seg in segments[:10]:
            speaker = seg.get("speaker", "unknown")
            text = seg.get("text", "")
            if text:
                lines.append(f"  [{speaker}] {text[:200]}")
        if len(segments) > 10:
            lines.append(f"  ... and {len(segments) - 10} more segment(s)")

    return "\n".join(lines)
