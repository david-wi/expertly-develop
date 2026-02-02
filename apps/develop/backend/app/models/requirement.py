"""Requirement model for tracking project and meta requirements."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class RequirementStatus(str, Enum):
    """Requirement status options."""

    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    IMPLEMENTED = "implemented"


class DocumentType(str, Enum):
    """Document type options."""

    META = "meta"  # Meta-requirements for Expertly Develop itself
    FEATURE = "feature"
    USER_STORY = "user_story"


class Requirement(MongoModel, TimestampMixin):
    """Requirement model."""

    organization_id: str  # Identity organization UUID
    project_id: Optional[PyObjectId] = None  # null = meta-requirements for Expertly Develop

    title: str
    document_type: DocumentType = DocumentType.FEATURE
    document_id: Optional[PyObjectId] = None  # Content in documents collection
    status: RequirementStatus = RequirementStatus.DRAFT

    created_by: Optional[str] = None  # Identity user UUID

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Visual Walkthrough Feature",
                "document_type": "feature",
                "status": "draft",
            }
        }
