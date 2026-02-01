from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class AttachmentType(str, Enum):
    """Type of attachment."""
    FILE = "file"
    LINK = "link"


class TaskAttachment(MongoModel):
    """Task attachment model - files or links attached to tasks."""
    task_id: PyObjectId
    organization_id: PyObjectId
    attachment_type: AttachmentType

    # Optional step association for playbook step-level attachments
    step_id: Optional[str] = None  # UUID from PlaybookStep

    # File-specific fields
    filename: Optional[str] = None  # Stored filename (UUID-based)
    original_filename: Optional[str] = None  # Original uploaded filename
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    storage_path: Optional[str] = None  # Full path to stored file

    # Link-specific fields
    url: Optional[str] = None
    link_title: Optional[str] = None

    # Common fields
    note: Optional[str] = None  # Optional description/note about the attachment
    uploaded_by_id: PyObjectId

    # Soft delete
    deleted_at: Optional[datetime] = None


class TaskAttachmentCreate(BaseModel):
    """Schema for creating a task attachment (link type)."""
    url: str
    link_title: Optional[str] = None
    note: Optional[str] = None
    step_id: Optional[str] = None  # For step-level attachments


class TaskAttachmentResponse(BaseModel):
    """Response schema for task attachment."""
    id: str
    task_id: str
    organization_id: str
    attachment_type: AttachmentType

    # Step association (optional)
    step_id: Optional[str] = None

    # File fields
    filename: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None

    # Link fields
    url: Optional[str] = None
    link_title: Optional[str] = None

    # Common fields
    note: Optional[str] = None
    uploaded_by_id: str
    created_at: datetime
