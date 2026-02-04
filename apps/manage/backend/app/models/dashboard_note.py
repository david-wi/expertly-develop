from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


def utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class DashboardNoteHistoryEntry(BaseModel):
    """A historical version of a dashboard note's content."""
    version: int
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # Markdown content snapshot
    changed_at: datetime = Field(default_factory=utc_now)
    changed_by: Optional[str] = None  # User ID who made the change


class DashboardNote(MongoModel):
    """
    Dashboard Note model - versioned markdown documents for dashboard widgets.

    These are user-level notes that can be displayed as widgets on the dashboard.
    Users can create notes like "Most Important for Today" with markdown content.
    """
    organization_id: str  # UUID from Identity service
    user_id: str  # Owner user ID - the user who created this note

    # Core fields
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # Markdown content

    # Versioning
    version: int = 1
    history: list[DashboardNoteHistoryEntry] = Field(default_factory=list)

    # Metadata
    created_by: Optional[str] = None  # User ID
    updated_by: Optional[str] = None  # User ID who last updated

    # Soft delete
    deleted_at: Optional[datetime] = None


class DashboardNoteCreate(BaseModel):
    """Schema for creating a dashboard note."""
    title: str
    description: Optional[str] = None
    content: Optional[str] = None


class DashboardNoteUpdate(BaseModel):
    """Schema for updating a dashboard note."""
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None


class DashboardNoteResponse(BaseModel):
    """Response schema for dashboard note."""
    id: str
    organization_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    version: int
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DashboardNoteVersionEntry(BaseModel):
    """Version entry for dashboard note history."""
    version: int
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    changed_at: datetime
    changed_by: Optional[str] = None
    is_current: bool = False
