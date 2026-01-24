"""Playbook model - procedures and knowledge."""

from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB, StringArray


class PlaybookStatus:
    """Playbook status constants."""
    ACTIVE = "active"
    PROPOSED = "proposed"
    ARCHIVED = "archived"

    ALL = [ACTIVE, PROPOSED, ARCHIVED]


class Playbook(Base, TimestampMixin):
    """
    Playbook represents a procedure or how-to guide.

    Supports must_consult flag for critical procedures that must always be checked.
    """

    __tablename__ = "playbooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Identity
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)  # scheduling, communication, sales, technical

    # Triggering
    triggers = Column(StringArray, default=list, nullable=False)
    must_consult = Column(Boolean, default=False, nullable=False)

    # Content (markdown)
    content = Column(Text, nullable=False)

    # Supporting resources
    scripts = Column(JSONB, default=dict, nullable=False)
    references = Column(JSONB, default=dict, nullable=False)
    examples = Column(JSONB, default=list, nullable=False)

    # Learning audit trail
    learned_from = Column(Text, nullable=True)
    source_task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Usage tracking
    last_used = Column(String(50), nullable=True)
    use_count = Column(Integer, default=0, nullable=False)

    # Status
    status = Column(String(50), default=PlaybookStatus.ACTIVE, nullable=False)

    # Relationships
    tenant = relationship("Tenant")

    def __repr__(self) -> str:
        return f"<Playbook {self.name}>"

    def matches_task(self, task_description: str) -> tuple[bool, str]:
        """
        Check if this playbook matches a task description.

        Returns (matched, reason) tuple.
        """
        task_lower = task_description.lower()

        # Check trigger phrases
        for trigger in self.triggers:
            if trigger.lower() in task_lower:
                return True, f"trigger: '{trigger}'"

        # Could add full-text search here
        return False, ""

    def record_use(self) -> None:
        """Record that this playbook was used."""
        from datetime import datetime, timezone
        self.last_used = datetime.now(timezone.utc).isoformat()
        self.use_count += 1
