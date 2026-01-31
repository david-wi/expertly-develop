"""Pydantic schemas for ideas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field


class IdeaStatus(str, Enum):
    """Idea status levels."""
    NEW = "new"
    EXPLORING = "in_progress"
    IMPLEMENTED = "done"
    ARCHIVED = "archived"


class IdeaPriority(str, Enum):
    """Idea priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# Valid products for ideas
VALID_PRODUCTS = [
    "admin",
    "define",
    "develop",
    "manage",
    "salon",
    "today",
    "vibecode",
    "vibetest",
    "chem",
]


class IdeaCreate(BaseModel):
    """Schema for creating a new idea."""

    product: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    status: IdeaStatus = IdeaStatus.NEW
    priority: IdeaPriority = IdeaPriority.MEDIUM
    tags: Optional[List[str]] = Field(default_factory=list)
    created_by_email: Optional[str] = Field(None, max_length=255)


class IdeaUpdate(BaseModel):
    """Schema for updating an idea."""

    product: Optional[str] = Field(None, min_length=1, max_length=50)
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[IdeaStatus] = None
    priority: Optional[IdeaPriority] = None
    tags: Optional[List[str]] = None


class IdeaResponse(BaseModel):
    """Schema for idea response."""

    id: UUID
    product: str
    title: str
    description: Optional[str]
    status: str
    priority: str
    tags: Optional[List[str]]
    created_by_email: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IdeaListResponse(BaseModel):
    """Schema for list of ideas response."""

    items: List[IdeaResponse]
    total: int


# Aliases for consistency with other schemas
IdeaStatusEnum = IdeaStatus
IdeaPriorityEnum = IdeaPriority
