"""Pydantic schemas for artifact API requests and responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ArtifactCreate(BaseModel):
    """Schema for creating a new artifact."""

    name: str
    description: Optional[str] = None
    artifact_type: str = "file"
    artifact_type_code: Optional[str] = None


class ArtifactLinkCreate(BaseModel):
    """Schema for creating a link artifact."""

    name: str
    url: str
    description: Optional[str] = None


class ArtifactUpdate(BaseModel):
    """Schema for updating artifact metadata."""

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    url: Optional[str] = None


class DocumentResponse(BaseModel):
    """Response schema for document info."""

    id: str
    document_key: str
    version: int
    is_current: bool
    name: str
    content_type: str
    storage_type: str
    file_size: int
    conversion_status: Optional[str] = None
    created_at: datetime


class ArtifactVersionResponse(BaseModel):
    """Response schema for artifact version."""

    id: str
    artifact_id: str
    version_number: int
    document_id: str
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: int = 0
    conversion_status: str = "pending"
    conversion_error: Optional[str] = None
    change_summary: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: datetime


class ArtifactResponse(BaseModel):
    """Response schema for artifact."""

    id: str
    organization_id: str
    context: Dict[str, Any] = Field(default_factory=dict)

    # Specific IDs for backward compatibility
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    job_id: Optional[str] = None

    name: str
    description: Optional[str] = None
    artifact_type: str = "file"
    artifact_type_code: Optional[str] = None

    # Link artifacts
    url: Optional[str] = None

    # File artifacts
    document_id: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    format: Optional[str] = None

    current_version: int = 1
    status: str = "active"

    # Denormalized names for display
    project_name: Optional[str] = None
    created_by_name: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class ArtifactWithVersions(ArtifactResponse):
    """Artifact with version history."""

    versions: List[ArtifactVersionResponse] = Field(default_factory=list)


class ArtifactListResponse(BaseModel):
    """Paginated list of artifacts."""

    items: List[ArtifactResponse]
    total: int
