"""Environment model."""
from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Environment(Base, TimestampMixin):
    """Environment represents a target instance (staging, QA, production)."""

    __tablename__ = "environments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), default="staging", nullable=False)
    base_url = Column(String(500), nullable=False)
    credentials_encrypted = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="environments")
    test_runs = relationship("TestRun", back_populates="environment")

    def __repr__(self) -> str:
        return f"<Environment {self.name} ({self.type})>"
