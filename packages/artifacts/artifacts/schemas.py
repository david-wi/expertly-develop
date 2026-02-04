"""Pydantic schemas for artifacts API."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ArtifactCreate(BaseModel):
    """Schema for creating a file artifact (used with multipart form)."""
    name: str
    description: Optional[str] = None


class ArtifactLinkCreate(BaseModel):
    """Schema for creating a link artifact."""
    name: str
    url: str
    description: Optional[str] = None


class ArtifactUpdate(BaseModel):
    """Schema for updating an artifact."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    url: Optional[str] = None


class ArtifactVersionResponse(BaseModel):
    """Response schema for artifact version."""
    id: str
    artifact_id: str
    version_number: int
    original_storage_path: str
    markdown_storage_path: Optional[str] = None
    markdown_content: Optional[str] = None
    size_bytes: int
    conversion_status: str
    conversion_error: Optional[str] = None
    change_summary: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class ArtifactResponse(BaseModel):
    """Response schema for artifact."""
    id: str
    context: Dict[str, Any] = {}
    # Include product_id for backward compatibility
    product_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    artifact_type: str = "file"
    url: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    current_version: int
    status: str
    created_at: str
    updated_at: str
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class ArtifactWithVersions(ArtifactResponse):
    """Response schema for artifact with all versions."""
    versions: List[ArtifactVersionResponse] = []
