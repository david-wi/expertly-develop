"""WaitingItem model - external dependencies."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID


class WaitingStatus:
    """Waiting item status constants."""
    WAITING = "waiting"
    RESOLVED = "resolved"
    ABANDONED = "abandoned"

    ALL = [WAITING, RESOLVED, ABANDONED]


class WaitingItem(Base, TimestampMixin):
    """WaitingItem represents something pending externally."""

    __tablename__ = "waiting_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    person_id = Column(
        UUID(as_uuid=True),
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    # What we're waiting for
    what = Column(Text, nullable=False)
    who = Column(String(255), nullable=True)

    # Timeline
    since = Column(String(50), nullable=True)
    follow_up_date = Column(String(50), nullable=True)

    # Context
    why_it_matters = Column(Text, nullable=True)

    # Status
    status = Column(String(50), default=WaitingStatus.WAITING, nullable=False)
    resolved_at = Column(String(50), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    task = relationship("Task")
    person = relationship("Person")

    def __repr__(self) -> str:
        return f"<WaitingItem {self.what[:30]}... ({self.status})>"
