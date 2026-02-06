"""Notification model for real-time alerts."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class NotificationType(str, Enum):
    """Types of notifications."""
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_UNBLOCKED = "task_unblocked"
    APPROVAL_NEEDED = "approval_needed"
    BOT_FAILURE_ALERT = "bot_failure_alert"
    MENTION = "mention"


class Notification(MongoModel):
    """
    Notification model for real-time alerts.

    Notifications are created when events occur that users should be alerted about,
    such as task assignments, completions, or approval requests.
    """
    organization_id: str  # UUID from Identity service
    user_id: str  # UUID from Identity service - Recipient of the notification

    # Notification content
    notification_type: NotificationType
    title: str
    message: str

    # Related entities
    task_id: Optional[PyObjectId] = None
    actor_id: Optional[str] = None  # User UUID who triggered the notification
    actor_name: Optional[str] = None  # Stored at creation time for display

    # State
    read: bool = False
    read_at: Optional[datetime] = None
    dismissed: bool = False
    dismissed_at: Optional[datetime] = None

    # Action
    action_url: Optional[str] = None  # URL to navigate to when clicked


class NotificationCreate(BaseModel):
    """Schema for creating a notification."""
    user_id: str  # Recipient
    notification_type: NotificationType
    title: str
    message: str
    task_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None  # Pass actor's name for storage
    action_url: Optional[str] = None


class NotificationResponse(BaseModel):
    """Schema for notification response."""
    id: str
    organization_id: str
    user_id: str
    notification_type: NotificationType
    title: str
    message: str
    task_id: Optional[str] = None
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None  # Populated when returning
    read: bool
    read_at: Optional[datetime] = None
    dismissed: bool
    action_url: Optional[str] = None
    created_at: datetime
