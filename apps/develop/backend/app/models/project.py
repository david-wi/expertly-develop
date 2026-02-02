"""Project model."""

from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class Visibility(str, Enum):
    """Project visibility options."""

    PRIVATE = "private"
    TEAM = "team"
    COMPANYWIDE = "companywide"


class SiteCredentials(MongoModel):
    """Encrypted site credentials for browser automation."""

    username: Optional[str] = None  # Encrypted
    password: Optional[str] = None  # Encrypted
    login_url: Optional[str] = None
    username_selector: Optional[str] = None
    password_selector: Optional[str] = None
    submit_selector: Optional[str] = None


class UrlCredentials(MongoModel):
    """Credentials for accessing requirement URLs."""

    username: Optional[str] = None  # Encrypted
    password: Optional[str] = None  # Encrypted


class RequirementsConfig(MongoModel):
    """Configuration for project requirements source."""

    source_type: str = "text"  # url, file, text
    url: Optional[str] = None
    url_credentials: Optional[UrlCredentials] = None
    document_ids: List[PyObjectId] = Field(default_factory=list)


class LatestArtifact(MongoModel):
    """Reference to latest artifacts for quick access."""

    artifact_id: PyObjectId
    artifact_type: str
    label: str
    created_at: datetime


class Project(MongoModel, TimestampMixin):
    """Project model."""

    organization_id: str  # Identity organization UUID
    owner_id: str  # Identity user UUID
    name: str
    description: Optional[str] = None
    visibility: Visibility = Visibility.PRIVATE
    site_url: Optional[str] = None
    site_credentials: Optional[SiteCredentials] = None
    requirements_config: Optional[RequirementsConfig] = None
    latest_artifacts: List[LatestArtifact] = Field(default_factory=list)
    deleted_at: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "My App",
                "description": "A sample application",
                "visibility": "private",
                "site_url": "https://example.com",
            }
        }
