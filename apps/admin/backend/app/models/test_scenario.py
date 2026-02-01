"""Test scenario models for tracking test definitions and results."""

import uuid
from enum import Enum

from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUID, JSONB


class TestCategory(str, Enum):
    """Test category types."""
    SMOKE = "smoke"
    INTEGRATION = "integration"
    E2E = "e2e"
    UNIT = "unit"


class TestRunStatus(str, Enum):
    """Test run status."""
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RUNNING = "running"


class TestScenario(Base, TimestampMixin):
    """Model for test scenario definitions with step-by-step descriptions."""

    __tablename__ = "test_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Unique key for this scenario (e.g., "manage.bot-workflow")
    scenario_key = Column(String(100), unique=True, nullable=False, index=True)

    # Human-readable name
    name = Column(String(200), nullable=False)

    # Detailed description of what this test verifies
    description = Column(Text, nullable=True)

    # Which app this test belongs to
    app_name = Column(String(50), nullable=False, index=True)

    # Test category
    category = Column(String(20), nullable=False, default=TestCategory.E2E.value)

    # Path to the test file (relative to repo root)
    test_file = Column(String(500), nullable=True)

    # Step-by-step descriptions in plain English
    # Format: [{"step_number": 1, "description": "...", "expected_outcome": "..."}]
    steps = Column(JSONB, nullable=True)

    # Whether this scenario is currently active
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    runs = relationship("TestRun", back_populates="scenario", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_test_scenarios_app_category', 'app_name', 'category'),
    )

    def __repr__(self) -> str:
        return f"<TestScenario {self.scenario_key}: {self.name}>"


class TestRun(Base, TimestampMixin):
    """Model for individual test run results."""

    __tablename__ = "test_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Which scenario this run belongs to
    scenario_id = Column(UUID(as_uuid=True), ForeignKey("test_scenarios.id"), nullable=False, index=True)

    # Overall status of this run
    status = Column(String(20), nullable=False, default=TestRunStatus.RUNNING.value)

    # Total duration in milliseconds
    duration_ms = Column(Integer, nullable=True)

    # Which step failed (1-indexed, null if passed or skipped)
    failed_step = Column(Integer, nullable=True)

    # Error message if failed
    error_message = Column(Text, nullable=True)

    # Full error stack trace
    error_stack = Column(Text, nullable=True)

    # Per-step results
    # Format: [{"step_number": 1, "status": "passed", "duration_ms": 100, "error": null}]
    step_results = Column(JSONB, nullable=True)

    # Environment where this ran
    environment = Column(String(50), nullable=True)  # ci, local, production

    # External run identifier (e.g., GitHub Actions run ID)
    run_id = Column(String(100), nullable=True, index=True)

    # Timestamp when the run started
    started_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamp when the run completed
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    scenario = relationship("TestScenario", back_populates="runs")

    __table_args__ = (
        Index('ix_test_runs_scenario_status', 'scenario_id', 'status'),
        Index('ix_test_runs_environment', 'environment'),
    )

    def __repr__(self) -> str:
        return f"<TestRun {self.id}: {self.status}>"
