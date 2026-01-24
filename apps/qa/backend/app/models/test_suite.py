"""Test suite model."""
from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class TestSuite(Base, TimestampMixin):
    """TestSuite is a collection of test cases."""

    __tablename__ = "test_suites"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), default="custom", nullable=False)  # smoke, regression, critical, custom
    test_case_ids = Column(JSONB, default=list)

    # Relationships
    project = relationship("Project", back_populates="test_suites")
    test_runs = relationship("TestRun", back_populates="suite")

    def __repr__(self) -> str:
        return f"<TestSuite {self.name}>"
