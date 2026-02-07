"""Core intake business logic.

Handles intake creation from templates, code management, and progress
calculation.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from ..config import settings
from ..core.database import get_collection
from ..core.security import generate_intake_code, hash_intake_code, verify_intake_code


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------

def _intakes():
    return get_collection("intakes")


def _section_instances():
    return get_collection("intake_section_instances")


def _question_instances():
    return get_collection("intake_question_instances")


def _template_sections():
    return get_collection("template_sections")


def _template_questions():
    return get_collection("template_questions")


def _current_answers():
    return get_collection("current_answers")


# ---------------------------------------------------------------------------
# Intake creation
# ---------------------------------------------------------------------------

async def create_intake(
    account_id: str,
    intake_type_id: str,
    template_version_id: str,
    title: str,
    created_by_user_id: str,
    *,
    description: str = "",
) -> dict:
    """Create a new intake instance from a published template version.

    1. Generates intake code (plain + hashed).
    2. Inserts the intake document.
    3. Instantiates all section and question instances from the template.

    Returns:
        The created intake document, including the plain intake code (which
        must be communicated to the contributor and is NOT stored in plain
        text after this call).
    """
    plain_code, hashed_code = generate_intake_code()
    now = datetime.now(timezone.utc)

    intake_doc: dict[str, Any] = {
        "accountId": account_id,
        "intakeTypeId": intake_type_id,
        "templateVersionId": template_version_id,
        "title": title,
        "description": description,
        "intakeStatus": "draft",
        "intakeCodeHash": hashed_code,
        "createdByUserId": created_by_user_id,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await _intakes().insert_one(intake_doc)
    intake_id = str(result.inserted_id)
    intake_doc["_id"] = result.inserted_id

    # Instantiate template sections and questions
    await instantiate_template(intake_id, template_version_id)

    # Return the doc with the plain code attached (one-time exposure)
    intake_doc["intakeCode"] = plain_code
    intake_doc["intakeId"] = intake_id
    return intake_doc


# ---------------------------------------------------------------------------
# Template instantiation
# ---------------------------------------------------------------------------

async def instantiate_template(
    intake_id: str,
    template_version_id: str,
) -> None:
    """Instantiate all sections and questions for an intake from a template version.

    For each ``template_section`` belonging to ``template_version_id`` (sorted
    by ``sectionOrder``), creates an ``intake_section_instance`` with
    ``repeatIndex=0``.  For each ``template_question`` within that section,
    creates an ``intake_question_instance``.
    """
    now = datetime.now(timezone.utc)

    sections_cursor = _template_sections().find(
        {"templateVersionId": template_version_id}
    ).sort("sectionOrder", 1)

    async for section in sections_cursor:
        section_instance_doc = {
            "intakeId": intake_id,
            "templateSectionId": str(section["_id"]),
            "repeatIndex": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        section_result = await _section_instances().insert_one(section_instance_doc)
        section_instance_id = str(section_result.inserted_id)

        # Questions within this section
        questions_cursor = _template_questions().find(
            {"templateSectionId": str(section["_id"])}
        ).sort("questionOrder", 1)

        question_docs: list[dict[str, Any]] = []
        async for question in questions_cursor:
            question_docs.append({
                "intakeSectionInstanceId": section_instance_id,
                "templateQuestionId": str(question["_id"]),
                "questionStatus": "unanswered",
                "createdAt": now,
                "updatedAt": now,
            })

        if question_docs:
            await _question_instances().insert_many(question_docs)


# ---------------------------------------------------------------------------
# Intake code management
# ---------------------------------------------------------------------------

def generate_intake_code_pair() -> tuple[str, str]:
    """Generate a new intake code and its hash.

    Returns:
        (plain_code, hashed_code)
    """
    return generate_intake_code()


def verify_code(plain_code: str, hashed_code: str) -> bool:
    """Check a plain intake code against its stored hash."""
    return verify_intake_code(plain_code, hashed_code)


async def rotate_intake_code(intake_id: str) -> str:
    """Generate a new intake code for an existing intake.

    Invalidates the previous code by overwriting ``intakeCodeHash``.

    Returns:
        The new plain-text intake code (one-time exposure).
    """
    plain_code, hashed_code = generate_intake_code()
    now = datetime.now(timezone.utc)

    await _intakes().update_one(
        {"_id": ObjectId(intake_id)},
        {
            "$set": {
                "intakeCodeHash": hashed_code,
                "updatedAt": now,
            }
        },
    )
    return plain_code


# ---------------------------------------------------------------------------
# Progress calculation
# ---------------------------------------------------------------------------

async def calculate_progress(intake_id: str) -> dict:
    """Calculate overall progress for an intake.

    Returns an ``IntakeProgressSummary`` dict:
        - totalSections: int
        - completedSections: int
        - totalQuestions: int
        - answeredQuestions: int
        - skippedQuestions: int
        - laterQuestions: int
        - notApplicableQuestions: int
        - unansweredQuestions: int
        - percentComplete: float  (0-100)
        - sections: list[dict]    per-section breakdowns
    """
    section_instances = await _section_instances().find(
        {"intakeId": intake_id}
    ).to_list(length=None)

    total_questions = 0
    answered = 0
    skipped = 0
    later = 0
    not_applicable = 0
    unanswered = 0
    completed_sections = 0
    section_summaries: list[dict] = []

    for si in section_instances:
        si_id = str(si["_id"])
        sec_progress = await calculate_section_progress(si_id)
        section_summaries.append(sec_progress)

        total_questions += sec_progress["totalQuestions"]
        answered += sec_progress["answeredQuestions"]
        skipped += sec_progress["skippedQuestions"]
        later += sec_progress["laterQuestions"]
        not_applicable += sec_progress["notApplicableQuestions"]
        unanswered += sec_progress["unansweredQuestions"]

        if sec_progress["isComplete"]:
            completed_sections += 1

    percent = (answered / total_questions * 100) if total_questions > 0 else 0.0

    return {
        "intakeId": intake_id,
        "totalSections": len(section_instances),
        "completedSections": completed_sections,
        "totalQuestions": total_questions,
        "answeredQuestions": answered,
        "skippedQuestions": skipped,
        "laterQuestions": later,
        "notApplicableQuestions": not_applicable,
        "unansweredQuestions": unanswered,
        "percentComplete": round(percent, 1),
        "sections": section_summaries,
    }


async def calculate_section_progress(section_instance_id: str) -> dict:
    """Calculate progress for a single section instance.

    Returns a dict with question-status counts and ``isComplete`` flag.
    """
    question_instances = await _question_instances().find(
        {"intakeSectionInstanceId": section_instance_id}
    ).to_list(length=None)

    counts = {
        "unanswered": 0,
        "answered": 0,
        "skipped": 0,
        "later": 0,
        "notApplicable": 0,
    }
    for qi in question_instances:
        status = qi.get("questionStatus", "unanswered")
        if status in counts:
            counts[status] += 1
        else:
            counts["unanswered"] += 1

    total = len(question_instances)
    # A section is complete when every question has a terminal status.
    terminal = counts["answered"] + counts["skipped"] + counts["notApplicable"]
    is_complete = (total > 0) and (terminal == total)

    return {
        "sectionInstanceId": section_instance_id,
        "totalQuestions": total,
        "answeredQuestions": counts["answered"],
        "skippedQuestions": counts["skipped"],
        "laterQuestions": counts["later"],
        "notApplicableQuestions": counts["notApplicable"],
        "unansweredQuestions": counts["unanswered"],
        "isComplete": is_complete,
    }


# ---------------------------------------------------------------------------
# Portal URL
# ---------------------------------------------------------------------------

def get_intake_portal_url(intake_id: str) -> str:
    """Build the external-contributor portal URL for an intake."""
    base = settings.intake_portal_base_url.rstrip("/")
    return f"{base}/{intake_id}"
