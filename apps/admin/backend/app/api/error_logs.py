"""API routes for error logs."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.error_log_service import ErrorLogService
from app.schemas.error_log import (
    ErrorLogCreate,
    ErrorLogUpdate,
    ErrorLogResponse,
    ErrorLogListResponse,
    ErrorStatsResponse,
)

router = APIRouter()


def get_error_log_service(db: AsyncSession = Depends(get_db)) -> ErrorLogService:
    """Dependency to instantiate error log service."""
    return ErrorLogService(db)


@router.post("", response_model=ErrorLogResponse, status_code=201)
async def create_error_log(
    data: ErrorLogCreate,
    service: ErrorLogService = Depends(get_error_log_service),
):
    """
    Create a new error log entry.

    This endpoint is public (no auth required) to allow any Expertly app
    to log errors even when the user is not authenticated.
    """
    error_log = await service.create_error_log(data)
    return ErrorLogResponse.model_validate(error_log)


@router.get("", response_model=ErrorLogListResponse)
async def list_error_logs(
    app_name: Optional[str] = Query(None, description="Filter by app name"),
    status: Optional[str] = Query(None, description="Filter by status (new, acknowledged, resolved)"),
    severity: Optional[str] = Query(None, description="Filter by severity (info, warning, error)"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: ErrorLogService = Depends(get_error_log_service),
):
    """
    List error logs with optional filters and pagination.

    Requires admin authentication.
    """
    error_logs, total = await service.get_error_logs(
        app_name=app_name,
        status=status,
        severity=severity,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )
    return ErrorLogListResponse(
        errors=[ErrorLogResponse.model_validate(e) for e in error_logs],
        total=total,
    )


@router.get("/stats", response_model=ErrorStatsResponse)
async def get_error_stats(
    service: ErrorLogService = Depends(get_error_log_service),
):
    """
    Get error statistics summary.

    Requires admin authentication.
    """
    stats = await service.get_error_stats()
    return ErrorStatsResponse(**stats)


@router.get("/apps", response_model=list[str])
async def get_distinct_apps(
    service: ErrorLogService = Depends(get_error_log_service),
):
    """
    Get list of distinct app names that have logged errors.

    Useful for populating filter dropdowns.
    """
    return await service.get_distinct_apps()


@router.get("/{error_id}", response_model=ErrorLogResponse)
async def get_error_log(
    error_id: UUID,
    service: ErrorLogService = Depends(get_error_log_service),
):
    """
    Get a single error log by ID.

    Requires admin authentication.
    """
    error_log = await service.get_error_log(error_id)
    if not error_log:
        raise HTTPException(status_code=404, detail="Error log not found")
    return ErrorLogResponse.model_validate(error_log)


@router.patch("/{error_id}", response_model=ErrorLogResponse)
async def update_error_log(
    error_id: UUID,
    data: ErrorLogUpdate,
    service: ErrorLogService = Depends(get_error_log_service),
):
    """
    Update an error log entry (mainly for status changes).

    Requires admin authentication.
    """
    error_log = await service.update_error_log(error_id, data)
    if not error_log:
        raise HTTPException(status_code=404, detail="Error log not found")
    return ErrorLogResponse.model_validate(error_log)
