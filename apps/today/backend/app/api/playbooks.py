"""Playbook API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_context, CurrentContext
from app.services.playbook_service import PlaybookService
from app.schemas.playbook import (
    PlaybookCreate,
    PlaybookPropose,
    PlaybookUpdate,
    PlaybookResponse,
    PlaybookMatchResponse,
)

router = APIRouter()


def get_playbook_service(ctx: CurrentContext = Depends(get_context)) -> PlaybookService:
    """Get playbook service with current context."""
    return PlaybookService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)


@router.get("", response_model=List[PlaybookResponse])
async def list_playbooks(
    category: Optional[str] = Query(None),
    must_consult: Optional[bool] = Query(None),
    status: Optional[str] = Query(None, pattern="^(active|proposed|archived)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: PlaybookService = Depends(get_playbook_service),
):
    """List playbooks with optional filters."""
    playbooks = await service.list_playbooks(
        category=category,
        must_consult=must_consult,
        status=status,
        limit=limit,
        offset=offset,
    )
    return [PlaybookResponse.model_validate(p) for p in playbooks]


@router.get("/match", response_model=PlaybookMatchResponse)
async def match_playbooks(
    task: str = Query(..., min_length=1, description="Task description to match"),
    service: PlaybookService = Depends(get_playbook_service),
):
    """
    Find playbooks matching a task description.

    Returns matched playbooks and must_consult warnings.
    Claude should call this before executing any task.
    """
    matched, must_consult = await service.match_playbooks(task)

    return PlaybookMatchResponse(
        matched=matched,
        must_consult=must_consult,
    )


@router.post("", response_model=PlaybookResponse, status_code=status.HTTP_201_CREATED)
async def create_playbook(
    data: PlaybookCreate,
    service: PlaybookService = Depends(get_playbook_service),
):
    """Create a new active playbook."""
    playbook = await service.create_playbook(data)
    return PlaybookResponse.model_validate(playbook)


@router.post("/propose", response_model=PlaybookResponse, status_code=status.HTTP_201_CREATED)
async def propose_playbook(
    data: PlaybookPropose,
    service: PlaybookService = Depends(get_playbook_service),
):
    """
    Propose a new playbook for review.

    Claude calls this when it learns a new pattern.
    The playbook will be in 'proposed' status until approved by user.
    """
    playbook = await service.propose_playbook(data)
    return PlaybookResponse.model_validate(playbook)


@router.get("/{playbook_id}", response_model=PlaybookResponse)
async def get_playbook(
    playbook_id: UUID,
    service: PlaybookService = Depends(get_playbook_service),
):
    """Get a playbook by ID."""
    playbook = await service.get_playbook(playbook_id)
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return PlaybookResponse.model_validate(playbook)


@router.put("/{playbook_id}", response_model=PlaybookResponse)
async def update_playbook(
    playbook_id: UUID,
    data: PlaybookUpdate,
    service: PlaybookService = Depends(get_playbook_service),
):
    """Update a playbook."""
    playbook = await service.update_playbook(playbook_id, data)
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return PlaybookResponse.model_validate(playbook)


@router.put("/{playbook_id}/approve", response_model=PlaybookResponse)
async def approve_playbook(
    playbook_id: UUID,
    service: PlaybookService = Depends(get_playbook_service),
):
    """Approve a proposed playbook."""
    try:
        playbook = await service.approve_playbook(playbook_id)
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found")
        return PlaybookResponse.model_validate(playbook)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{playbook_id}/archive", response_model=PlaybookResponse)
async def archive_playbook(
    playbook_id: UUID,
    service: PlaybookService = Depends(get_playbook_service),
):
    """Archive a playbook."""
    playbook = await service.archive_playbook(playbook_id)
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return PlaybookResponse.model_validate(playbook)


@router.delete("/{playbook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playbook(
    playbook_id: UUID,
    service: PlaybookService = Depends(get_playbook_service),
):
    """Delete a playbook permanently."""
    deleted = await service.delete_playbook(playbook_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Playbook not found")
