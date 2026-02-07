"""Voice call / VAPI integration routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user, verify_intake_code
from app.schemas.voice_call import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    AuthenticateRequest,
    AuthenticateResponse,
    CallEndRequest,
    CallEndResponse,
    CallStartRequest,
    CallStartResponse,
    NextStepRequest,
    NextStepResponse,
)
from app.schemas.session import SessionStatus
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /voice/calls/start
# ---------------------------------------------------------------------------

@router.post(
    "/voice/calls/start",
    response_model=ResponseEnvelope[CallStartResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Start a voice call session",
)
async def start_call(
    body: CallStartRequest,
):
    """Create a new voice call session and return an initial prompt.

    This endpoint does not require authentication -- it is called by the
    telephony provider when a call is initiated.
    """
    sessions_col = get_collection("sessions")

    now = datetime.now(timezone.utc)

    session_doc = {
        "intakeId": None,  # Set after authentication
        "accountId": None,
        "sessionType": "phoneCall",
        "status": SessionStatus.ACTIVE.value,
        "externalProviderId": body.external_call_id,
        "callerPhone": body.from_phone,
        "calledPhone": body.to_phone,
        "startedAt": now,
        "endedAt": None,
        "durationSeconds": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await sessions_col.insert_one(session_doc)
    session_id = str(result.inserted_id)

    initial_prompt = (
        "Thank you for calling. To get started, please provide your "
        "intake code. It is a six-character code that was provided to you."
    )

    return ResponseEnvelope(
        data=CallStartResponse(
            sessionId=session_id,
            initialPrompt=initial_prompt,
        )
    )


# ---------------------------------------------------------------------------
# POST /voice/calls/{sessionId}/authenticate
# ---------------------------------------------------------------------------

@router.post(
    "/voice/calls/{sessionId}/authenticate",
    response_model=ResponseEnvelope[AuthenticateResponse],
    summary="Authenticate caller with intake code and PIN",
)
async def authenticate_caller(
    sessionId: str,
    body: AuthenticateRequest,
):
    """Verify intake code and PIN, load context for the call."""
    sessions_col = get_collection("sessions")
    intakes_col = get_collection("intakes")
    contributors_col = get_collection("intake_contributors")

    session = await sessions_col.find_one({"_id": ObjectId(sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Find intake by code
    intake = None
    async for doc in intakes_col.find({"intakeCodeHash": {"$exists": True}}):
        if verify_intake_code(body.intake_code, doc.get("intakeCodeHash", "")):
            intake = doc
            break

    if not intake:
        raise HTTPException(status_code=401, detail="Invalid intake code")

    intake_id = str(intake["_id"])

    # Verify PIN and find contributor
    contributor = None
    async for c_doc in contributors_col.find({"intakeId": intake_id}):
        if c_doc.get("pin") == body.pin:
            contributor = c_doc
            break

    if not contributor:
        raise HTTPException(status_code=401, detail="Invalid PIN")

    contributor_id = str(contributor["_id"])

    # Link session to intake
    now = datetime.now(timezone.utc)
    await sessions_col.update_one(
        {"_id": ObjectId(sessionId)},
        {
            "$set": {
                "intakeId": intake_id,
                "accountId": intake["accountId"],
                "contributorId": contributor_id,
                "authenticatedAt": now,
                "updatedAt": now,
            }
        },
    )

    next_prompt = (
        f"Great, welcome! I have your intake for "
        f"{intake.get('intakeName', 'your case')}. "
        f"Let me ask you some questions."
    )

    return ResponseEnvelope(
        data=AuthenticateResponse(
            intakeId=intake_id,
            intakeName=intake.get("intakeName", ""),
            contributorId=contributor_id,
            nextPrompt=next_prompt,
        )
    )


# ---------------------------------------------------------------------------
# POST /voice/calls/{sessionId}/next
# ---------------------------------------------------------------------------

@router.post(
    "/voice/calls/{sessionId}/next",
    response_model=ResponseEnvelope[NextStepResponse],
    summary="Determine next question or action",
)
async def next_step(
    sessionId: str,
    body: NextStepRequest,
):
    """Determine the next question for the voice agent to ask."""
    sessions_col = get_collection("sessions")
    question_instances_col = get_collection("intake_question_instances")
    section_instances_col = get_collection("intake_section_instances")

    session = await sessions_col.find_one({"_id": ObjectId(sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    intake_id = session.get("intakeId")
    if not intake_id:
        raise HTTPException(
            status_code=400, detail="Session not authenticated to an intake"
        )

    # Find the next unanswered question
    # If a section_choice is provided, limit to that section
    query: dict = {"intakeId": intake_id, "status": "unanswered"}

    if body.section_choice:
        query["intakeSectionInstanceId"] = body.section_choice

    next_question = await question_instances_col.find_one(
        query,
        sort=[("questionOrder", 1)],
    )

    if not next_question:
        # All questions answered
        return ResponseEnvelope(
            data=NextStepResponse(
                say="All questions have been answered. Thank you for your time!",
                isEndOfIntake=True,
            )
        )

    # Get section info
    section = await section_instances_col.find_one(
        {"_id": ObjectId(next_question["intakeSectionInstanceId"])}
    )
    section_name = section["sectionName"] if section else ""

    # Check if this is the last question in the section
    remaining_in_section = await question_instances_col.count_documents(
        {
            "intakeSectionInstanceId": next_question["intakeSectionInstanceId"],
            "status": "unanswered",
        }
    )

    say = next_question.get("questionText", "")
    if next_question.get("questionHelpText"):
        say += f" ({next_question['questionHelpText']})"

    return ResponseEnvelope(
        data=NextStepResponse(
            say=say,
            expectedAnswerType=next_question.get("answerType"),
            intakeQuestionInstanceId=str(next_question["_id"]),
            isEndOfSection=(remaining_in_section <= 1),
            isEndOfIntake=False,
        )
    )


# ---------------------------------------------------------------------------
# POST /voice/calls/{sessionId}/answer
# ---------------------------------------------------------------------------

@router.post(
    "/voice/calls/{sessionId}/answer",
    response_model=ResponseEnvelope[AnswerSubmitResponse],
    summary="Process an answer from a voice call",
)
async def submit_answer(
    sessionId: str,
    body: AnswerSubmitRequest,
):
    """Process a caller's answer: store transcript, evidence, and revision."""
    sessions_col = get_collection("sessions")
    revisions_col = get_collection("answer_revisions")
    current_answers_col = get_collection("current_answers")
    evidence_col = get_collection("evidence_items")
    question_instances_col = get_collection("intake_question_instances")

    session = await sessions_col.find_one({"_id": ObjectId(sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    intake_id = session.get("intakeId")
    if not intake_id:
        raise HTTPException(status_code=400, detail="Session not authenticated")

    now = datetime.now(timezone.utc)
    question_instance_id = body.intake_question_instance_id

    # Create evidence item from transcript
    evidence_doc = {
        "intakeId": intake_id,
        "sessionId": sessionId,
        "evidenceType": "transcriptExcerpt",
        "excerptText": body.raw_utterance_text,
        "startMs": (
            body.transcript_segment.start_ms if body.transcript_segment else None
        ),
        "endMs": (
            body.transcript_segment.end_ms if body.transcript_segment else None
        ),
        "createdAt": now,
        "updatedAt": now,
    }
    evidence_result = await evidence_col.insert_one(evidence_doc)
    evidence_id = str(evidence_result.inserted_id)

    # Create answer revision
    last_revision = await revisions_col.find_one(
        {
            "intakeId": intake_id,
            "intakeQuestionInstanceId": question_instance_id,
        },
        sort=[("revisionNumber", -1)],
    )
    next_revision = (last_revision["revisionNumber"] + 1) if last_revision else 1

    # Parse the answer (placeholder -- raw utterance is used directly)
    parsed_answer = body.raw_utterance_text

    revision_doc = {
        "intakeId": intake_id,
        "intakeQuestionInstanceId": question_instance_id,
        "revisionNumber": next_revision,
        "revisionType": "proposedFromCall",
        "answerText": parsed_answer,
        "answerStructuredData": None,
        "confidenceScore": None,
        "sourceSessionId": sessionId,
        "sourceEvidenceItemId": evidence_id,
        "isCurrent": True,
        "createdBy": session.get("contributorId"),
        "createdAt": now,
    }

    revision_result = await revisions_col.insert_one(revision_doc)
    revision_id = str(revision_result.inserted_id)

    # Mark previous revisions as not current
    await revisions_col.update_many(
        {
            "intakeId": intake_id,
            "intakeQuestionInstanceId": question_instance_id,
            "_id": {"$ne": revision_result.inserted_id},
        },
        {"$set": {"isCurrent": False}},
    )

    # Update current answers
    await current_answers_col.update_one(
        {
            "intakeId": intake_id,
            "intakeQuestionInstanceId": question_instance_id,
        },
        {
            "$set": {
                "answerRevisionId": revision_id,
                "answerText": parsed_answer,
                "chosenBy": session.get("contributorId"),
                "chosenAt": now,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "intakeId": intake_id,
                "intakeQuestionInstanceId": question_instance_id,
                "createdAt": now,
            },
        },
        upsert=True,
    )

    # Update question instance status
    await question_instances_col.update_one(
        {"_id": ObjectId(question_instance_id)},
        {
            "$set": {
                "status": "answered",
                "currentAnswerRevisionId": revision_id,
                "currentAnswer": parsed_answer,
                "lastAnsweredAt": now,
                "updatedAt": now,
            },
        },
    )

    next_prompt = "Got it. Let me move on to the next question."

    return ResponseEnvelope(
        data=AnswerSubmitResponse(
            nextPrompt=next_prompt,
            answerRevisionId=revision_id,
            parsedAnswerText=parsed_answer,
            confidenceScore=None,
        )
    )


# ---------------------------------------------------------------------------
# POST /voice/calls/{sessionId}/end
# ---------------------------------------------------------------------------

@router.post(
    "/voice/calls/{sessionId}/end",
    response_model=ResponseEnvelope[CallEndResponse],
    summary="Finalize a voice call",
)
async def end_call(
    sessionId: str,
    body: CallEndRequest,
):
    """End a voice call session and produce a summary."""
    sessions_col = get_collection("sessions")
    revisions_col = get_collection("answer_revisions")
    follow_ups_col = get_collection("follow_ups")
    usage_col = get_collection("usage_ledger")
    transcripts_col = get_collection("transcripts")

    session = await sessions_col.find_one({"_id": ObjectId(sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    intake_id = session.get("intakeId")
    now = datetime.now(timezone.utc)

    # End the session
    await sessions_col.update_one(
        {"_id": ObjectId(sessionId)},
        {
            "$set": {
                "endedAt": now,
                "durationSeconds": body.duration_seconds,
                "status": SessionStatus.COMPLETED.value,
                "updatedAt": now,
            }
        },
    )

    # Create usage ledger entry for call seconds
    if body.duration_seconds > 0 and intake_id:
        await usage_col.insert_one(
            {
                "intakeId": intake_id,
                "accountId": session.get("accountId"),
                "sessionId": sessionId,
                "metricType": "callSeconds",
                "quantity": body.duration_seconds,
                "createdAt": now,
            }
        )

    # Store final transcript if provided
    if body.final_transcript and intake_id:
        await transcripts_col.update_one(
            {"sessionId": sessionId},
            {
                "$set": {
                    "transcriptText": body.final_transcript,
                    "updatedAt": now,
                },
                "$setOnInsert": {
                    "sessionId": sessionId,
                    "intakeId": intake_id,
                    "accountId": session.get("accountId"),
                    "createdAt": now,
                },
            },
            upsert=True,
        )

    # Count questions answered this session
    questions_answered = 0
    if intake_id:
        questions_answered = await revisions_col.count_documents(
            {"sourceSessionId": sessionId, "intakeId": intake_id}
        )

    # Create follow-up if requested
    follow_up_plan_id = None
    if body.wants_to_continue_later and intake_id:
        follow_up_doc = {
            "intakeId": intake_id,
            "accountId": session.get("accountId"),
            "createdFromSessionId": sessionId,
            "status": "scheduled",
            "nextContactAt": body.preferred_next_contact_at or now,
            "contactMethod": "phone",
            "contactPersonId": (
                body.preferred_next_contact_person
                or session.get("contributorId")
            ),
            "createdAt": now,
            "updatedAt": now,
        }
        fu_result = await follow_ups_col.insert_one(follow_up_doc)
        follow_up_plan_id = str(fu_result.inserted_id)

    summary = (
        f"Call completed. {questions_answered} question(s) answered "
        f"in {body.duration_seconds} seconds."
    )

    return ResponseEnvelope(
        data=CallEndResponse(
            summary=summary,
            questionsAnswered=questions_answered,
            followUpPlanId=follow_up_plan_id,
        )
    )
