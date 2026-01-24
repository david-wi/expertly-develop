"""Artifact schemas for API requests/responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ArtifactResponse(BaseModel):
    """Schema for artifact response."""

    id: str
    label: str
    description: Optional[str]
    artifact_type_code: str
    format: str
    status: str
    project_id: Optional[str]
    job_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ArtifactListResponse(BaseModel):
    """Schema for artifact list response."""

    items: List[ArtifactResponse]
    total: int
