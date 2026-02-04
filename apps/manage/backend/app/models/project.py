from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class ProjectStatus(str, Enum):
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectResource(BaseModel):
    """A resource link or file associated with a project."""
    title: str
    url: str
    type: str = "link"  # "link" or "file"


class ProjectCustomField(BaseModel):
    """A custom field for a project."""
    label: str
    value: str


class ProjectCommentAttachment(BaseModel):
    """An attachment on a project comment."""
    id: str  # UUID
    filename: str
    url: str  # Storage URL
    content_type: Optional[str] = None
    size_bytes: Optional[int] = None


class ProjectContact(BaseModel):
    """A person/contact associated with a project."""
    id: str  # UUID
    name: str
    role: Optional[str] = None  # Their role/relationship to the project
    emails: list[str] = []  # Email addresses
    phones: list[str] = []  # Phone numbers
    notes: Optional[str] = None


class ProjectCompany(BaseModel):
    """A company/organization associated with a project."""
    id: str  # UUID
    name: str
    domains: list[str] = []  # Email domains (e.g., "qrcargo.com")
    relationship: Optional[str] = None  # Relationship to the project (client, vendor, partner, etc.)
    notes: Optional[str] = None


class ProjectComment(BaseModel):
    """A comment on a project."""
    id: str  # UUID
    content: str  # Summary/comment text (HTML content for rich text)
    full_content: Optional[str] = None  # Full original content (e.g., email body)
    url: Optional[str] = None  # Optional URL reference (e.g., email or calendar link)
    import_source: Optional[str] = None  # Where this was imported from (e.g., "David's calendar", "wisdev slack #channel")
    attachments: list[ProjectCommentAttachment] = []  # File attachments
    author_id: str  # User ID
    author_name: str
    created_at: str  # ISO timestamp


class Project(MongoModel):
    """Project model - hierarchical containers for tasks."""
    organization_id: str  # UUID from Identity service
    name: str
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.ACTIVE

    # Hierarchy - local MongoDB ObjectId
    parent_project_id: Optional[PyObjectId] = None

    # Ownership - UUIDs from Identity service
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None

    # Project details panel
    resources: list[ProjectResource] = Field(default_factory=list)
    custom_fields: list[ProjectCustomField] = Field(default_factory=list)
    next_steps: Optional[str] = None
    ai_suggestions: Optional[str] = None
    comments: list[ProjectComment] = Field(default_factory=list)

    # Content identification rules (for classifying emails, calendar items, etc.)
    identification_rules: Optional[str] = None

    # Associations (for linking imported content)
    contacts: list[ProjectContact] = Field(default_factory=list)
    companies: list[ProjectCompany] = Field(default_factory=list)

    # Avatar
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None  # Custom prompt for avatar generation


class ProjectCreate(BaseModel):
    """Schema for creating a project."""
    name: str
    description: Optional[str] = None
    parent_project_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None
    resources: Optional[list[ProjectResource]] = None
    custom_fields: Optional[list[ProjectCustomField]] = None
    next_steps: Optional[str] = None
    identification_rules: Optional[str] = None
    contacts: Optional[list[ProjectContact]] = None
    companies: Optional[list[ProjectCompany]] = None
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    parent_project_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    team_id: Optional[str] = None
    resources: Optional[list[ProjectResource]] = None
    custom_fields: Optional[list[ProjectCustomField]] = None
    next_steps: Optional[str] = None
    ai_suggestions: Optional[str] = None
    comments: Optional[list[ProjectComment]] = None
    identification_rules: Optional[str] = None
    contacts: Optional[list[ProjectContact]] = None
    companies: Optional[list[ProjectCompany]] = None
    avatar_url: Optional[str] = None
    avatar_prompt: Optional[str] = None
