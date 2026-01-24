"""Project schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional


class ProjectBase(BaseModel):
    """Base project schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    project_type: str = Field(default="project", pattern=r"^(project|initiative|goal)$")
    status: str = Field(default="active", pattern=r"^(active|on_hold|completed|archived)$")
    priority_order: int = Field(default=0)
    success_criteria: Optional[str] = None
    target_date: Optional[date] = None
    parent_id: Optional[UUID] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a project."""
    pass


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    project_type: Optional[str] = Field(None, pattern=r"^(project|initiative|goal)$")
    status: Optional[str] = Field(None, pattern=r"^(active|on_hold|completed|archived)$")
    priority_order: Optional[int] = None
    success_criteria: Optional[str] = None
    target_date: Optional[date] = None
    parent_id: Optional[UUID] = None


class ProjectResponse(ProjectBase):
    """Schema for project response."""
    id: UUID
    tenant_id: UUID
    user_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
