"""Service health check models for monitoring."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Float, DateTime

from app.models.base import Base, UUID


class ServiceHealthCheck(Base):
    """
    Stores health check results for monitored services.
    Each row represents a single health check at a point in time.
    """

    __tablename__ = "service_health_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Service identification
    service_name = Column(String(100), nullable=False, index=True)
    service_url = Column(String(500), nullable=False)

    # Health check results
    is_healthy = Column(Boolean, nullable=False)
    status_code = Column(Integer, nullable=True)  # HTTP status code
    response_time_ms = Column(Float, nullable=True)  # Response time in milliseconds
    error_message = Column(String(1000), nullable=True)  # Error details if unhealthy

    # Timestamp
    checked_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        status = "healthy" if self.is_healthy else "unhealthy"
        return f"<ServiceHealthCheck {self.service_name} ({status}) at {self.checked_at}>"
