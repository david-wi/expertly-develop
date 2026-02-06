from enum import Enum
from typing import Optional, List
from pydantic import BaseModel

from app.models.base import MongoModel, PyObjectId


class BacklogStatus(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    ARCHIVED = "archived"


class BacklogPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class BacklogCategory(str, Enum):
    BACKLOG = "backlog"
    IDEA = "idea"


class BacklogItem(MongoModel):
    """Backlog item model for tracking work items and ideas."""
    organization_id: str  # UUID from Identity service
    title: str
    description: Optional[str] = None
    status: BacklogStatus = BacklogStatus.NEW
    priority: BacklogPriority = BacklogPriority.MEDIUM
    category: BacklogCategory = BacklogCategory.BACKLOG
    tags: List[str] = []
    created_by: Optional[str] = None  # UUID from Identity service


class BacklogItemCreate(BaseModel):
    """Schema for creating a backlog item."""
    title: str
    description: Optional[str] = None
    status: Optional[BacklogStatus] = None
    priority: Optional[BacklogPriority] = None
    category: Optional[BacklogCategory] = None
    tags: Optional[List[str]] = None


class BacklogItemUpdate(BaseModel):
    """Schema for updating a backlog item."""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[BacklogStatus] = None
    priority: Optional[BacklogPriority] = None
    category: Optional[BacklogCategory] = None
    tags: Optional[List[str]] = None
