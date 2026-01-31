from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


def utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class DocumentHistoryEntry(BaseModel):
    """A historical version of a document's content."""
    version: int
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # Markdown content snapshot
    changed_at: datetime = Field(default_factory=utc_now)
    changed_by: Optional[str] = None  # User ID who made the change


class Document(MongoModel):
    """
    Document model - versioned markdown documents attached to projects or tasks.

    Documents can store markdown content with full version history, and/or
    link to external files (e.g., Google Docs).
    """
    organization_id: PyObjectId

    # Core fields
    title: str
    description: Optional[str] = None
    content: Optional[str] = None  # Markdown content

    # Document purpose/type - a code that indicates what kind of document this is
    # (e.g., "architecture", "intake", "requirements", "notes")
    purpose: Optional[str] = None

    # Relationships - can be attached to a project and/or task
    project_id: Optional[PyObjectId] = None
    task_id: Optional[PyObjectId] = None

    # External link - for documents stored elsewhere (e.g., Google Docs)
    external_url: Optional[str] = None
    external_title: Optional[str] = None  # Display title for the external link

    # Versioning
    version: int = 1
    history: list[DocumentHistoryEntry] = Field(default_factory=list)

    # Metadata
    created_by: Optional[str] = None  # User ID
    updated_by: Optional[str] = None  # User ID who last updated

    # Soft delete
    deleted_at: Optional[datetime] = None


class DocumentCreate(BaseModel):
    """Schema for creating a document."""
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    purpose: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    external_url: Optional[str] = None
    external_title: Optional[str] = None


class DocumentUpdate(BaseModel):
    """Schema for updating a document."""
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    purpose: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    external_url: Optional[str] = None
    external_title: Optional[str] = None


class DocumentResponse(BaseModel):
    """Response schema for document."""
    id: str
    organization_id: str
    title: str
    description: Optional[str] = None
    content: Optional[str] = None
    purpose: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    external_url: Optional[str] = None
    external_title: Optional[str] = None
    version: int
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
