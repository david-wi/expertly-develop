"""Artifact model for generated outputs."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class Artifact(MongoModel, TimestampMixin):
    """Artifact model for generated outputs."""

    project_id: Optional[PyObjectId] = None
    tenant_id: PyObjectId
    created_by: Optional[PyObjectId] = None
    job_id: Optional[PyObjectId] = None

    label: str
    description: Optional[str] = None
    artifact_type_code: str  # visual_walkthrough, e2e_report, etc.
    format: str  # pdf, docx, pptx, etc.

    document_id: PyObjectId  # Reference to documents collection

    generation_params: Dict[str, Any] = Field(default_factory=dict)

    status: str = "complete"

    class Config:
        json_schema_extra = {
            "example": {
                "label": "Visual Walkthrough 2024-01-24",
                "description": "Homepage navigation walkthrough",
                "artifact_type_code": "visual_walkthrough",
                "format": "pdf",
                "status": "complete",
            }
        }
