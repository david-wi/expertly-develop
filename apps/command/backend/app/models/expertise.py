from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


def utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class ExpertiseContentType(str, Enum):
    """Type of content in the expertise item."""
    MARKDOWN = "markdown"  # Direct markdown text
    FILE = "file"          # Uploaded file (PDF, Word, etc.) with extracted markdown
    URL = "url"            # URL reference with retrieved content


class ExpertiseHistoryEntry(BaseModel):
    """A historical version of an expertise item."""
    version: int
    title: str
    description: Optional[str] = None
    content_type: ExpertiseContentType
    # Content fields (snapshot of relevant content at this version)
    markdown_content: Optional[str] = None
    extracted_markdown: Optional[str] = None
    url: Optional[str] = None
    url_content_markdown: Optional[str] = None
    changed_at: datetime = Field(default_factory=utc_now)
    changed_by: Optional[str] = None  # User ID who made the change


class Expertise(MongoModel):
    """
    Expertise model - reusable domain knowledge repository.

    Each expertise item contains documentation that can be referenced by playbooks
    to help them perform their tasks. Content can be:
    - Direct markdown text
    - An uploaded file (PDF, Word, etc.) with extracted markdown
    - A URL reference with periodically retrieved content
    """
    organization_id: str  # UUID from Identity service

    # Core fields
    title: str
    description: Optional[str] = None

    # Content type determines which fields are used
    content_type: ExpertiseContentType = ExpertiseContentType.MARKDOWN

    # MARKDOWN type fields
    markdown_content: Optional[str] = None

    # FILE type fields
    filename: Optional[str] = None              # Stored filename (UUID-based)
    original_filename: Optional[str] = None     # Original uploaded filename
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    storage_path: Optional[str] = None          # Full path to stored file
    extracted_markdown: Optional[str] = None    # Markdown extracted from file

    # URL type fields
    url: Optional[str] = None
    url_retrieved_at: Optional[datetime] = None     # When content was last retrieved
    url_content_markdown: Optional[str] = None      # Content retrieved from URL

    # Versioning and history
    version: int = 1
    history: list[ExpertiseHistoryEntry] = Field(default_factory=list)

    # Status
    is_active: bool = True

    # Metadata
    created_by: Optional[str] = None  # User ID who created it


class ExpertiseCreate(BaseModel):
    """Schema for creating an expertise item (markdown type)."""
    title: str
    description: Optional[str] = None
    content_type: ExpertiseContentType = ExpertiseContentType.MARKDOWN
    markdown_content: Optional[str] = None
    url: Optional[str] = None  # For URL type


class ExpertiseUpdate(BaseModel):
    """Schema for updating an expertise item."""
    title: Optional[str] = None
    description: Optional[str] = None
    markdown_content: Optional[str] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None


class ExpertiseResponse(BaseModel):
    """Response schema for expertise item."""
    id: str
    organization_id: str
    title: str
    description: Optional[str] = None
    content_type: ExpertiseContentType
    # MARKDOWN type
    markdown_content: Optional[str] = None
    # FILE type
    filename: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    extracted_markdown: Optional[str] = None
    # URL type
    url: Optional[str] = None
    url_retrieved_at: Optional[datetime] = None
    url_content_markdown: Optional[str] = None
    # Versioning
    version: int
    # Status
    is_active: bool
    # Timestamps
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
