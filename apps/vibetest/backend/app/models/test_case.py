"""Test case models."""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin, generate_uuid


class TestCase(Base, TimestampMixin, SoftDeleteMixin):
    """TestCase represents a single test to be executed."""

    __tablename__ = "test_cases"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    preconditions = Column(Text, nullable=True)
    steps = Column(JSONB, default=list)
    expected_results = Column(Text, nullable=True)
    tags = Column(JSONB, default=list)
    priority = Column(String(50), default="medium", nullable=False)
    status = Column(String(50), default="draft", nullable=False)
    execution_type = Column(String(50), default="manual", nullable=False)
    automation_config = Column(JSONB, nullable=True)
    created_by = Column(String(50), default="human", nullable=False)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="test_cases")
    results = relationship("TestResult", back_populates="test_case", cascade="all, delete-orphan")
    history = relationship("TestCaseHistory", back_populates="test_case", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TestCase {self.title[:50]}>"


class TestCaseHistory(Base):
    """Version history for test cases."""

    __tablename__ = "test_cases_history"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    test_case_id = Column(UUID(as_uuid=False), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    changed_by = Column(String(255), nullable=True)
    changed_at = Column(DateTime, nullable=False)
    previous_data = Column(JSONB, nullable=True)
    change_type = Column(String(50), nullable=False)

    # Relationships
    test_case = relationship("TestCase", back_populates="history")

    def __repr__(self) -> str:
        return f"<TestCaseHistory {self.test_case_id} - {self.change_type}>"
