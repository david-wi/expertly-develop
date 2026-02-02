"""RecurringTask model - scheduled work templates."""

from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class RecurringFrequency:
    """Recurring frequency constants."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"

    ALL = [DAILY, WEEKLY, MONTHLY, CUSTOM]


class RecurringTask(Base, TimestampMixin):
    """RecurringTask represents scheduled work that runs automatically."""

    __tablename__ = "recurring_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Organization ID from Identity service
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Template
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    task_template = Column(JSONB, nullable=False)

    # Schedule
    frequency = Column(String(50), nullable=False)
    cron_expression = Column(String(100), nullable=True)

    # Tracking
    last_run = Column(String(50), nullable=True)
    next_run = Column(String(50), nullable=False)

    # Control
    active = Column(Boolean, default=True, nullable=False)

    # Tenant now comes from Identity service

    def __repr__(self) -> str:
        return f"<RecurringTask {self.title} ({self.frequency})>"
