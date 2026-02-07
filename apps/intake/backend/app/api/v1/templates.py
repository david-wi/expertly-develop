"""Template version, section, and question management routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.core.database import get_collection
from app.core.security import get_current_user, require_admin
from app.schemas.template import (
    TemplateQuestionCreate,
    TemplateQuestionResponse,
    TemplateSectionCreate,
    TemplateSectionResponse,
    TemplateVersionCreate,
    TemplateVersionResponse,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_template_version(doc: dict) -> dict:
    """Convert a MongoDB template-version document to a serializable dict."""
    return {
        "templateVersionId": str(doc["_id"]),
        "accountId": str(doc["accountId"]),
        "templateName": doc["templateName"],
        "versionLabel": doc["versionLabel"],
        "intakeTypeId": str(doc["intakeTypeId"]),
        "isPublished": doc.get("isPublished", False),
        "sections": doc.get("sections"),  # populated on detail view
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


def _serialize_section(doc: dict) -> dict:
    """Convert a MongoDB template-section document to a serializable dict."""
    return {
        "templateSectionId": str(doc["_id"]),
        "templateVersionId": str(doc["templateVersionId"]),
        "sectionName": doc["sectionName"],
        "sectionOrder": doc["sectionOrder"],
        "isRepeatable": doc.get("isRepeatable", False),
        "repeatKeyName": doc.get("repeatKeyName"),
        "applicabilityRuleText": doc.get("applicabilityRuleText"),
        "questions": doc.get("questions"),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


def _serialize_question(doc: dict) -> dict:
    """Convert a MongoDB template-question document to a serializable dict."""
    return {
        "templateQuestionId": str(doc["_id"]),
        "templateSectionId": str(doc["templateSectionId"]),
        "questionKey": doc["questionKey"],
        "questionText": doc["questionText"],
        "questionHelpText": doc.get("questionHelpText"),
        "questionOrder": doc["questionOrder"],
        "isRequired": doc.get("isRequired", True),
        "answerType": doc["answerType"],
        "applicabilityRuleText": doc.get("applicabilityRuleText"),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


async def _get_template_version_owned(
    template_version_id: str,
    account_id: str,
) -> dict:
    """Fetch a template version ensuring it belongs to the given account.

    Raises HTTPException on invalid ID or not found.
    """
    collection = get_collection("template_versions")

    try:
        oid = ObjectId(template_version_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid template version ID",
        )

    doc = await collection.find_one({"_id": oid, "accountId": account_id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template version not found",
        )
    return doc


async def _assert_template_draft(template_doc: dict) -> None:
    """Ensure the template version is still a draft (not yet published)."""
    if template_doc.get("isPublished"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot modify a published template version",
        )


# ---------------------------------------------------------------------------
# Template Version routes
# ---------------------------------------------------------------------------


@router.get("/templates", response_model=list[TemplateVersionResponse])
async def list_templates(
    current_user: dict = Depends(get_current_user),
    intakeTypeId: Optional[str] = Query(default=None),
    isPublished: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """List template versions, optionally filtered by intake type or publish state."""
    collection = get_collection("template_versions")

    query: dict = {"accountId": current_user["accountId"]}
    if intakeTypeId is not None:
        query["intakeTypeId"] = intakeTypeId
    if isPublished is not None:
        query["isPublished"] = isPublished

    if cursor:
        try:
            query["_id"] = {"$gt": ObjectId(cursor)}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )

    docs = (
        await collection.find(query).sort("_id", 1).limit(limit).to_list(length=limit)
    )
    return [TemplateVersionResponse(**_serialize_template_version(d)) for d in docs]


@router.post(
    "/templates",
    response_model=TemplateVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    body: TemplateVersionCreate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Create a new template version (draft). Admin only."""
    collection = get_collection("template_versions")

    now = datetime.now(timezone.utc)
    doc = {
        "accountId": current_user["accountId"],
        "templateName": body.template_name,
        "versionLabel": body.version_label,
        "intakeTypeId": body.intake_type_id,
        "isPublished": False,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    return TemplateVersionResponse(**_serialize_template_version(doc))


@router.get(
    "/templates/{templateVersionId}",
    response_model=TemplateVersionResponse,
)
async def get_template(
    templateVersionId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a template version with its sections and questions."""
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )

    # Load sections
    sections_col = get_collection("template_sections")
    section_docs = (
        await sections_col.find({"templateVersionId": str(tv_doc["_id"])})
        .sort("sectionOrder", 1)
        .to_list(length=500)
    )

    # Load questions for each section
    questions_col = get_collection("template_questions")
    for s_doc in section_docs:
        q_docs = (
            await questions_col.find({"templateSectionId": str(s_doc["_id"])})
            .sort("questionOrder", 1)
            .to_list(length=500)
        )
        s_doc["questions"] = [
            TemplateQuestionResponse(**_serialize_question(q)) for q in q_docs
        ]

    tv_doc["sections"] = [
        TemplateSectionResponse(**_serialize_section(s)) for s in section_docs
    ]

    return TemplateVersionResponse(**_serialize_template_version(tv_doc))


# ---------------------------------------------------------------------------
# Section routes
# ---------------------------------------------------------------------------


@router.post(
    "/templates/{templateVersionId}/sections",
    response_model=TemplateSectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_section(
    templateVersionId: str,
    body: TemplateSectionCreate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Add a section to a draft template version. Admin only."""
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )
    await _assert_template_draft(tv_doc)

    collection = get_collection("template_sections")
    now = datetime.now(timezone.utc)

    doc = {
        "templateVersionId": str(tv_doc["_id"]),
        "sectionName": body.section_name,
        "sectionOrder": body.section_order,
        "isRepeatable": body.is_repeatable,
        "repeatKeyName": body.repeat_key_name,
        "applicabilityRuleText": body.applicability_rule_text,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Touch parent timestamp
    tv_col = get_collection("template_versions")
    await tv_col.update_one(
        {"_id": tv_doc["_id"]}, {"$set": {"updatedAt": now}}
    )

    return TemplateSectionResponse(**_serialize_section(doc))


@router.patch(
    "/templates/{templateVersionId}/sections/{templateSectionId}",
    response_model=TemplateSectionResponse,
)
async def update_section(
    templateVersionId: str,
    templateSectionId: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Partially update a section in a draft template. Admin only."""
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )
    await _assert_template_draft(tv_doc)

    try:
        section_oid = ObjectId(templateSectionId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid section ID",
        )

    # Only allow known fields
    allowed = {
        "sectionName",
        "sectionOrder",
        "isRepeatable",
        "repeatKeyName",
        "applicabilityRuleText",
    }
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    now = datetime.now(timezone.utc)
    updates["updatedAt"] = now

    collection = get_collection("template_sections")
    updated = await collection.find_one_and_update(
        {"_id": section_oid, "templateVersionId": str(tv_doc["_id"])},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found",
        )

    # Touch parent timestamp
    tv_col = get_collection("template_versions")
    await tv_col.update_one(
        {"_id": tv_doc["_id"]}, {"$set": {"updatedAt": now}}
    )

    return TemplateSectionResponse(**_serialize_section(updated))


# ---------------------------------------------------------------------------
# Question routes
# ---------------------------------------------------------------------------


@router.post(
    "/templates/{templateVersionId}/sections/{templateSectionId}/questions",
    response_model=TemplateQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_question(
    templateVersionId: str,
    templateSectionId: str,
    body: TemplateQuestionCreate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Add a question to a section in a draft template. Admin only."""
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )
    await _assert_template_draft(tv_doc)

    # Verify section exists and belongs to this template version
    sections_col = get_collection("template_sections")
    try:
        section_oid = ObjectId(templateSectionId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid section ID",
        )

    section_doc = await sections_col.find_one(
        {"_id": section_oid, "templateVersionId": str(tv_doc["_id"])}
    )
    if not section_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found in this template version",
        )

    collection = get_collection("template_questions")
    now = datetime.now(timezone.utc)

    doc = {
        "templateSectionId": str(section_doc["_id"]),
        "questionKey": body.question_key,
        "questionText": body.question_text,
        "questionHelpText": body.question_help_text,
        "questionOrder": body.question_order,
        "isRequired": body.is_required,
        "answerType": body.answer_type.value,
        "applicabilityRuleText": body.applicability_rule_text,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Touch parent timestamps
    await sections_col.update_one(
        {"_id": section_doc["_id"]}, {"$set": {"updatedAt": now}}
    )
    tv_col = get_collection("template_versions")
    await tv_col.update_one(
        {"_id": tv_doc["_id"]}, {"$set": {"updatedAt": now}}
    )

    return TemplateQuestionResponse(**_serialize_question(doc))


@router.patch(
    "/templates/{templateVersionId}/sections/{templateSectionId}/questions/{templateQuestionId}",
    response_model=TemplateQuestionResponse,
)
async def update_question(
    templateVersionId: str,
    templateSectionId: str,
    templateQuestionId: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Partially update a question in a draft template. Admin only."""
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )
    await _assert_template_draft(tv_doc)

    # Verify section
    try:
        section_oid = ObjectId(templateSectionId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid section ID",
        )

    sections_col = get_collection("template_sections")
    section_doc = await sections_col.find_one(
        {"_id": section_oid, "templateVersionId": str(tv_doc["_id"])}
    )
    if not section_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Section not found in this template version",
        )

    # Verify question
    try:
        question_oid = ObjectId(templateQuestionId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid question ID",
        )

    allowed = {
        "questionKey",
        "questionText",
        "questionHelpText",
        "questionOrder",
        "isRequired",
        "answerType",
        "applicabilityRuleText",
    }
    updates = {k: v for k, v in body.items() if k in allowed and v is not None}

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    now = datetime.now(timezone.utc)
    updates["updatedAt"] = now

    collection = get_collection("template_questions")
    updated = await collection.find_one_and_update(
        {"_id": question_oid, "templateSectionId": str(section_doc["_id"])},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )

    # Touch parent timestamps
    await sections_col.update_one(
        {"_id": section_doc["_id"]}, {"$set": {"updatedAt": now}}
    )
    tv_col = get_collection("template_versions")
    await tv_col.update_one(
        {"_id": tv_doc["_id"]}, {"$set": {"updatedAt": now}}
    )

    return TemplateQuestionResponse(**_serialize_question(updated))


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------


@router.post(
    "/templates/{templateVersionId}/publish",
    response_model=TemplateVersionResponse,
)
async def publish_template(
    templateVersionId: str,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Mark a template version as published. Admin only.

    Once published the template is immutable; create a new version to make
    further changes.
    """
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )

    if tv_doc.get("isPublished"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Template version is already published",
        )

    # Ensure the template has at least one section with at least one question
    sections_col = get_collection("template_sections")
    section_count = await sections_col.count_documents(
        {"templateVersionId": str(tv_doc["_id"])}
    )
    if section_count == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot publish a template with no sections",
        )

    questions_col = get_collection("template_questions")
    section_docs = await sections_col.find(
        {"templateVersionId": str(tv_doc["_id"])}
    ).to_list(length=500)

    for s_doc in section_docs:
        q_count = await questions_col.count_documents(
            {"templateSectionId": str(s_doc["_id"])}
        )
        if q_count == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Section '{s_doc['sectionName']}' has no questions",
            )

    now = datetime.now(timezone.utc)
    collection = get_collection("template_versions")
    updated = await collection.find_one_and_update(
        {"_id": tv_doc["_id"]},
        {"$set": {"isPublished": True, "publishedAt": now, "updatedAt": now}},
        return_document=ReturnDocument.AFTER,
    )

    return TemplateVersionResponse(**_serialize_template_version(updated))
