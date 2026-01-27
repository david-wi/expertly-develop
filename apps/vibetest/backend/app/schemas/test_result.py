"""Test result schemas."""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class StepResult(BaseModel):
    """Result of a single test step."""

    step: dict
    status: str  # passed, failed, skipped
    duration_ms: int
    error: Optional[str] = None
    screenshot_path: Optional[str] = None


class AIAnalysis(BaseModel):
    """AI analysis of a test failure."""

    summary: str
    likely_root_cause: str
    suggested_fix: str
    confidence: float


class ArtifactInfo(BaseModel):
    """Artifact reference."""

    id: str
    type: str
    file_path: str


class TestResultResponse(BaseModel):
    """Schema for test result response."""

    id: str
    run_id: str
    test_case_id: str
    status: str
    duration_ms: Optional[int]
    error_message: Optional[str]
    steps_executed: Optional[list[StepResult]]
    ai_analysis: Optional[AIAnalysis]
    artifacts: list[ArtifactInfo] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
