from pydantic import BaseModel
from typing import Optional, List


class ArtifactCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ArtifactUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ArtifactVersionResponse(BaseModel):
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
    id: str
    product_id: str
    name: str
    description: Optional[str] = None
    original_filename: str
    mime_type: str
    current_version: int
    status: str
    created_at: str
    updated_at: str
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class ArtifactWithVersions(ArtifactResponse):
    versions: List[ArtifactVersionResponse] = []
