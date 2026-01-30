"""API routes for known issues."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.known_issue_service import KnownIssueService
from app.schemas.known_issue import (
    KnownIssueCreate,
    KnownIssueUpdate,
    KnownIssueResponse,
)

router = APIRouter()


def get_known_issue_service(db: AsyncSession = Depends(get_db)) -> KnownIssueService:
    """Dependency to instantiate known issue service."""
    return KnownIssueService(db)


@router.post("", response_model=KnownIssueResponse, status_code=201)
async def create_known_issue(
    data: KnownIssueCreate,
    service: KnownIssueService = Depends(get_known_issue_service),
):
    """Create a new known issue."""
    known_issue = await service.create_known_issue(data)
    return KnownIssueResponse.model_validate(known_issue)


@router.get("", response_model=list[KnownIssueResponse])
async def list_known_issues(
    app_name: Optional[str] = Query(None, description="Filter by app name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    include_resolved: bool = Query(True, description="Include resolved issues"),
    service: KnownIssueService = Depends(get_known_issue_service),
):
    """List known issues with optional filters."""
    known_issues = await service.get_known_issues(
        app_name=app_name,
        status=status,
        severity=severity,
        include_resolved=include_resolved,
    )
    return [KnownIssueResponse.model_validate(i) for i in known_issues]


@router.get("/{issue_id}", response_model=KnownIssueResponse)
async def get_known_issue(
    issue_id: UUID,
    service: KnownIssueService = Depends(get_known_issue_service),
):
    """Get a single known issue by ID."""
    known_issue = await service.get_known_issue(issue_id)
    if not known_issue:
        raise HTTPException(status_code=404, detail="Known issue not found")
    return KnownIssueResponse.model_validate(known_issue)


@router.patch("/{issue_id}", response_model=KnownIssueResponse)
async def update_known_issue(
    issue_id: UUID,
    data: KnownIssueUpdate,
    service: KnownIssueService = Depends(get_known_issue_service),
):
    """Update a known issue."""
    known_issue = await service.update_known_issue(issue_id, data)
    if not known_issue:
        raise HTTPException(status_code=404, detail="Known issue not found")
    return KnownIssueResponse.model_validate(known_issue)


@router.delete("/{issue_id}", status_code=204)
async def delete_known_issue(
    issue_id: UUID,
    service: KnownIssueService = Depends(get_known_issue_service),
):
    """Delete a known issue."""
    success = await service.delete_known_issue(issue_id)
    if not success:
        raise HTTPException(status_code=404, detail="Known issue not found")
