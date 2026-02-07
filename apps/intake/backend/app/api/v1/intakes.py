"""Intake instance management routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.config import settings
from app.core.database import get_collection
from app.core.security import (
    generate_intake_code,
    get_current_user,
    hash_intake_code,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_intake(doc: dict, *, include_code: bool = False) -> dict:
    """Convert a MongoDB intake document to a serializable dict.

    Args:
        doc: The raw MongoDB document.
        include_code: When True, include ``intakeCode`` and ``intakePortalUrl``
            (only used on creation when the plain code is available).
    """
    result = {
        "intakeId": str(doc["_id"]),
        "accountId": str(doc["accountId"]),
        "intakeTypeId": str(doc.get("intakeTypeId", "")),
        "templateVersionId": str(doc.get("templateVersionId", "")),
        "intakeName": doc.get("intakeName", ""),
        "status": doc.get("status", "draft"),
        "createdById": str(doc.get("createdById", "")),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }

    # Progress rollup
    if "progress" in doc:
        result["progress"] = doc["progress"]

    if include_code and "intakeCode" in doc:
        result["intakeCode"] = doc["intakeCode"]
        result["intakePortalUrl"] = (
            f"{settings.intake_portal_base_url}/{doc['intakeCode']}"
        )

    return result


async def _build_progress_summary(intake_id: str) -> dict:
    """Compute a progress rollup for an intake by summarizing section statuses."""
    sections_col = get_collection("intake_section_instances")
    section_docs = await sections_col.find(
        {"intakeId": intake_id}
    ).to_list(length=500)

    total = len(section_docs)
    completed = sum(1 for s in section_docs if s.get("status") == "complete")
    in_progress = sum(1 for s in section_docs if s.get("status") == "in_progress")

    return {
        "totalSections": total,
        "completedSections": completed,
        "inProgressSections": in_progress,
        "percentComplete": round((completed / total) * 100, 1) if total > 0 else 0.0,
    }


async def _create_intake_instances(
    intake_id: str,
    template_version_id: str,
    account_id: str,
) -> None:
    """Instantiate section and question instances from a published template.

    Called during intake creation to stamp out the template into live instances.
    """
    sections_col = get_collection("template_sections")
    questions_col = get_collection("template_questions")
    instance_sections_col = get_collection("intake_section_instances")
    instance_questions_col = get_collection("intake_question_instances")

    now = datetime.now(timezone.utc)

    section_docs = (
        await sections_col.find({"templateVersionId": template_version_id})
        .sort("sectionOrder", 1)
        .to_list(length=500)
    )

    for s_doc in section_docs:
        section_instance = {
            "intakeId": intake_id,
            "accountId": account_id,
            "templateSectionId": str(s_doc["_id"]),
            "sectionName": s_doc["sectionName"],
            "sectionOrder": s_doc["sectionOrder"],
            "isRepeatable": s_doc.get("isRepeatable", False),
            "repeatKeyName": s_doc.get("repeatKeyName"),
            "repeatInstanceIndex": 0,
            "repeatInstanceLabel": None,
            "applicabilityRuleText": s_doc.get("applicabilityRuleText"),
            "status": "not_started",
            "createdAt": now,
            "updatedAt": now,
        }
        si_result = await instance_sections_col.insert_one(section_instance)
        section_instance_id = str(si_result.inserted_id)

        # Create question instances for this section
        q_docs = (
            await questions_col.find({"templateSectionId": str(s_doc["_id"])})
            .sort("questionOrder", 1)
            .to_list(length=500)
        )

        question_instances = []
        for q_doc in q_docs:
            question_instances.append(
                {
                    "intakeId": intake_id,
                    "accountId": account_id,
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


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/intakes", status_code=status.HTTP_201_CREATED)
async def create_intake(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Create a new intake instance.

    Expects ``intakeTypeId``, ``templateVersionId``, and optional ``intakeName``
    in the request body.

    Instantiates the published template into section/question instances,
    generates a unique intake code, and returns the full intake with the
    plain code (shown once) and portal URL.
    """
    intake_type_id = body.get("intakeTypeId")
    template_version_id = body.get("templateVersionId")
    intake_name = body.get("intakeName", "")

    if not intake_type_id or not template_version_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="intakeTypeId and templateVersionId are required",
        )

    # Verify template version exists, is published, and belongs to this account
    tv_col = get_collection("template_versions")
    try:
        tv_oid = ObjectId(template_version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid template version ID",
        )

    tv_doc = await tv_col.find_one(
        {"_id": tv_oid, "accountId": current_user["accountId"]}
    )
    if not tv_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template version not found",
        )
    if not tv_doc.get("isPublished"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Template version must be published before creating intakes",
        )

    # Generate intake code
    plain_code, hashed_code = generate_intake_code()

    now = datetime.now(timezone.utc)
    intakes_col = get_collection("intakes")

    doc = {
        "accountId": current_user["accountId"],
        "intakeTypeId": intake_type_id,
        "templateVersionId": template_version_id,
        "intakeName": intake_name,
        "intakeCodeHash": hashed_code,
        "status": "open",
        "createdById": current_user["userId"],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await intakes_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    intake_id = str(result.inserted_id)

    # Instantiate template sections and questions
    await _create_intake_instances(
        intake_id=intake_id,
        template_version_id=str(tv_doc["_id"]),
        account_id=current_user["accountId"],
    )

    # Build progress summary
    progress = await _build_progress_summary(intake_id)
    doc["progress"] = progress

    # Include the plain code in the creation response (shown once)
    doc["intakeCode"] = plain_code
    serialized = _serialize_intake(doc, include_code=True)

    return serialized


@router.get("/intakes")
async def list_intakes(
    current_user: dict = Depends(get_current_user),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """List intakes for the current account with status and progress rollups."""
    intakes_col = get_collection("intakes")

    query: dict = {"accountId": current_user["accountId"]}
    if status_filter:
        query["status"] = status_filter

    if cursor:
        try:
            query["_id"] = {"$gt": ObjectId(cursor)}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )

    docs = (
        await intakes_col.find(query)
        .sort("_id", -1)
        .limit(limit)
        .to_list(length=limit)
    )

    results = []
    for doc in docs:
        intake_id = str(doc["_id"])
        progress = await _build_progress_summary(intake_id)
        doc["progress"] = progress
        results.append(_serialize_intake(doc))

    return results


@router.get("/intakes/{intakeId}")
async def get_intake(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return full intake details including a progress summary."""
    intakes_col = get_collection("intakes")

    try:
        oid = ObjectId(intakeId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid intake ID",
        )

    doc = await intakes_col.find_one(
        {"_id": oid, "accountId": current_user["accountId"]}
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intake not found",
        )

    progress = await _build_progress_summary(str(doc["_id"]))
    doc["progress"] = progress

    return _serialize_intake(doc)


@router.patch("/intakes/{intakeId}")
async def update_intake(
    intakeId: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update mutable intake fields (e.g. intakeName, status)."""
    intakes_col = get_collection("intakes")

    try:
        oid = ObjectId(intakeId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid intake ID",
        )

    allowed = {"intakeName", "status"}
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    updates["updatedAt"] = datetime.now(timezone.utc)

    updated = await intakes_col.find_one_and_update(
        {"_id": oid, "accountId": current_user["accountId"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intake not found",
        )

    progress = await _build_progress_summary(str(updated["_id"]))
    updated["progress"] = progress

    return _serialize_intake(updated)


@router.post("/intakes/{intakeId}/rotateCode")
async def rotate_intake_code(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate a new intake code, invalidating the previous one.

    Returns the new plain code (shown once) and portal URL.
    """
    intakes_col = get_collection("intakes")

    try:
        oid = ObjectId(intakeId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid intake ID",
        )

    doc = await intakes_col.find_one(
        {"_id": oid, "accountId": current_user["accountId"]}
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intake not found",
        )

    plain_code, hashed_code = generate_intake_code()
    now = datetime.now(timezone.utc)

    updated = await intakes_col.find_one_and_update(
        {"_id": oid},
        {"$set": {"intakeCodeHash": hashed_code, "updatedAt": now}},
        return_document=ReturnDocument.AFTER,
    )

    updated["intakeCode"] = plain_code
    return _serialize_intake(updated, include_code=True)
