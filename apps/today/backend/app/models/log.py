"""Log model - audit trail."""

from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class LogActor:
    """Log actor constants."""
    CLAUDE = "claude"
    USER = "user"
    SYSTEM = "system"

    ALL = [CLAUDE, USER, SYSTEM]


class Log(Base, TimestampMixin):
    """Log records all actions for audit trail."""

    __tablename__ = "logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # When & Who
    timestamp = Column(String(50), nullable=False)
    actor = Column(String(50), default=LogActor.CLAUDE, nullable=False)

    # What
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)

    # Details
    details = Column(JSONB, default=dict, nullable=False)

    # Context
    session_id = Column(String(100), nullable=True)

    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User", back_populates="logs")

    def __repr__(self) -> str:
        return f"<Log {self.action} on {self.entity_type}>"

    @classmethod
    def create(
        cls,
        tenant_id: uuid.UUID,
        action: str,
        entity_type: str = None,
        entity_id: uuid.UUID = None,
        user_id: uuid.UUID = None,
        actor: str = LogActor.CLAUDE,
        details: dict = None,
        session_id: str = None,
    ) -> "Log":
        """Create a new log entry."""
        return cls(
            tenant_id=tenant_id,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
            session_id=session_id,
        )
