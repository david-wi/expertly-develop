"""MongoDB models for artifacts and versioned document storage."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import Field
import uuid

from artifacts_mongo.base import MongoModel, TimestampMixin, PyObjectId


class DocumentMetadata(MongoModel):
    """Flexible metadata for documents."""

    project_id: Optional[PyObjectId] = None
    task_id: Optional[PyObjectId] = None
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    # Additional flexible metadata
    extra: Dict[str, Any] = Field(default_factory=dict)


class Document(MongoModel):
    """
    Versioned document storage model.

    Supports both inline storage (for small text files) and GridFS (for large/binary files).
    Documents are grouped by document_key, with version numbers for tracking history.
    """

    organization_id: str  # Identity organization UUID

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
    file_id: Optional[PyObjectId] = None  # If GridFS storage
    inline_content: Optional[str] = None  # If small text/inline storage
    file_size: int = 0

    # Markdown conversion (optional)
    markdown_content: Optional[str] = None
    conversion_status: Optional[str] = None  # pending, completed, failed
    conversion_error: Optional[str] = None

    # Metadata
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)

    # Audit
    created_by: Optional[str] = None  # Identity user UUID
    created_at: datetime = Field(default_factory=datetime.now)
    deleted_at: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "document_key": "550e8400-e29b-41d4-a716-446655440000",
                "version": 1,
                "is_current": True,
                "name": "requirements.pdf",
                "content_type": "application/pdf",
                "storage_type": "gridfs",
                "file_size": 102400,
                "metadata": {
                    "category": "requirements",
                    "tags": ["feature", "v2"],
                },
            }
        }


class Artifact(MongoModel, TimestampMixin):
    """
    Artifact model for file attachments.

    Artifacts can be attached to various entities via the flexible context field.
    File content is stored in a separate Document for versioning support.
    """

    organization_id: str  # Identity organization UUID
    created_by: Optional[str] = None  # Identity user UUID

    # Flexible context for entity association
    # Examples: {"project_id": "..."}, {"task_id": "..."}, {"walkthrough_id": "..."}
    context: Dict[str, Any] = Field(default_factory=dict)

    # For backward compatibility with apps that use specific ID fields
    project_id: Optional[PyObjectId] = None
    task_id: Optional[PyObjectId] = None
    job_id: Optional[PyObjectId] = None

    # Artifact metadata
    name: str
    description: Optional[str] = None
    artifact_type: str = "file"  # file, link, generated
    artifact_type_code: Optional[str] = None  # visual_walkthrough, e2e_report, etc.

    # Link artifacts
    url: Optional[str] = None

    # File artifacts
    document_id: Optional[PyObjectId] = None  # Reference to documents collection
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    format: Optional[str] = None  # pdf, docx, pptx, etc.

    # Versioning
    current_version: int = 1

    # Status
    status: str = "active"  # active, archived, deleted

    # Additional metadata
    generation_params: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Requirements Document",
                "description": "Product requirements for v2",
                "artifact_type": "file",
                "original_filename": "requirements.pdf",
                "mime_type": "application/pdf",
                "format": "pdf",
                "status": "active",
                "context": {"project_id": "123456"},
            }
        }


class ArtifactVersion(MongoModel):
    """
    Tracks version history for artifacts.

    Each version points to a Document that contains the actual file content.
    """

    artifact_id: PyObjectId
    version_number: int
    document_id: PyObjectId  # Reference to versioned document

    # File info at time of version
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: int = 0

    # Conversion tracking
    conversion_status: str = "pending"  # pending, processing, completed, failed
    conversion_error: Optional[str] = None

    # Change tracking
    change_summary: Optional[str] = None
    changed_by: Optional[str] = None  # Identity user UUID

    created_at: datetime = Field(default_factory=datetime.now)
