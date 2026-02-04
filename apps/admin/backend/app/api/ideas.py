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
    IdeaBulkUpdate,
    IdeaBulkUpdateResponse,
    VoteResponse,
    CommentCreate,
    CommentResponse,
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
    user_email: Optional[str] = Query(None, description="Current user email for vote status"),
    service: IdeaService = Depends(get_idea_service),
):
    """List ideas with optional filters."""
    ideas = await service.get_ideas(
        product=product,
        status=status,
        priority=priority,
        include_archived=include_archived,
    )

    # Enrich with user_voted and comment_count
    result = []
    for idea in ideas:
        idea_dict = {
            "id": idea.id,
            "product": idea.product,
            "title": idea.title,
            "description": idea.description,
            "status": idea.status,
            "priority": idea.priority,
            "tags": idea.tags,
            "created_by_email": idea.created_by_email,
            "created_at": idea.created_at,
            "updated_at": idea.updated_at,
            "vote_count": idea.vote_count or 0,
            "user_voted": False,
            "comment_count": await service.get_comment_count(idea.id),
        }
        if user_email:
            idea_dict["user_voted"] = await service.has_user_voted(idea.id, user_email)
        result.append(IdeaResponse.model_validate(idea_dict))

    return result


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


@router.patch("/bulk", response_model=IdeaBulkUpdateResponse)
async def bulk_update_ideas(
    data: IdeaBulkUpdate,
    service: IdeaService = Depends(get_idea_service),
):
    """Bulk update multiple ideas."""
    updated_ids = await service.bulk_update_ideas(data.ids, data.updates)
    return IdeaBulkUpdateResponse(
        updated_count=len(updated_ids),
        updated_ids=updated_ids,
    )


@router.post("/{idea_id}/vote", response_model=VoteResponse)
async def toggle_vote(
    idea_id: UUID,
    user_email: str = Query(..., description="Email of the voting user"),
    service: IdeaService = Depends(get_idea_service),
):
    """Toggle vote on an idea (vote if not voted, unvote if already voted)."""
    result = await service.toggle_vote(idea_id, user_email)
    if result is None:
        raise HTTPException(status_code=404, detail="Idea not found")
    vote_count, user_voted = result
    return VoteResponse(
        idea_id=idea_id,
        vote_count=vote_count,
        user_voted=user_voted,
    )


@router.get("/{idea_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    idea_id: UUID,
    service: IdeaService = Depends(get_idea_service),
):
    """List all comments for an idea."""
    idea = await service.get_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    comments = await service.get_comments(idea_id)
    return [CommentResponse.model_validate(c) for c in comments]


@router.post("/{idea_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    idea_id: UUID,
    data: CommentCreate,
    author_email: str = Query(..., description="Email of the comment author"),
    service: IdeaService = Depends(get_idea_service),
):
    """Add a comment to an idea."""
    comment = await service.add_comment(idea_id, author_email, data.content)
    if not comment:
        raise HTTPException(status_code=404, detail="Idea not found")
    return CommentResponse.model_validate(comment)


@router.delete("/{idea_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    idea_id: UUID,
    comment_id: UUID,
    user_email: str = Query(..., description="Email of the user deleting the comment"),
    service: IdeaService = Depends(get_idea_service),
):
    """Delete a comment (only the author can delete)."""
    success = await service.delete_comment(comment_id, user_email)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Comment not found or you don't have permission to delete it"
        )
