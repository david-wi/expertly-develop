"""Service for monitoring health of deployed applications."""

import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, func, and_, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monitoring import ServiceHealthCheck
from app.schemas.monitoring import (
    ServiceConfig,
    HealthCheckResult,
    ServiceStatus,
    MonitoringResponse,
)


# Define all services to monitor
MONITORED_SERVICES: list[ServiceConfig] = [
    ServiceConfig(name="Admin", url="https://admin.ai.devintensive.com", health_endpoint="/api/health"),
    ServiceConfig(name="Admin API", url="https://admin-api.ai.devintensive.com", health_endpoint="/health"),
    ServiceConfig(name="Develop", url="https://develop.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Develop API", url="https://develop-api.ai.devintensive.com", health_endpoint="/api/v1/health"),
    ServiceConfig(name="Define", url="https://define.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Identity", url="https://identity.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Identity API", url="https://identity-api.ai.devintensive.com", health_endpoint="/health"),
    ServiceConfig(name="Manage", url="https://manage.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Manage API", url="https://manage-api.ai.devintensive.com", health_endpoint="/health"),
    ServiceConfig(name="Vibetest", url="https://vibetest.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Salon", url="https://salon.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Salon API", url="https://salon-api.ai.devintensive.com", health_endpoint="/health"),
    ServiceConfig(name="Today", url="https://today.ai.devintensive.com", health_endpoint="/"),
    ServiceConfig(name="Today API", url="https://today-api.ai.devintensive.com", health_endpoint="/health"),
    ServiceConfig(name="Vibecode", url="https://vibecode.ai.devintensive.com", health_endpoint="/health"),
]


async def check_service_health(
    client: httpx.AsyncClient,
    service: ServiceConfig,
) -> HealthCheckResult:
    """Check the health of a single service."""
    url = f"{service.url}{service.health_endpoint}"
    checked_at = datetime.now(timezone.utc)

    try:
        start_time = asyncio.get_event_loop().time()
        response = await client.get(url, timeout=10.0, follow_redirects=True)
        end_time = asyncio.get_event_loop().time()
        response_time_ms = (end_time - start_time) * 1000

        # Consider 2xx and 3xx as healthy
        is_healthy = 200 <= response.status_code < 400

        return HealthCheckResult(
            service_name=service.name,
            service_url=service.url,
            is_healthy=is_healthy,
            status_code=response.status_code,
            response_time_ms=round(response_time_ms, 2),
            error_message=None if is_healthy else f"HTTP {response.status_code}",
            checked_at=checked_at,
        )
    except httpx.TimeoutException:
        return HealthCheckResult(
            service_name=service.name,
            service_url=service.url,
            is_healthy=False,
            status_code=None,
            response_time_ms=None,
            error_message="Connection timeout",
            checked_at=checked_at,
        )
    except httpx.ConnectError as e:
        return HealthCheckResult(
            service_name=service.name,
            service_url=service.url,
            is_healthy=False,
            status_code=None,
            response_time_ms=None,
            error_message=f"Connection failed: {str(e)[:200]}",
            checked_at=checked_at,
        )
    except Exception as e:
        return HealthCheckResult(
            service_name=service.name,
            service_url=service.url,
            is_healthy=False,
            status_code=None,
            response_time_ms=None,
            error_message=f"Error: {str(e)[:200]}",
            checked_at=checked_at,
        )


async def check_all_services(
    db: AsyncSession,
    save_results: bool = True,
) -> MonitoringResponse:
    """Check health of all monitored services."""
    async with httpx.AsyncClient() as client:
        # Run all health checks concurrently
        tasks = [check_service_health(client, service) for service in MONITORED_SERVICES]
        results = await asyncio.gather(*tasks)

    # Save results to database
    if save_results:
        for result in results:
            health_check = ServiceHealthCheck(
                service_name=result.service_name,
                service_url=result.service_url,
                is_healthy=result.is_healthy,
                status_code=result.status_code,
                response_time_ms=result.response_time_ms,
                error_message=result.error_message,
                checked_at=result.checked_at,
            )
            db.add(health_check)
        await db.commit()

    # Calculate uptime stats for each service
    services_status = []
    for result in results:
        uptime_stats = await get_uptime_stats(db, result.service_name)
        services_status.append(ServiceStatus(
            service_name=result.service_name,
            service_url=result.service_url,
            is_healthy=result.is_healthy,
            status_code=result.status_code,
            response_time_ms=result.response_time_ms,
            error_message=result.error_message,
            last_checked=result.checked_at,
            **uptime_stats,
        ))

    overall_healthy = all(s.is_healthy for s in services_status)

    return MonitoringResponse(
        services=services_status,
        overall_healthy=overall_healthy,
        checked_at=datetime.now(timezone.utc),
    )


async def get_uptime_stats(db: AsyncSession, service_name: str) -> dict:
    """Calculate uptime statistics for a service."""
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)

    # 24-hour stats
    stmt_24h = select(
        func.count(ServiceHealthCheck.id).label("total"),
        func.sum(ServiceHealthCheck.is_healthy.cast(Integer)).label("healthy"),
    ).where(
        and_(
            ServiceHealthCheck.service_name == service_name,
            ServiceHealthCheck.checked_at >= day_ago,
        )
    )
    result_24h = await db.execute(stmt_24h)
    row_24h = result_24h.one()

    total_24h = row_24h.total or 0
    healthy_24h = row_24h.healthy or 0
    uptime_24h = (healthy_24h / total_24h * 100) if total_24h > 0 else None

    # 7-day stats
    stmt_7d = select(
        func.count(ServiceHealthCheck.id).label("total"),
        func.sum(ServiceHealthCheck.is_healthy.cast(Integer)).label("healthy"),
    ).where(
        and_(
            ServiceHealthCheck.service_name == service_name,
            ServiceHealthCheck.checked_at >= week_ago,
        )
    )
    result_7d = await db.execute(stmt_7d)
    row_7d = result_7d.one()

    total_7d = row_7d.total or 0
    healthy_7d = row_7d.healthy or 0
    uptime_7d = (healthy_7d / total_7d * 100) if total_7d > 0 else None

    return {
        "uptime_24h": round(uptime_24h, 2) if uptime_24h is not None else None,
        "uptime_7d": round(uptime_7d, 2) if uptime_7d is not None else None,
        "total_checks_24h": total_24h,
        "healthy_checks_24h": healthy_24h,
    }


async def get_service_history(
    db: AsyncSession,
    service_name: str,
    limit: int = 100,
) -> list[HealthCheckResult]:
    """Get health check history for a specific service."""
    stmt = (
        select(ServiceHealthCheck)
        .where(ServiceHealthCheck.service_name == service_name)
        .order_by(ServiceHealthCheck.checked_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    checks = result.scalars().all()

    return [
        HealthCheckResult(
            service_name=check.service_name,
            service_url=check.service_url,
            is_healthy=check.is_healthy,
            status_code=check.status_code,
            response_time_ms=check.response_time_ms,
            error_message=check.error_message,
            checked_at=check.checked_at,
        )
        for check in checks
    ]


async def get_latest_status(db: AsyncSession) -> MonitoringResponse:
    """Get the latest status for all services without performing new checks."""
    services_status = []
    now = datetime.now(timezone.utc)

    for service in MONITORED_SERVICES:
        # Get latest check for this service
        stmt = (
            select(ServiceHealthCheck)
            .where(ServiceHealthCheck.service_name == service.name)
            .order_by(ServiceHealthCheck.checked_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        latest = result.scalar_one_or_none()

        uptime_stats = await get_uptime_stats(db, service.name)

        if latest:
            services_status.append(ServiceStatus(
                service_name=service.name,
                service_url=service.url,
                is_healthy=latest.is_healthy,
                status_code=latest.status_code,
                response_time_ms=latest.response_time_ms,
                error_message=latest.error_message,
                last_checked=latest.checked_at,
                **uptime_stats,
            ))
        else:
            # No checks yet
            services_status.append(ServiceStatus(
                service_name=service.name,
                service_url=service.url,
                is_healthy=False,
                error_message="No checks performed yet",
                **uptime_stats,
            ))

    overall_healthy = all(s.is_healthy for s in services_status if s.last_checked)

    return MonitoringResponse(
        services=services_status,
        overall_healthy=overall_healthy,
        checked_at=now,
    )
