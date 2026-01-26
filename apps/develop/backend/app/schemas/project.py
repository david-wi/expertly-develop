"""Project schemas for API requests/responses."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.project import Visibility


class SiteCredentialsInput(BaseModel):
    """Input schema for site credentials."""

    username: Optional[str] = None
    password: Optional[str] = None
    login_url: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None


class ProjectCreate(BaseModel):
    """Schema for creating a project."""

    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    visibility: Visibility = Visibility.PRIVATE
    site_url: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    visibility: Optional[Visibility] = None
    site_url: Optional[str] = None


class ProjectResponse(BaseModel):
    """Schema for project response."""

    id: str
    name: str
    description: Optional[str]
    visibility: str
    site_url: Optional[str]
    has_credentials: bool
    is_owner: bool = False
    can_edit: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Schema for project list response."""

    items: List[ProjectResponse]
    total: int
    limit: int
    offset: int
