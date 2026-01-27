"""Test suite schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TestSuiteCreate(BaseModel):
    """Schema for creating a test suite."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    type: str = Field(default="custom", pattern="^(smoke|regression|critical|custom)$")
    test_case_ids: list[str] = Field(default_factory=list)


class TestSuiteUpdate(BaseModel):
    """Schema for updating a test suite."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    type: Optional[str] = Field(None, pattern="^(smoke|regression|critical|custom)$")
    test_case_ids: Optional[list[str]] = None


class TestSuiteResponse(BaseModel):
    """Schema for test suite response."""

    id: str
    project_id: str
    name: str
    description: Optional[str]
    type: str
    test_case_ids: list[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
