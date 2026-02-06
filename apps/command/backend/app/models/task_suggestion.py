from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class TaskSuggestion(MongoModel):
    """AI-generated suggestion for a task (e.g. draft reply to Slack or Gmail)."""
    task_id: PyObjectId
    organization_id: str  # UUID from Identity service

    suggestion_type: str  # "slack_reply" | "gmail_reply" | "calendar_event"
    status: str = "pending"  # "pending" | "accepted" | "dismissed"

    title: str  # e.g. "Reply to John in #general"
    content: str  # The editable draft text

    # Type-specific data for execution
    # slack_reply: { channel_id, thread_ts, permalink, connection_id }
    # gmail_reply: { thread_id, message_id, to, subject, permalink, connection_id }
    provider_data: dict = Field(default_factory=dict)

    created_by: str = "ai"  # "ai" or user_id
    executed_at: Optional[datetime] = None

    # Soft delete
    deleted_at: Optional[datetime] = None


class TaskSuggestionCreate(BaseModel):
    """Schema for creating a task suggestion."""
    suggestion_type: Literal["slack_reply", "gmail_reply", "calendar_event"]
    title: str
    content: str
    provider_data: dict = Field(default_factory=dict)
    created_by: str = "ai"


class TaskSuggestionUpdate(BaseModel):
    """Schema for updating a task suggestion."""
    content: Optional[str] = None
    status: Optional[Literal["pending", "accepted", "dismissed"]] = None
