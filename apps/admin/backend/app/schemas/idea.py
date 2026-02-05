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


# Valid products for ideas (should match EXPERTLY_PRODUCTS in packages/ui)
VALID_PRODUCTS = [
    "admin",
    "define",
    "develop",
    "identity",
    "manage",
    "salon",
    "tms",
    "today",
    "vibecode",
    "vibetest",
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
    organization_id: Optional[UUID] = Field(None, description="Organization ID for org-private items")


class IdeaUpdate(BaseModel):
    """Schema for updating an idea."""

    product: Optional[str] = Field(None, min_length=1, max_length=50)
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[IdeaStatus] = None
    priority: Optional[IdeaPriority] = None
    tags: Optional[List[str]] = None
    organization_id: Optional[UUID] = None


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
    organization_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    vote_count: int = 0
    user_voted: bool = False
    comment_count: int = 0

    model_config = {"from_attributes": True}


class IdeaListResponse(BaseModel):
    """Schema for list of ideas response."""

    items: List[IdeaResponse]
    total: int


class IdeaBulkUpdateItem(BaseModel):
    """Schema for bulk update operations."""

    status: Optional[IdeaStatus] = None
    priority: Optional[IdeaPriority] = None
    tags_to_add: Optional[List[str]] = None


class IdeaBulkUpdate(BaseModel):
    """Schema for bulk updating multiple ideas."""

    ids: List[UUID] = Field(..., min_length=1)
    updates: IdeaBulkUpdateItem


class IdeaBulkUpdateResponse(BaseModel):
    """Schema for bulk update response."""

    updated_count: int
    updated_ids: List[UUID]


class VoteResponse(BaseModel):
    """Schema for vote toggle response."""

    idea_id: UUID
    vote_count: int
    user_voted: bool


class CommentCreate(BaseModel):
    """Schema for creating a comment."""

    content: str = Field(..., min_length=1, max_length=5000)


class CommentResponse(BaseModel):
    """Schema for comment response."""

    id: UUID
    idea_id: UUID
    author_email: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Aliases for consistency with other schemas
IdeaStatusEnum = IdeaStatus
IdeaPriorityEnum = IdeaPriority
