"""Test case schemas."""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class TestStep(BaseModel):
    """A single test step."""

    action: str = Field(..., pattern="^(navigate|click|type|select|wait|verify|screenshot|api_call)$")
    selector: Optional[str] = None
    value: Optional[str] = None
    expected: Optional[str] = None
    timeout: Optional[int] = None


class AutomationConfig(BaseModel):
    """Configuration for automated test execution."""

    steps: list[TestStep] = Field(default_factory=list)
    start_url: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_method: Optional[str] = None
    api_body: Optional[dict] = None
    api_headers: Optional[dict] = None


class TestCaseCreate(BaseModel):
    """Schema for creating a test case."""

    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: list[TestStep] = Field(default_factory=list)
    expected_results: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    priority: str = Field(default="medium", pattern="^(critical|high|medium|low)$")
    status: str = Field(default="draft", pattern="^(draft|approved|archived)$")
    execution_type: str = Field(default="manual", pattern="^(manual|browser|api|visual)$")
    automation_config: Optional[AutomationConfig] = None
    created_by: str = Field(default="human", pattern="^(human|ai)$")


class TestCaseUpdate(BaseModel):
    """Schema for updating a test case."""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    preconditions: Optional[str] = None
    steps: Optional[list[TestStep]] = None
    expected_results: Optional[str] = None
    tags: Optional[list[str]] = None
    priority: Optional[str] = Field(None, pattern="^(critical|high|medium|low)$")
    status: Optional[str] = Field(None, pattern="^(draft|approved|archived)$")
    execution_type: Optional[str] = Field(None, pattern="^(manual|browser|api|visual)$")
    automation_config: Optional[AutomationConfig] = None


class TestCaseResponse(BaseModel):
    """Schema for test case response."""

    id: str
    project_id: str
    title: str
    description: Optional[str]
    preconditions: Optional[str]
    steps: list[dict]
    expected_results: Optional[str]
    tags: list[str]
    priority: str
    status: str
    execution_type: str
    automation_config: Optional[dict]
    created_by: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
