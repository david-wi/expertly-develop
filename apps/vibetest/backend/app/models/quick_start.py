"""Quick start session model."""
from sqlalchemy import Column, String, Text, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class QuickStartSession(Base, TimestampMixin):
    """QuickStartSession tracks URL exploration for quick setup."""

    __tablename__ = "quick_start_sessions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    organization_id = Column(
        UUID(as_uuid=False),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True  # Nullable for sessions without auth
    )
    url = Column(String(500), nullable=False)
    credentials_encrypted = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False)  # pending, exploring, generating, completed, failed
    progress = Column(Float, default=0, nullable=False)  # 0-100
    progress_message = Column(Text, nullable=True)
    results = Column(JSONB, nullable=True)  # Pages, suggested tests, issues
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    project = relationship("Project")

    def __repr__(self) -> str:
        return f"<QuickStartSession {self.id} - {self.status}>"
