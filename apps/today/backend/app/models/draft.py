"""Draft model - content awaiting review."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class DraftType:
    """Draft type constants."""
    EMAIL = "email"
    SLACK = "slack"
    DOCUMENT = "document"
    NOTE = "note"

    ALL = [EMAIL, SLACK, DOCUMENT, NOTE]


class DraftStatus:
    """Draft status constants."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SENT = "sent"
    REVISED = "revised"

    ALL = [PENDING, APPROVED, REJECTED, SENT, REVISED]


class Draft(Base, TimestampMixin):
    """
    Draft represents content awaiting user review.

    Includes relationship context snapshot from when it was drafted.
    """

    __tablename__ = "drafts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Organization ID from Identity service
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    # User ID from Identity service
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Draft content
    type = Column(String(50), nullable=False)
    recipient = Column(String(255), nullable=True)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)

    # Status workflow
    status = Column(String(50), default=DraftStatus.PENDING, nullable=False)

    # Feedback loop
    feedback = Column(Text, nullable=True)
    revision_of_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drafts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationship context used when drafting
    relationship_context = Column(JSONB, nullable=True)

    # Timestamps for workflow
    approved_at = Column(String(50), nullable=True)
    sent_at = Column(String(50), nullable=True)

    # Relationships (User/Tenant now from Identity service)
    task = relationship("Task", back_populates="drafts")
    revision_of = relationship("Draft", remote_side=[id], backref="revisions")

    def __repr__(self) -> str:
        return f"<Draft {self.type}: {self.subject or 'No subject'} ({self.status})>"
