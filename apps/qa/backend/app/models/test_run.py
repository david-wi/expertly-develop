"""Test run model."""
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin, generate_uuid


class TestRun(Base, TimestampMixin):
    """TestRun represents a single execution of tests."""

    __tablename__ = "test_runs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    environment_id = Column(UUID(as_uuid=False), ForeignKey("environments.id", ondelete="SET NULL"), nullable=True)
    suite_id = Column(UUID(as_uuid=False), ForeignKey("test_suites.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=True)
    status = Column(String(50), default="pending", nullable=False)  # pending, running, completed, failed, cancelled
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    summary = Column(JSONB, nullable=True)  # {total, passed, failed, skipped, duration}
    triggered_by = Column(String(50), default="manual", nullable=False)  # manual, schedule, webhook

    # Relationships
    project = relationship("Project", back_populates="test_runs")
    environment = relationship("Environment", back_populates="test_runs")
    suite = relationship("TestSuite", back_populates="test_runs")
    results = relationship("TestResult", back_populates="run", cascade="all, delete-orphan")
    artifacts = relationship("Artifact", back_populates="run", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TestRun {self.id} - {self.status}>"
