"""Pydantic schemas for error logs."""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field


class ErrorSeverity(str, Enum):
    """Error severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class ErrorStatus(str, Enum):
    """Error log status."""
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class ErrorLogCreate(BaseModel):
    """Schema for creating a new error log entry."""

    app_name: str = Field(..., min_length=1, max_length=50)
    error_message: str = Field(..., min_length=1)
    stack_trace: Optional[str] = None
    url: Optional[str] = Field(None, max_length=500)

    # User context (optional)
    user_id: Optional[UUID] = None
    user_email: Optional[str] = Field(None, max_length=255)
    org_id: Optional[UUID] = None

    # Browser info
    browser_info: Optional[str] = Field(None, max_length=500)

    # Additional context
    additional_context: Optional[dict[str, Any]] = None

    # Classification
    severity: ErrorSeverity = ErrorSeverity.ERROR

    # When the error occurred (defaults to now on server)
    occurred_at: Optional[datetime] = None


class ErrorLogUpdate(BaseModel):
    """Schema for updating an error log entry (mainly status changes)."""

    status: Optional[ErrorStatus] = None


class ErrorLogResponse(BaseModel):
    """Schema for error log response."""

    id: UUID
    app_name: str
    error_message: str
    stack_trace: Optional[str]
    url: Optional[str]
    user_id: Optional[UUID]
    user_email: Optional[str]
    org_id: Optional[UUID]
    browser_info: Optional[str]
    additional_context: Optional[dict[str, Any]]
    severity: str
    status: str
    occurred_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ErrorLogListResponse(BaseModel):
    """Schema for paginated error log list."""

    errors: list[ErrorLogResponse]
    total: int


class AppErrorCount(BaseModel):
    """Error count for a specific app."""

    app_name: str
    count: int


class StatusErrorCount(BaseModel):
    """Error count for a specific status."""

    status: str
    count: int


class SeverityErrorCount(BaseModel):
    """Error count for a specific severity."""

    severity: str
    count: int


class ErrorStatsResponse(BaseModel):
    """Schema for error statistics."""

    total: int
    by_app: list[AppErrorCount]
    by_status: list[StatusErrorCount]
    by_severity: list[SeverityErrorCount]
    last_24h: int
    last_7d: int
