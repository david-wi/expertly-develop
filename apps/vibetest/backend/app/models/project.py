"""Project model."""
from sqlalchemy import Column, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, generate_uuid


class Project(Base, TimestampMixin, SoftDeleteMixin):
    """Project represents a product or service being tested."""

    __tablename__ = "projects"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    # Organization ID from Identity service (UUID string, no FK)
    organization_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    settings = Column(JSONB, default=dict)
    status = Column(String(50), default="active", nullable=False)

    # Relationships (Organization now comes from Identity service)
    environments = relationship("Environment", back_populates="project", cascade="all, delete-orphan")
    test_cases = relationship("TestCase", back_populates="project", cascade="all, delete-orphan")
    test_suites = relationship("TestSuite", back_populates="project", cascade="all, delete-orphan")
    test_runs = relationship("TestRun", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Project {self.name}>"
