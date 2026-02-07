"""Progress calculation service.

Provides detailed progress statistics at the intake, section, and question
level, plus a narrative summary of captured information.
"""

from typing import Any, Optional

from bson import ObjectId

from ..core.database import get_collection


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------

def _section_instances():
    return get_collection("intake_section_instances")


def _question_instances():
    return get_collection("intake_question_instances")


def _current_answers():
    return get_collection("current_answers")


def _template_sections():
    return get_collection("template_sections")


def _template_questions():
    return get_collection("template_questions")


# ---------------------------------------------------------------------------
# Question status constants
# ---------------------------------------------------------------------------

TERMINAL_STATUSES = {"answered", "skipped", "notApplicable"}
ALL_STATUSES = {"unanswered", "answered", "skipped", "later", "notApplicable"}


# ---------------------------------------------------------------------------
# Intake-level progress
# ---------------------------------------------------------------------------

async def get_intake_progress(intake_id: str) -> dict:
    """Return overall intake progress statistics.

    Returns:
        Dict with totalSections, completedSections, totalQuestions,
        question counts by status, percentComplete, and a per-section
        breakdown list.
    """
    section_instances = await _section_instances().find(
        {"intakeId": intake_id}
    ).to_list(length=None)

    if not section_instances:
        return {
            "intakeId": intake_id,
            "totalSections": 0,
            "completedSections": 0,
            "totalQuestions": 0,
            "answeredQuestions": 0,
            "skippedQuestions": 0,
            "laterQuestions": 0,
            "notApplicableQuestions": 0,
            "unansweredQuestions": 0,
            "percentComplete": 0.0,
            "sections": [],
        }

    # Resolve section ordering
    ordering: dict[str, int] = {}
    for si in section_instances:
        ts = await _template_sections().find_one(
            {"_id": ObjectId(si["templateSectionId"])}
        )
        ordering[str(si["_id"])] = ts.get("sectionOrder", 0) if ts else 0

    section_instances.sort(key=lambda s: ordering.get(str(s["_id"]), 0))

    totals: dict[str, int] = {
        "totalQuestions": 0,
        "answered": 0,
        "skipped": 0,
        "later": 0,
        "notApplicable": 0,
        "unanswered": 0,
    }
    completed_sections = 0
    section_summaries: list[dict] = []

    for si in section_instances:
        si_id = str(si["_id"])
        sec = await get_section_progress(si_id)
        section_summaries.append(sec)

        totals["totalQuestions"] += sec["totalQuestions"]
        totals["answered"] += sec["answeredQuestions"]
        totals["skipped"] += sec["skippedQuestions"]
        totals["later"] += sec["laterQuestions"]
        totals["notApplicable"] += sec["notApplicableQuestions"]
        totals["unanswered"] += sec["unansweredQuestions"]

        if sec["isComplete"]:
            completed_sections += 1

    total_q = totals["totalQuestions"]
    pct = (totals["answered"] / total_q * 100) if total_q > 0 else 0.0

    return {
        "intakeId": intake_id,
        "totalSections": len(section_instances),
        "completedSections": completed_sections,
        "totalQuestions": total_q,
        "answeredQuestions": totals["answered"],
        "skippedQuestions": totals["skipped"],
        "laterQuestions": totals["later"],
        "notApplicableQuestions": totals["notApplicable"],
        "unansweredQuestions": totals["unanswered"],
        "percentComplete": round(pct, 1),
        "sections": section_summaries,
    }


# ---------------------------------------------------------------------------
# Section-level progress
# ---------------------------------------------------------------------------

async def get_section_progress(section_instance_id: str) -> dict:
    """Return progress for a specific section instance.

    Returns:
        Dict with sectionInstanceId, templateSectionId, sectionName,
        question counts by status, and isComplete flag.
    """
    si = await _section_instances().find_one(
        {"_id": ObjectId(section_instance_id)}
    )
    template_section_id = si["templateSectionId"] if si else None
    section_name = ""
    if template_section_id:
        ts = await _template_sections().find_one(
            {"_id": ObjectId(template_section_id)}
        )
        section_name = ts.get("sectionName", "") if ts else ""

    counts = await get_question_status_counts(section_instance_id)
    total = sum(counts.values())
    terminal = counts["answered"] + counts["skipped"] + counts["notApplicable"]
    is_complete = (total > 0) and (terminal == total)

    return {
        "sectionInstanceId": section_instance_id,
        "templateSectionId": template_section_id,
        "sectionName": section_name,
        "totalQuestions": total,
        "answeredQuestions": counts["answered"],
        "skippedQuestions": counts["skipped"],
        "laterQuestions": counts["later"],
        "notApplicableQuestions": counts["notApplicable"],
        "unansweredQuestions": counts["unanswered"],
        "isComplete": is_complete,
    }


# ---------------------------------------------------------------------------
# Question status counts
# ---------------------------------------------------------------------------

async def get_question_status_counts(section_instance_id: str) -> dict[str, int]:
    """Count questions by status within a section instance.

    Returns:
        Dict mapping status name to count:
        ``unanswered``, ``answered``, ``skipped``, ``later``, ``notApplicable``.
    """
    questions = await _question_instances().find(
        {"intakeSectionInstanceId": section_instance_id}
    ).to_list(length=None)

    counts: dict[str, int] = {
        "unanswered": 0,
        "answered": 0,
        "skipped": 0,
        "later": 0,
        "notApplicable": 0,
    }
    for q in questions:
        status = q.get("questionStatus", "unanswered")
        if status in counts:
            counts[status] += 1
        else:
            counts["unanswered"] += 1

    return counts


# ---------------------------------------------------------------------------
# Narrative summary
# ---------------------------------------------------------------------------

async def generate_narrative_summary(section_instance_id: str) -> str:
    """Generate a short narrative of what has been captured for a section.

    Iterates over answered questions in the section, fetches the template
    question text and the current answer, and builds a readable paragraph.

    Returns:
        A human-readable string summarizing collected answers.
    """
    si = await _section_instances().find_one(
        {"_id": ObjectId(section_instance_id)}
    )
    if not si:
        return "Section not found."

    template_section_id = si.get("templateSectionId")
    section_name = ""
    if template_section_id:
        ts = await _template_sections().find_one(
            {"_id": ObjectId(template_section_id)}
        )
        section_name = ts.get("sectionName", "Unnamed Section") if ts else "Unnamed Section"

    questions = await _question_instances().find(
        {
            "intakeSectionInstanceId": section_instance_id,
            "questionStatus": "answered",
        }
    ).to_list(length=None)

    if not questions:
        return f"No answers have been captured yet for '{section_name}'."

    lines = [f"Summary for '{section_name}':"]

    for q in questions:
        # Get the question text
        tq = await _template_questions().find_one(
            {"_id": ObjectId(q["templateQuestionId"])}
        )
        q_text = tq.get("questionText", "Unknown question") if tq else "Unknown question"

        # Get current answer
        current = await _current_answers().find_one(
            {"intakeQuestionInstanceId": str(q["_id"])}
        )
        if current:
            answer_val = current.get("answerValue", "")
            # Truncate very long answers for the narrative
            answer_str = str(answer_val)
            if len(answer_str) > 300:
                answer_str = answer_str[:297] + "..."
            lines.append(f"- {q_text}: {answer_str}")

    counts = await get_question_status_counts(section_instance_id)
    total = sum(counts.values())
    lines.append("")
    lines.append(
        f"Progress: {counts['answered']}/{total} questions answered, "
        f"{counts['later']} deferred, {counts['skipped']} skipped, "
        f"{counts['unanswered']} remaining."
    )

    return "\n".join(lines)
