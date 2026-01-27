"""Project schemas."""
from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class ProjectSettings(BaseModel):
    """Project settings."""

    modules: list[str] = Field(default_factory=list)
    default_environment_id: Optional[str] = None
    notifications: dict[str, Any] = Field(default_factory=dict)


class ProjectCreate(BaseModel):
    """Schema for creating a project."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    settings: Optional[ProjectSettings] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    settings: Optional[ProjectSettings] = None
    status: Optional[str] = Field(None, pattern="^(active|archived)$")


class ProjectResponse(BaseModel):
    """Schema for project response."""

    id: str
    name: str
    description: Optional[str]
    settings: Optional[dict]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectStats(BaseModel):
    """Project statistics."""

    total_tests: int = 0
    approved_tests: int = 0
    draft_tests: int = 0
    total_runs: int = 0
    passed_runs: int = 0
    failed_runs: int = 0


class ProjectListResponse(BaseModel):
    """Schema for project list response."""

    projects: list[ProjectResponse]
    total: int


class ProjectDetailResponse(ProjectResponse):
    """Schema for detailed project response."""

    stats: ProjectStats
    environments: list[Any] = Field(default_factory=list)
    recent_runs: list[Any] = Field(default_factory=list)
