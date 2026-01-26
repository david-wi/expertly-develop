"""Pydantic schemas for monitoring."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ServiceConfig(BaseModel):
    """Configuration for a service to monitor."""
    name: str
    url: str
    health_endpoint: str = "/health"


class HealthCheckResult(BaseModel):
    """Result of a single health check."""
    service_name: str
    service_url: str
    is_healthy: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    checked_at: datetime

    class Config:
        from_attributes = True


class ServiceStatus(BaseModel):
    """Current status of a service with uptime stats."""
    service_name: str
    service_url: str
    is_healthy: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    last_checked: Optional[datetime] = None
    uptime_24h: Optional[float] = None  # Percentage
    uptime_7d: Optional[float] = None  # Percentage
    total_checks_24h: int = 0
    healthy_checks_24h: int = 0


class MonitoringResponse(BaseModel):
    """Response containing all service statuses."""
    services: list[ServiceStatus]
    overall_healthy: bool
    checked_at: datetime


class HealthHistoryResponse(BaseModel):
    """Response containing health check history for a service."""
    service_name: str
    checks: list[HealthCheckResult]
    total: int
