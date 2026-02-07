"""Intake section and question instance routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.core.database import get_collection
from app.core.security import get_current_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_section_instance(doc: dict) -> dict:
    """Convert a MongoDB section-instance document to a serializable dict."""
    result = {
        "intakeSectionInstanceId": str(doc["_id"]),
        "intakeId": str(doc["intakeId"]),
        "accountId": str(doc["accountId"]),
        "templateSectionId": str(doc.get("templateSectionId", "")),
        "sectionName": doc["sectionName"],
        "sectionOrder": doc["sectionOrder"],
        "isRepeatable": doc.get("isRepeatable", False),
        "repeatKeyName": doc.get("repeatKeyName"),
        "repeatInstanceIndex": doc.get("repeatInstanceIndex", 0),
        "repeatInstanceLabel": doc.get("repeatInstanceLabel"),
        "applicabilityRuleText": doc.get("applicabilityRuleText"),
        "status": doc.get("status", "not_started"),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }

    if "progress" in doc:
        result["progress"] = doc["progress"]

    if "questions" in doc:
        result["questions"] = doc["questions"]

    return result


def _serialize_question_instance(doc: dict) -> dict:
    """Convert a MongoDB question-instance document to a serializable dict."""
    return {
        "intakeQuestionInstanceId": str(doc["_id"]),
        "intakeId": str(doc["intakeId"]),
        "intakeSectionInstanceId": str(doc["intakeSectionInstanceId"]),
        "templateQuestionId": str(doc.get("templateQuestionId", "")),
        "questionKey": doc["questionKey"],
        "questionText": doc["questionText"],
        "questionHelpText": doc.get("questionHelpText"),
        "questionOrder": doc["questionOrder"],
        "isRequired": doc.get("isRequired", True),
        "answerType": doc["answerType"],
        "applicabilityRuleText": doc.get("applicabilityRuleText"),
        "currentAnswer": doc.get("currentAnswer"),
        "answerSource": doc.get("answerSource"),
        "status": doc.get("status", "unanswered"),
        "revisions": doc.get("revisions", []),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


async def _verify_intake_access(
    intake_id: str,
    account_id: str,
) -> dict:
    """Verify the intake exists and belongs to the account.

    Returns the intake document. Raises HTTPException on failure.
    """
    intakes_col = get_collection("intakes")

    try:
        oid = ObjectId(intake_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid intake ID",
        )

    doc = await intakes_col.find_one({"_id": oid, "accountId": account_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intake not found",
        )
    return doc


async def _compute_section_progress(section_instance_id: str) -> dict:
    """Compute question-level progress for a single section instance."""
    questions_col = get_collection("intake_question_instances")
    q_docs = await questions_col.find(
        {"intakeSectionInstanceId": section_instance_id}
    ).to_list(length=500)

    total = len(q_docs)
    answered = sum(1 for q in q_docs if q.get("status") == "answered")
    required = sum(1 for q in q_docs if q.get("isRequired", True))
    required_answered = sum(
        1 for q in q_docs if q.get("isRequired", True) and q.get("status") == "answered"
    )

    return {
        "totalQuestions": total,
        "answeredQuestions": answered,
        "requiredQuestions": required,
        "requiredAnswered": required_answered,
        "percentComplete": round((answered / total) * 100, 1) if total > 0 else 0.0,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/intakes/{intakeId}/sections")
async def list_sections(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """Return section instances for an intake, each with progress info."""
    await _verify_intake_access(intakeId, current_user["accountId"])

    sections_col = get_collection("intake_section_instances")

    query: dict = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
    }

    if cursor:
        try:
            query["_id"] = {"$gt": ObjectId(cursor)}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )

    docs = (
        await sections_col.find(query)
        .sort("sectionOrder", 1)
        .limit(limit)
        .to_list(length=limit)
    )

    results = []
    for doc in docs:
        progress = await _compute_section_progress(str(doc["_id"]))
        doc["progress"] = progress
        results.append(_serialize_section_instance(doc))

    return results


@router.get("/intakes/{intakeId}/sections/{intakeSectionInstanceId}")
async def get_section(
    intakeId: str,
    intakeSectionInstanceId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a section instance with question statuses."""
    await _verify_intake_access(intakeId, current_user["accountId"])

    sections_col = get_collection("intake_section_instances")

    try:
        section_oid = ObjectId(intakeSectionInstanceId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid section instance ID",
        )

    doc = await sections_col.find_one(
        {
            "_id": section_oid,
            "intakeId": intakeId,
            "accountId": current_user["accountId"],
        }
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section instance not found",
        )

    # Load question instances for this section
    questions_col = get_collection("intake_question_instances")
    q_docs = (
        await questions_col.find({"intakeSectionInstanceId": str(doc["_id"])})
        .sort("questionOrder", 1)
        .to_list(length=500)
    )

    doc["questions"] = [_serialize_question_instance(q) for q in q_docs]
    progress = await _compute_section_progress(str(doc["_id"]))
    doc["progress"] = progress

    return _serialize_section_instance(doc)


@router.post("/intakes/{intakeId}/sections/{intakeSectionInstanceId}/markComplete")
async def mark_section_complete(
    intakeId: str,
    intakeSectionInstanceId: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a section instance as complete.

    Validates that all required questions have been answered before marking
    complete.
    """
    await _verify_intake_access(intakeId, current_user["accountId"])

    sections_col = get_collection("intake_section_instances")

    try:
        section_oid = ObjectId(intakeSectionInstanceId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid section instance ID",
        )

    doc = await sections_col.find_one(
        {
            "_id": section_oid,
            "intakeId": intakeId,
            "accountId": current_user["accountId"],
        }
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section instance not found",
        )

    # Verify all required questions are answered
    questions_col = get_collection("intake_question_instances")
    unanswered_required = await questions_col.count_documents(
        {
            "intakeSectionInstanceId": str(doc["_id"]),
            "isRequired": True,
            "status": {"$ne": "answered"},
        }
    )

    if unanswered_required > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{unanswered_required} required question(s) have not been answered",
        )

    now = datetime.now(timezone.utc)
    updated = await sections_col.find_one_and_update(
        {"_id": section_oid},
        {"$set": {"status": "complete", "completedAt": now, "updatedAt": now}},
        return_document=ReturnDocument.AFTER,
    )

    progress = await _compute_section_progress(str(updated["_id"]))
    updated["progress"] = progress

    return _serialize_section_instance(updated)


@router.post("/intakes/{intakeId}/sections/{templateSectionId}/addRepeatInstance")
async def add_repeat_instance(
    intakeId: str,
    templateSectionId: str,
    body: dict | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Create a new repeat instance of a repeatable section.

    Clones the section and its questions from the template, with a new
    ``repeatInstanceIndex``. Optionally accepts a ``repeatInstanceLabel``
    in the body (e.g., "Vehicle #2").
    """
    intake_doc = await _verify_intake_access(intakeId, current_user["accountId"])
    body = body or {}

    # Verify the template section is repeatable
    template_sections_col = get_collection("template_sections")
    try:
        ts_oid = ObjectId(templateSectionId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid template section ID",
        )

    ts_doc = await template_sections_col.find_one({"_id": ts_oid})
    if not ts_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template section not found",
        )

    if not ts_doc.get("isRepeatable"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This section is not repeatable",
        )

    # Determine next repeat index
    sections_col = get_collection("intake_section_instances")
    existing_count = await sections_col.count_documents(
        {
            "intakeId": intakeId,
            "templateSectionId": templateSectionId,
        }
    )

    now = datetime.now(timezone.utc)
    repeat_label = body.get("repeatInstanceLabel")

    section_instance = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "templateSectionId": templateSectionId,
        "sectionName": ts_doc["sectionName"],
        "sectionOrder": ts_doc["sectionOrder"],
        "isRepeatable": True,
        "repeatKeyName": ts_doc.get("repeatKeyName"),
        "repeatInstanceIndex": existing_count,
        "repeatInstanceLabel": repeat_label,
        "applicabilityRuleText": ts_doc.get("applicabilityRuleText"),
        "status": "not_started",
        "createdAt": now,
        "updatedAt": now,
    }

    si_result = await sections_col.insert_one(section_instance)
    section_instance["_id"] = si_result.inserted_id
    section_instance_id = str(si_result.inserted_id)

    # Clone question instances from the template
    template_questions_col = get_collection("template_questions")
    instance_questions_col = get_collection("intake_question_instances")

    q_docs = (
        await template_questions_col.find(
            {"templateSectionId": templateSectionId}
        )
        .sort("questionOrder", 1)
        .to_list(length=500)
    )

    question_instances = []
    for q_doc in q_docs:
        question_instances.append(
            {
                "intakeId": intakeId,
                "accountId": current_user["accountId"],
                "intakeSectionInstanceId": section_instance_id,
                "templateQuestionId": str(q_doc["_id"]),
                "questionKey": q_doc["questionKey"],
                "questionText": q_doc["questionText"],
                "questionHelpText": q_doc.get("questionHelpText"),
                "questionOrder": q_doc["questionOrder"],
                "isRequired": q_doc.get("isRequired", True),
                "answerType": q_doc["answerType"],
                "applicabilityRuleText": q_doc.get("applicabilityRuleText"),
                "currentAnswer": None,
                "answerSource": None,
                "status": "unanswered",
                "revisions": [],
                "createdAt": now,
                "updatedAt": now,
            }
        )

    if question_instances:
        await instance_questions_col.insert_many(question_instances)

    progress = await _compute_section_progress(section_instance_id)
    section_instance["progress"] = progress

    return _serialize_section_instance(section_instance)


@router.get("/intakes/{intakeId}/questions/{intakeQuestionInstanceId}")
async def get_question(
    intakeId: str,
    intakeQuestionInstanceId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a single question instance with current answer and revision history."""
    await _verify_intake_access(intakeId, current_user["accountId"])

    questions_col = get_collection("intake_question_instances")

    try:
        q_oid = ObjectId(intakeQuestionInstanceId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question instance ID",
        )

    doc = await questions_col.find_one(
        {
            "_id": q_oid,
            "intakeId": intakeId,
            "accountId": current_user["accountId"],
        }
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question instance not found",
        )

    return _serialize_question_instance(doc)
