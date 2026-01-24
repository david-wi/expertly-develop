"""Draft API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_context, CurrentContext
from app.services.draft_service import DraftService
from app.schemas.draft import (
    DraftCreate,
    DraftUpdate,
    DraftApprove,
    DraftReject,
    DraftResponse,
)

router = APIRouter()


def get_draft_service(ctx: CurrentContext = Depends(get_context)) -> DraftService:
    """Get draft service with current context."""
    return DraftService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)


@router.get("", response_model=List[DraftResponse])
async def list_drafts(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: DraftService = Depends(get_draft_service),
):
    """List drafts with optional filters."""
    drafts = await service.list_drafts(
        status=status, draft_type=type, limit=limit, offset=offset
    )
    return [DraftResponse.model_validate(d) for d in drafts]


@router.get("/pending", response_model=List[DraftResponse])
async def get_pending_drafts(
    limit: int = Query(default=50, ge=1, le=100),
    service: DraftService = Depends(get_draft_service),
):
    """Get pending drafts for review."""
    drafts = await service.get_pending_drafts(limit=limit)
    return [DraftResponse.model_validate(d) for d in drafts]


@router.post("", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
async def create_draft(
    data: DraftCreate,
    service: DraftService = Depends(get_draft_service),
):
    """Create a new draft."""
    draft = await service.create_draft(data)
    return DraftResponse.model_validate(draft)


@router.get("/{draft_id}", response_model=DraftResponse)
async def get_draft(
    draft_id: UUID,
    service: DraftService = Depends(get_draft_service),
):
    """Get a draft by ID."""
    draft = await service.get_draft(draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return DraftResponse.model_validate(draft)


@router.put("/{draft_id}", response_model=DraftResponse)
async def update_draft(
    draft_id: UUID,
    data: DraftUpdate,
    service: DraftService = Depends(get_draft_service),
):
    """Update a draft."""
    try:
        draft = await service.update_draft(draft_id, data)
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        return DraftResponse.model_validate(draft)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{draft_id}/approve", response_model=DraftResponse)
async def approve_draft(
    draft_id: UUID,
    data: DraftApprove = None,
    service: DraftService = Depends(get_draft_service),
):
    """Approve a draft."""
    try:
        feedback = data.feedback if data else None
        draft = await service.approve_draft(draft_id, feedback)
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        return DraftResponse.model_validate(draft)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{draft_id}/reject", response_model=DraftResponse)
async def reject_draft(
    draft_id: UUID,
    data: DraftReject,
    service: DraftService = Depends(get_draft_service),
):
    """Reject a draft with feedback."""
    try:
        draft = await service.reject_draft(draft_id, data.feedback)
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        return DraftResponse.model_validate(draft)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
