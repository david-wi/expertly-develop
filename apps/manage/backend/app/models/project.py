from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectResource(BaseModel):
    """A resource link or file associated with a project."""
    title: str
    url: str
    type: str = "link"  # "link" or "file"


class ProjectCustomField(BaseModel):
    """A custom field for a project."""
    label: str
    value: str


class ProjectComment(BaseModel):
    """A comment on a project."""
    id: str  # UUID
    content: str  # HTML content for rich text
    author_id: str  # User ID
    author_name: str
    created_at: str  # ISO timestamp


class Project(MongoModel):
    """Project model - hierarchical containers for tasks."""
    organization_id: str  # UUID from Identity service
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.ACTIVE

    # Hierarchy - local MongoDB ObjectId
    parent_project_id: Optional[PyObjectId] = None

    # Ownership - UUIDs from Identity service
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None

    # Project details panel
    resources: list[ProjectResource] = Field(default_factory=list)
    custom_fields: list[ProjectCustomField] = Field(default_factory=list)
    next_steps: Optional[str] = None
    ai_suggestions: Optional[str] = None
    comments: list[ProjectComment] = Field(default_factory=list)

    # Avatar
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None  # Custom prompt for avatar generation


class ProjectCreate(BaseModel):
    """Schema for creating a project."""
    name: str
    description: Optional[str] = None
    parent_project_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None
    resources: Optional[list[ProjectResource]] = None
    custom_fields: Optional[list[ProjectCustomField]] = None
    next_steps: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    parent_project_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None
    resources: Optional[list[ProjectResource]] = None
    custom_fields: Optional[list[ProjectCustomField]] = None
    next_steps: Optional[str] = None
    ai_suggestions: Optional[str] = None
    comments: Optional[list[ProjectComment]] = None
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None
