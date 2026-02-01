"""Pydantic schemas for test scenarios."""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field


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


# Step schemas
class TestStepDefinition(BaseModel):
    """A single step in a test scenario definition."""
    step_number: int = Field(..., ge=1)
    description: str = Field(..., min_length=1)
    expected_outcome: Optional[str] = None


class TestStepResult(BaseModel):
    """Result of a single test step."""
    step_number: int = Field(..., ge=1)
    status: TestRunStatus
    duration_ms: Optional[int] = None
    error: Optional[str] = None


# TestScenario schemas
class TestScenarioCreate(BaseModel):
    """Schema for creating a new test scenario."""
    scenario_key: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    app_name: str = Field(..., min_length=1, max_length=50)
    category: TestCategory = TestCategory.E2E
    test_file: Optional[str] = Field(None, max_length=500)
    steps: Optional[list[TestStepDefinition]] = None
    is_active: bool = True


class TestScenarioUpdate(BaseModel):
    """Schema for updating a test scenario."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    app_name: Optional[str] = Field(None, min_length=1, max_length=50)
    category: Optional[TestCategory] = None
    test_file: Optional[str] = Field(None, max_length=500)
    steps: Optional[list[TestStepDefinition]] = None
    is_active: Optional[bool] = None


class TestRunResponse(BaseModel):
    """Schema for test run response."""
    id: UUID
    scenario_id: UUID
    status: str
    duration_ms: Optional[int]
    failed_step: Optional[int]
    error_message: Optional[str]
    error_stack: Optional[str]
    step_results: Optional[list[dict[str, Any]]]
    environment: Optional[str]
    run_id: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class TestScenarioResponse(BaseModel):
    """Schema for test scenario response."""
    id: UUID
    scenario_key: str
    name: str
    description: Optional[str]
    app_name: str
    category: str
    test_file: Optional[str]
    steps: Optional[list[dict[str, Any]]]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Include latest run if available
    latest_run: Optional[TestRunResponse] = None

    model_config = {"from_attributes": True}


class TestScenarioListResponse(BaseModel):
    """Schema for paginated test scenario list."""
    scenarios: list[TestScenarioResponse]
    total: int


# TestRun schemas
class TestRunCreate(BaseModel):
    """Schema for creating/reporting a test run."""
    scenario_key: str = Field(..., min_length=1, max_length=100)
    status: TestRunStatus
    duration_ms: Optional[int] = None
    failed_step: Optional[int] = None
    error_message: Optional[str] = None
    error_stack: Optional[str] = None
    step_results: Optional[list[TestStepResult]] = None
    environment: Optional[str] = Field(None, max_length=50)
    run_id: Optional[str] = Field(None, max_length=100)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TestRunListResponse(BaseModel):
    """Schema for paginated test run list."""
    runs: list[TestRunResponse]
    total: int


# Stats schemas
class AppScenarioCount(BaseModel):
    """Scenario count for a specific app."""
    app_name: str
    count: int


class CategoryScenarioCount(BaseModel):
    """Scenario count for a specific category."""
    category: str
    count: int


class StatusRunCount(BaseModel):
    """Run count for a specific status."""
    status: str
    count: int


class TestScenarioStatsResponse(BaseModel):
    """Schema for test scenario statistics."""
    total_scenarios: int
    active_scenarios: int
    by_app: list[AppScenarioCount]
    by_category: list[CategoryScenarioCount]
    run_stats: dict[str, Any]  # Contains passed, failed, skipped counts
