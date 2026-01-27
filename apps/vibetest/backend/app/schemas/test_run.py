"""Test run schemas."""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class RunSummary(BaseModel):
    """Summary of a test run."""

    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    duration_ms: Optional[int] = None


class TestRunCreate(BaseModel):
    """Schema for creating a test run."""

    environment_id: Optional[str] = None
    suite_id: Optional[str] = None
    test_case_ids: Optional[list[str]] = None
    name: Optional[str] = None
    triggered_by: str = Field(default="manual", pattern="^(manual|schedule|webhook)$")


class TestRunResponse(BaseModel):
    """Schema for test run response."""

    id: str
    project_id: str
    environment_id: Optional[str]
    suite_id: Optional[str]
    name: Optional[str]
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    summary: Optional[RunSummary]
    triggered_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestRunDetailResponse(TestRunResponse):
    """Schema for detailed test run response."""

    results: list[Any] = Field(default_factory=list)
    environment: Optional[Any] = None
