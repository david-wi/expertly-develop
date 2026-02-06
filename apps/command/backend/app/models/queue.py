from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class ScopeType(str, Enum):
    """Who the queue is scoped to."""
    USER = "user"          # Personal queue for a specific user
    TEAM = "team"          # Team queue (can inherit from other teams later)
    ORGANIZATION = "organization"  # Everyone in the org


class Queue(MongoModel):
    """
    Queue model - a tuple of (purpose, scope).

    Examples:
    - ("Marketing Collateral Approval", team:marketing-uuid)
    - ("My Tasks", user:david-uuid)
    - ("Support Tickets", organization)
    """
    organization_id: str  # UUID from Identity service

    # The PURPOSE - what this queue is for
    purpose: str  # e.g., "Marketing Collateral Approval", "Bug Triage", "My Inbox"
    description: Optional[str] = None

    # The SCOPE - who this queue belongs to
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[str] = None  # User or Team UUID from Identity (null = organization-wide)

    # System queues (Inbox, Urgent, Follow-up) - created automatically per user
    is_system: bool = False
    system_type: Optional[str] = None  # "inbox", "urgent", "followup"

    # Settings
    priority_default: int = 5
    allow_bots: bool = True

    # Soft delete
    deleted_at: Optional[datetime] = None


class QueueCreate(BaseModel):
    """Schema for creating a queue."""
    purpose: str
    description: Optional[str] = None
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[str] = None  # User or Team UUID
    priority_default: int = 5
    allow_bots: bool = True


class QueueUpdate(BaseModel):
    """Schema for updating a queue."""
    purpose: Optional[str] = None
    description: Optional[str] = None
    scope_type: Optional[ScopeType] = None
    scope_id: Optional[str] = None
    priority_default: Optional[int] = None
    allow_bots: Optional[bool] = None


# Keep QueueType as alias for backwards compatibility
QueueType = ScopeType
