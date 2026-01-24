"""WaitingItem API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_context, CurrentContext
from app.services.waiting_item_service import WaitingItemService
from app.schemas.waiting_item import (
    WaitingItemCreate,
    WaitingItemUpdate,
    WaitingItemResolve,
    WaitingItemResponse,
)

router = APIRouter()


def get_waiting_item_service(ctx: CurrentContext = Depends(get_context)) -> WaitingItemService:
    """Get waiting item service with current context."""
    return WaitingItemService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)


@router.get("", response_model=List[WaitingItemResponse])
async def list_waiting_items(
    status: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """List waiting items with optional filters."""
    items = await service.list_waiting_items(status=status, limit=limit, offset=offset)
    return [WaitingItemResponse.model_validate(i) for i in items]


@router.get("/active", response_model=List[WaitingItemResponse])
async def get_active_waiting_items(
    limit: int = Query(default=50, ge=1, le=100),
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Get active waiting items."""
    items = await service.get_active_waiting_items(limit=limit)
    return [WaitingItemResponse.model_validate(i) for i in items]


@router.get("/overdue", response_model=List[WaitingItemResponse])
async def get_overdue_waiting_items(
    limit: int = Query(default=50, ge=1, le=100),
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Get overdue waiting items."""
    items = await service.get_overdue_waiting_items(limit=limit)
    return [WaitingItemResponse.model_validate(i) for i in items]


@router.post("", response_model=WaitingItemResponse, status_code=status.HTTP_201_CREATED)
async def create_waiting_item(
    data: WaitingItemCreate,
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Create a new waiting item."""
    item = await service.create_waiting_item(data)
    return WaitingItemResponse.model_validate(item)


@router.get("/{item_id}", response_model=WaitingItemResponse)
async def get_waiting_item(
    item_id: UUID,
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Get a waiting item by ID."""
    item = await service.get_waiting_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Waiting item not found")
    return WaitingItemResponse.model_validate(item)


@router.put("/{item_id}", response_model=WaitingItemResponse)
async def update_waiting_item(
    item_id: UUID,
    data: WaitingItemUpdate,
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Update a waiting item."""
    try:
        item = await service.update_waiting_item(item_id, data)
        if not item:
            raise HTTPException(status_code=404, detail="Waiting item not found")
        return WaitingItemResponse.model_validate(item)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{item_id}/resolve", response_model=WaitingItemResponse)
async def resolve_waiting_item(
    item_id: UUID,
    data: WaitingItemResolve = None,
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Resolve a waiting item."""
    try:
        notes = data.resolution_notes if data else None
        item = await service.resolve_waiting_item(item_id, notes)
        if not item:
            raise HTTPException(status_code=404, detail="Waiting item not found")
        return WaitingItemResponse.model_validate(item)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waiting_item(
    item_id: UUID,
    service: WaitingItemService = Depends(get_waiting_item_service),
):
    """Delete a waiting item."""
    deleted = await service.delete_waiting_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Waiting item not found")
