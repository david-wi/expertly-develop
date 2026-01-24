"""Search API endpoints."""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.deps import get_context, CurrentContext
from app.services.search_service import SearchService

router = APIRouter()


class SearchResultResponse(BaseModel):
    """Schema for a single search result."""
    id: UUID
    entity_type: str
    title: str
    description: Optional[str] = None
    match_context: Optional[str] = None
    relevance: float


class SearchResponse(BaseModel):
    """Schema for search response."""
    query: str
    results: List[SearchResultResponse] = Field(default_factory=list)
    total_count: int = 0


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    entity_types: Optional[str] = Query(
        None,
        description="Comma-separated list of entity types to search: task, person, playbook, project, knowledge",
    ),
    limit: int = Query(default=20, ge=1, le=100, description="Maximum results to return"),
    ctx: CurrentContext = Depends(get_context),
):
    """
    Search across entities (tasks, people, playbooks, projects, knowledge).

    Returns matched entities sorted by relevance.
    """
    search_service = SearchService(db=ctx.db, tenant_id=ctx.tenant.id)

    # Parse entity types
    types_list = None
    if entity_types:
        types_list = [t.strip() for t in entity_types.split(",") if t.strip()]

    results = await search_service.search(
        query=q,
        entity_types=types_list,
        limit=limit,
    )

    return SearchResponse(
        query=q,
        results=[
            SearchResultResponse(
                id=r.id,
                entity_type=r.entity_type,
                title=r.title,
                description=r.description,
                match_context=r.match_context,
                relevance=r.relevance,
            )
            for r in results
        ],
        total_count=len(results),
    )
