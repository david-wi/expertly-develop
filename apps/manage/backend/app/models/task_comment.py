from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class TaskComment(MongoModel):
    """Task comment model - comments/discussion on tasks."""
    task_id: PyObjectId
    organization_id: PyObjectId
    user_id: PyObjectId

    # Content
    content: str  # Markdown text

    # Attachments referenced in this comment
    attachment_ids: list[str] = Field(default_factory=list)

    # Soft delete
    deleted_at: Optional[datetime] = None


class TaskCommentCreate(BaseModel):
    """Schema for creating a task comment."""
    content: str
    attachment_ids: list[str] = Field(default_factory=list)


class TaskCommentUpdate(BaseModel):
    """Schema for updating a task comment."""
    content: Optional[str] = None
    attachment_ids: Optional[list[str]] = None


class TaskCommentResponse(BaseModel):
    """Response schema for task comment."""
    id: str
    task_id: str
    organization_id: str
    user_id: str
    user_name: Optional[str] = None  # Populated when fetching
    content: str
    attachment_ids: list[str]
    created_at: datetime
    updated_at: datetime
