from enum import Enum
from typing import Optional
from pydantic import BaseModel

from app.models.base import MongoModel, PyObjectId


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Project(MongoModel):
    """Project model - hierarchical containers for tasks."""
    organization_id: PyObjectId
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.ACTIVE

    # Hierarchy
    parent_project_id: Optional[PyObjectId] = None

    # Ownership
    owner_user_id: Optional[PyObjectId] = None
    team_id: Optional[PyObjectId] = None


class ProjectCreate(BaseModel):
    """Schema for creating a project."""
    name: str
    description: Optional[str] = None
    parent_project_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    parent_project_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None
