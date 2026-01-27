"""Test result model."""
from sqlalchemy import Column, String, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class TestResult(Base, TimestampMixin):
    """TestResult represents the outcome of a single test execution."""

    __tablename__ = "test_results"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    run_id = Column(UUID(as_uuid=False), ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    test_case_id = Column(UUID(as_uuid=False), ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, running, passed, failed, skipped, error
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    steps_executed = Column(JSONB, nullable=True)  # Array of step results
    ai_analysis = Column(JSONB, nullable=True)  # AI failure analysis

    # Relationships
    run = relationship("TestRun", back_populates="results")
    test_case = relationship("TestCase", back_populates="results")
    artifacts = relationship("Artifact", back_populates="result", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TestResult {self.id} - {self.status}>"
