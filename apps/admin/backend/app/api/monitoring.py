"""API endpoints for service monitoring."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.monitoring import MonitoringResponse, HealthHistoryResponse
from app.services.monitoring_service import (
    check_all_services,
    get_latest_status,
    get_service_history,
)

router = APIRouter()


@router.get("", response_model=MonitoringResponse)
async def get_monitoring_status(
    refresh: bool = Query(False, description="Perform fresh health checks"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current status of all monitored services.

    - If refresh=False (default), returns the latest stored status
    - If refresh=True, performs fresh health checks on all services
    """
    if refresh:
        return await check_all_services(db, save_results=True)
    return await get_latest_status(db)


@router.post("/check", response_model=MonitoringResponse)
async def run_health_checks(
    db: AsyncSession = Depends(get_db),
):
    """
    Manually trigger health checks for all services.
    Results are saved to the database.
    """
    return await check_all_services(db, save_results=True)


@router.get("/history/{service_name}", response_model=HealthHistoryResponse)
async def get_service_health_history(
    service_name: str,
    limit: int = Query(100, le=500, description="Maximum number of records to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get health check history for a specific service.
    """
    checks = await get_service_history(db, service_name, limit)
    return HealthHistoryResponse(
        service_name=service_name,
        checks=checks,
        total=len(checks),
    )
