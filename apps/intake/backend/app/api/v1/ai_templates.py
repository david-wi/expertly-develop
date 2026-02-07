"""AI-powered template suggestion routes.

POST /templates/{templateVersionId}/ai/suggest  – upload documents, get suggestions
POST /templates/{templateVersionId}/ai/accept   – accept selected suggestions
"""

import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.database import get_collection
from app.core.security import get_current_user, require_admin
from app.schemas.ai_template import (
    AITemplateBulkAcceptRequest,
    AITemplateSuggestionsResponse,
    SuggestedSection,
)
from app.schemas.template import (
    TemplateQuestionResponse,
    TemplateSectionResponse,
    TemplateVersionResponse,
)
from app.services.ai_template_service import extract_text, generate_suggestions

from .templates import (
    _assert_template_draft,
    _get_template_version_owned,
    _serialize_question,
    _serialize_section,
    _serialize_template_version,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
}

_MAX_FILES = 10
_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB per file


# ---------------------------------------------------------------------------
# POST /templates/{templateVersionId}/ai/suggest
# ---------------------------------------------------------------------------


@router.post(
    "/templates/{templateVersionId}/ai/suggest",
    response_model=AITemplateSuggestionsResponse,
)
async def ai_suggest(
    templateVersionId: str,
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Upload document(s) and receive AI-generated section/question suggestions.

    Admin only. Template must be a draft.
    """
    # Ownership + draft checks
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )
    await _assert_template_draft(tv_doc)

    # Validate files
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required",
        )
    if len(files) > _MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {_MAX_FILES} files allowed",
        )

    # Extract text from each file
    documents: list[dict] = []
    document_names: list[str] = []
    for f in files:
        if f.content_type not in _ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported file type: {f.content_type} ({f.filename}). "
                f"Allowed: PDF, DOCX, TXT, CSV.",
            )
        file_bytes = await f.read()
        if len(file_bytes) > _MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File '{f.filename}' exceeds 20 MB limit",
            )
        text = extract_text(file_bytes, f.content_type, f.filename or "unknown")
        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not extract text from '{f.filename}'",
            )
        documents.append({"filename": f.filename or "unknown", "text": text})
        document_names.append(f.filename or "unknown")

    # Load existing sections for "improve" mode detection
    existing_sections = None
    sections_col = get_collection("template_sections")
    questions_col = get_collection("template_questions")

    section_docs = (
        await sections_col.find({"templateVersionId": str(tv_doc["_id"])})
        .sort("sectionOrder", 1)
        .to_list(length=500)
    )
    if section_docs:
        existing_sections = []
        for s_doc in section_docs:
            q_docs = (
                await questions_col.find({"templateSectionId": str(s_doc["_id"])})
                .sort("questionOrder", 1)
                .to_list(length=500)
            )
            existing_sections.append(
                {
                    "sectionName": s_doc["sectionName"],
                    "questions": [
                        {
                            "questionText": q["questionText"],
                            "answerType": q["answerType"],
                        }
                        for q in q_docs
                    ],
                }
            )

    # Call AI
    try:
        sections, mode = await generate_suggestions(
            documents=documents,
            existing_sections=existing_sections,
            template_name=tv_doc["templateName"],
        )
    except Exception as e:
        logger.exception("AI suggestion generation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {str(e)}",
        )

    return AITemplateSuggestionsResponse(
        sections=sections,
        documentNames=document_names,
        mode=mode,
    )


# ---------------------------------------------------------------------------
# POST /templates/{templateVersionId}/ai/accept
# ---------------------------------------------------------------------------


@router.post(
    "/templates/{templateVersionId}/ai/accept",
    response_model=TemplateVersionResponse,
)
async def ai_accept(
    templateVersionId: str,
    body: AITemplateBulkAcceptRequest,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Accept AI-suggested sections and questions, creating them in the template.

    Admin only. Template must be a draft.
    """
    tv_doc = await _get_template_version_owned(
        templateVersionId, current_user["accountId"]
    )
    await _assert_template_draft(tv_doc)

    if not body.sections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one section is required",
        )

    sections_col = get_collection("template_sections")
    questions_col = get_collection("template_questions")
    tv_col = get_collection("template_versions")

    now = datetime.now(timezone.utc)

    for section in body.sections:
        # Create section
        section_doc = {
            "templateVersionId": str(tv_doc["_id"]),
            "sectionName": section.section_name,
            "sectionOrder": section.section_order,
            "isRepeatable": section.is_repeatable,
            "repeatKeyName": section.repeat_key_name,
            "applicabilityRuleText": section.applicability_rule_text,
            "createdAt": now,
            "updatedAt": now,
        }
        result = await sections_col.insert_one(section_doc)
        section_id = str(result.inserted_id)

        # Create questions within this section
        for q in section.questions:
            question_doc = {
                "templateSectionId": section_id,
                "questionKey": q.question_key,
                "questionText": q.question_text,
                "questionHelpText": q.question_help_text,
                "questionOrder": q.question_order,
                "isRequired": q.is_required,
                "answerType": q.answer_type.value,
                "applicabilityRuleText": q.applicability_rule_text,
                "createdAt": now,
                "updatedAt": now,
            }
            await questions_col.insert_one(question_doc)

    # Touch parent timestamp
    await tv_col.update_one(
        {"_id": tv_doc["_id"]}, {"$set": {"updatedAt": now}}
    )

    # Return the full updated template version (same pattern as get_template)
    tv_doc = await tv_col.find_one({"_id": tv_doc["_id"]})
    section_docs = (
        await sections_col.find({"templateVersionId": str(tv_doc["_id"])})
        .sort("sectionOrder", 1)
        .to_list(length=500)
    )
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
