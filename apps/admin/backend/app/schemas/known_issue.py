"""Pydantic schemas for known issues."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field


class IssueSeverity(str, Enum):
    """Issue severity levels."""
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    COSMETIC = "cosmetic"


class IssueStatus(str, Enum):
    """Known issue status."""
    OPEN = "open"
    INVESTIGATING = "investigating"
    WORKAROUND = "workaround"
    RESOLVED = "resolved"


class KnownIssueCreate(BaseModel):
    """Schema for creating a new known issue."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    app_name: Optional[str] = Field(None, max_length=50)
    severity: IssueSeverity = IssueSeverity.MINOR
    status: IssueStatus = IssueStatus.OPEN
    workaround: Optional[str] = None
    affected_version: Optional[str] = Field(None, max_length=50)


class KnownIssueUpdate(BaseModel):
    """Schema for updating a known issue."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, min_length=1)
    app_name: Optional[str] = Field(None, max_length=50)
    severity: Optional[IssueSeverity] = None
    status: Optional[IssueStatus] = None
    workaround: Optional[str] = None
    affected_version: Optional[str] = Field(None, max_length=50)
    resolved_version: Optional[str] = Field(None, max_length=50)
    resolved_at: Optional[datetime] = None


class KnownIssueResponse(BaseModel):
    """Schema for known issue response."""

    id: UUID
    title: str
    description: str
    app_name: Optional[str]
    severity: str
    status: str
    workaround: Optional[str]
    affected_version: Optional[str]
    resolved_version: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
