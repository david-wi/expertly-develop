"""Knowledge model - captured learnings."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID


class KnowledgeCategory:
    """Knowledge category constants."""
    PLAYBOOK = "playbook"
    PERSON = "person"
    CLIENT = "client"
    PROJECT = "project"
    SETTING = "setting"
    RULE = "rule"

    ALL = [PLAYBOOK, PERSON, CLIENT, PROJECT, SETTING, RULE]


class KnowledgeStatus:
    """Knowledge status constants."""
    CAPTURED = "captured"
    ROUTED = "routed"
    PENDING_REVIEW = "pending_review"
    DISMISSED = "dismissed"

    ALL = [CAPTURED, ROUTED, PENDING_REVIEW, DISMISSED]


class Knowledge(Base, TimestampMixin):
    """
    Knowledge captures learnings and routes them to the right entity.

    Part of the mandatory Learning Loop in the work cycle.
    """

    __tablename__ = "knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Organization ID from Identity service
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Source tracking
    source_task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_type = Column(String(50), nullable=False)  # task, conversation, trigger_phrase
    trigger_phrase = Column(String(255), nullable=True)

    # The learning itself
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)

    # Routing result
    routed_to_type = Column(String(50), nullable=True)
    routed_to_id = Column(UUID(as_uuid=True), nullable=True)

    # Status
    status = Column(String(50), default=KnowledgeStatus.CAPTURED, nullable=False)

    # Learned at timestamp
    learned_at = Column(String(50), nullable=True)

    # Relationships (Tenant now from Identity service)
    source_task = relationship("Task")

    def __repr__(self) -> str:
        return f"<Knowledge {self.category}: {self.content[:30]}...>"
