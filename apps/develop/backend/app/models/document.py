"""Versioned document storage model."""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import Field
import uuid

from app.models.base import MongoModel, PyObjectId


class DocumentMetadata(MongoModel):
    """Flexible metadata for documents."""

    project_id: Optional[PyObjectId] = None
    category: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class Document(MongoModel):
    """Versioned document storage model."""

    tenant_id: PyObjectId

    # Grouping key - same for all versions of a document
    document_key: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Version info
    version: int = 1
    is_current: bool = True
    previous_version_id: Optional[PyObjectId] = None

    # Content
    name: str
    content_type: str  # MIME type
    storage_type: str = "gridfs"  # gridfs or inline
    file_id: Optional[PyObjectId] = None  # If GridFS
    inline_content: Optional[str] = None  # If small text
    file_size: int = 0

    # Metadata
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)

    # Audit
    created_by: Optional[PyObjectId] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    deleted_at: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "document_key": "550e8400-e29b-41d4-a716-446655440000",
                "version": 1,
                "is_current": True,
                "name": "requirements.md",
                "content_type": "text/markdown",
                "storage_type": "inline",
                "file_size": 1234,
                "metadata": {
                    "category": "requirements",
                    "tags": ["feature", "v2"],
                },
            }
        }
