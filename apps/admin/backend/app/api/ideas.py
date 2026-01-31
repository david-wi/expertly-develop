"""API routes for ideas."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.idea_service import IdeaService
from app.schemas.idea import (
    IdeaCreate,
    IdeaUpdate,
    IdeaResponse,
    VALID_PRODUCTS,
)

router = APIRouter()


def get_idea_service(db: AsyncSession = Depends(get_db)) -> IdeaService:
    """Dependency to instantiate idea service."""
    return IdeaService(db)


@router.get("/products", response_model=list[str])
async def list_valid_products():
    """List all valid product codes for ideas."""
    return VALID_PRODUCTS


@router.get("/products/with-ideas", response_model=list[str])
async def list_products_with_ideas(
    service: IdeaService = Depends(get_idea_service),
):
    """List products that have at least one idea."""
    return await service.get_products_with_ideas()


@router.post("", response_model=IdeaResponse, status_code=201)
async def create_idea(
    data: IdeaCreate,
    service: IdeaService = Depends(get_idea_service),
):
    """Create a new idea."""
    idea = await service.create_idea(data)
    return IdeaResponse.model_validate(idea)


@router.get("", response_model=list[IdeaResponse])
async def list_ideas(
    product: Optional[str] = Query(None, description="Filter by product"),
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    include_archived: bool = Query(False, description="Include archived ideas"),
    service: IdeaService = Depends(get_idea_service),
):
    """List ideas with optional filters."""
    ideas = await service.get_ideas(
        product=product,
        status=status,
        priority=priority,
        include_archived=include_archived,
    )
    return [IdeaResponse.model_validate(i) for i in ideas]


@router.get("/{idea_id}", response_model=IdeaResponse)
async def get_idea(
    idea_id: UUID,
    service: IdeaService = Depends(get_idea_service),
):
    """Get a single idea by ID."""
    idea = await service.get_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return IdeaResponse.model_validate(idea)


@router.patch("/{idea_id}", response_model=IdeaResponse)
async def update_idea(
    idea_id: UUID,
    data: IdeaUpdate,
    service: IdeaService = Depends(get_idea_service),
):
    """Update an idea."""
    idea = await service.update_idea(idea_id, data)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return IdeaResponse.model_validate(idea)


@router.delete("/{idea_id}", status_code=204)
async def delete_idea(
    idea_id: UUID,
    service: IdeaService = Depends(get_idea_service),
):
    """Delete an idea."""
    success = await service.delete_idea(idea_id)
    if not success:
        raise HTTPException(status_code=404, detail="Idea not found")
