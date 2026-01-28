"""Error log model for centralized error tracking across Expertly apps."""

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, String, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.models.base import Base, TimestampMixin, UUID, JSONB


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


class ErrorLog(Base, TimestampMixin):
    """Model for tracking errors across all Expertly applications."""

    __tablename__ = "error_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Source identification
    app_name = Column(String(50), nullable=False, index=True)

    # Error details
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)

    # User context (optional - may not be authenticated)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    user_email = Column(String(255), nullable=True)
    org_id = Column(UUID(as_uuid=True), nullable=True)

    # Browser/client info
    browser_info = Column(String(500), nullable=True)

    # Flexible additional context
    additional_context = Column(JSONB, nullable=True)

    # Classification
    severity = Column(String(20), nullable=False, default=ErrorSeverity.ERROR.value)
    status = Column(String(20), nullable=False, default=ErrorStatus.NEW.value)

    # Timestamps
    occurred_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index('ix_error_logs_status', 'status'),
        Index('ix_error_logs_severity', 'severity'),
        Index('ix_error_logs_app_status', 'app_name', 'status'),
    )

    def __repr__(self) -> str:
        return f"<ErrorLog {self.app_name}: {self.error_message[:50]}...>"
