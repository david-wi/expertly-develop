"""Quick start schemas."""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field

from app.schemas.environment import Credentials


class QuickStartCreate(BaseModel):
    """Schema for starting a quick start session."""

    url: str = Field(..., min_length=1, max_length=500)
    credentials: Optional[Credentials] = None
    max_pages: int = Field(default=5, ge=1, le=20)


class PageInfo(BaseModel):
    """Information about an explored page."""

    url: str
    title: str
    screenshot_path: str
    links_count: int
    forms_count: int
    buttons_count: int
    errors_count: int
    load_time_ms: int


class SuggestedTest(BaseModel):
    """AI-suggested test case."""

    title: str
    description: str
    preconditions: str
    steps: list[dict]
    expected_results: str
    priority: str
    tags: list[str]
    execution_type: str


class Issue(BaseModel):
    """Detected issue during exploration."""

    url: str
    type: str
    message: str
    severity: str


class QuickStartResults(BaseModel):
    """Results from quick start exploration."""

    pages_explored: int
    pages: list[PageInfo]
    suggested_tests: list[SuggestedTest]
    issues: list[Issue]
    ai_available: bool


class QuickStartResponse(BaseModel):
    """Schema for quick start session response."""

    id: str
    url: str
    status: str
    progress: float
    progress_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuickStartResultResponse(QuickStartResponse):
    """Schema for quick start session with results."""

    results: Optional[QuickStartResults] = None
    project_id: Optional[str] = None
