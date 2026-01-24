"""Requirements API endpoints."""

from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import UserContext, get_current_user
from app.database import get_database
from app.models.requirement import Requirement, RequirementStatus, DocumentType

router = APIRouter()


class RequirementCreate(BaseModel):
    """Schema for creating a requirement."""

    title: str = Field(..., min_length=1, max_length=200)
    project_id: Optional[str] = None  # null = meta-requirement
    document_type: DocumentType = DocumentType.FEATURE
    status: RequirementStatus = RequirementStatus.DRAFT


class RequirementUpdate(BaseModel):
    """Schema for updating a requirement."""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    status: Optional[RequirementStatus] = None
    document_type: Optional[DocumentType] = None


class RequirementResponse(BaseModel):
    """Schema for requirement response."""

    id: str
    title: str
    project_id: Optional[str]
    document_type: str
    status: str
    document_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class RequirementListResponse(BaseModel):
    """Schema for requirement list response."""

    items: list[RequirementResponse]
    total: int


def requirement_to_response(req: Requirement) -> RequirementResponse:
    """Convert requirement model to response schema."""
    return RequirementResponse(
        id=str(req.id),
        title=req.title,
        project_id=str(req.project_id) if req.project_id else None,
        document_type=req.document_type.value if isinstance(req.document_type, DocumentType) else req.document_type,
        status=req.status.value if isinstance(req.status, RequirementStatus) else req.status,
        document_id=str(req.document_id) if req.document_id else None,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.get("", response_model=RequirementListResponse)
async def list_requirements(
    project_id: Optional[str] = None,
    meta_only: bool = False,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_current_user),
):
    """List requirements with optional filters."""
    db = get_database()

    query = {"tenant_id": user.tenant_id}

    if meta_only:
        query["project_id"] = None
    elif project_id:
        query["project_id"] = ObjectId(project_id)

    if status:
        query["status"] = status

    cursor = (
        db.requirements.find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )

    requirements = [Requirement.from_mongo(doc) async for doc in cursor]
    total = await db.requirements.count_documents(query)

    return RequirementListResponse(
        items=[requirement_to_response(r) for r in requirements],
        total=total,
    )


@router.post("", response_model=RequirementResponse, status_code=status.HTTP_201_CREATED)
async def create_requirement(
    data: RequirementCreate,
    user: UserContext = Depends(get_current_user),
):
    """Create a new requirement."""
    db = get_database()

    # Verify project exists if provided
    if data.project_id:
        project = await db.projects.find_one({
            "_id": ObjectId(data.project_id),
            "tenant_id": user.tenant_id,
            "deleted_at": None,
        })
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

    req = Requirement(
        tenant_id=user.tenant_id,
        project_id=ObjectId(data.project_id) if data.project_id else None,
        title=data.title,
        document_type=data.document_type,
        status=data.status,
        created_by=user.user_id,
    )

    result = await db.requirements.insert_one(req.to_mongo())
    req.id = result.inserted_id

    return requirement_to_response(req)


@router.get("/{requirement_id}", response_model=RequirementResponse)
async def get_requirement(
    requirement_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Get a requirement by ID."""
    db = get_database()

    doc = await db.requirements.find_one({
        "_id": ObjectId(requirement_id),
        "tenant_id": user.tenant_id,
    })

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )

    return requirement_to_response(Requirement.from_mongo(doc))


@router.put("/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(
    requirement_id: str,
    data: RequirementUpdate,
    user: UserContext = Depends(get_current_user),
):
    """Update a requirement."""
    db = get_database()

    existing = await db.requirements.find_one({
        "_id": ObjectId(requirement_id),
        "tenant_id": user.tenant_id,
    })

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )

    updates = data.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.now(timezone.utc)

    result = await db.requirements.find_one_and_update(
        {"_id": ObjectId(requirement_id)},
        {"$set": updates},
        return_document=True,
    )

    return requirement_to_response(Requirement.from_mongo(result))


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_requirement(
    requirement_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Delete a requirement."""
    db = get_database()

    result = await db.requirements.delete_one({
        "_id": ObjectId(requirement_id),
        "tenant_id": user.tenant_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )
