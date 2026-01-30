from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId
from app.models.queue import ScopeType


def utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class MonitorProvider(str, Enum):
    """Supported monitor providers."""
    GOOGLE_DRIVE = "google_drive"
    SLACK = "slack"
    TEAMWORK = "teamwork"
    GMAIL = "gmail"
    OUTLOOK = "outlook"
    GITHUB = "github"


class MonitorStatus(str, Enum):
    """Status of a monitor."""
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


# Provider-specific configuration schemas

class SlackConfig(BaseModel):
    """Configuration for Slack monitoring."""
    channel_ids: list[str] = Field(default_factory=list)  # Empty = workspace-wide
    workspace_wide: bool = False
    tagged_user_ids: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    context_messages: int = 5  # Number of surrounding messages to capture


class GoogleDriveConfig(BaseModel):
    """Configuration for Google Drive monitoring."""
    folder_id: str
    include_subfolders: bool = False
    file_types: list[str] = Field(default_factory=list)


class GmailConfig(BaseModel):
    """Configuration for Gmail monitoring."""
    folders: list[str] = Field(default_factory=lambda: ["INBOX"])
    from_addresses: list[str] = Field(default_factory=list)
    subject_contains: list[str] = Field(default_factory=list)
    unread_only: bool = True


class OutlookConfig(BaseModel):
    """Configuration for Outlook monitoring."""
    folders: list[str] = Field(default_factory=lambda: ["Inbox"])
    from_addresses: list[str] = Field(default_factory=list)
    subject_contains: list[str] = Field(default_factory=list)
    unread_only: bool = True


class TeamworkConfig(BaseModel):
    """Configuration for Teamwork monitoring."""
    project_ids: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=lambda: ["task_created", "status_changed"])


class GitHubConfig(BaseModel):
    """Configuration for GitHub monitoring."""
    owner: str  # Repository owner (user or organization)
    repo: str  # Repository name
    event_types: list[str] = Field(default_factory=lambda: ["pull_request", "issues", "push"])
    branches: list[str] = Field(default_factory=list)  # Empty = all branches
    labels: list[str] = Field(default_factory=list)  # Filter by issue/PR labels
    exclude_bots: bool = True  # Ignore events from bot users
    pr_actions: list[str] = Field(default_factory=lambda: ["opened", "reopened", "ready_for_review"])
    include_diff: bool = False  # Include file diff in event data
    include_comments: int = 0  # Number of recent comments to include


class Monitor(MongoModel):
    """
    Monitor model - watches external services for events and triggers playbooks.

    Monitors can be user-scoped, team-scoped, or organization-wide (like playbooks).
    """
    organization_id: PyObjectId
    name: str
    description: Optional[str] = None

    # Scope (like playbooks and queues)
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[PyObjectId] = None  # User or Team ID (null = organization-wide)

    # Provider configuration
    provider: MonitorProvider
    connection_id: PyObjectId  # OAuth connection to use
    provider_config: dict = Field(default_factory=dict)  # Provider-specific settings

    # Trigger configuration
    playbook_id: str  # Playbook to trigger when event detected
    input_data_template: Optional[dict] = None  # Template for playbook inputs
    queue_id: Optional[PyObjectId] = None  # Optional queue for triggered tasks

    # Project association
    project_id: Optional[PyObjectId] = None

    # Polling configuration (for non-webhook providers)
    poll_interval_seconds: int = 300  # Default 5 minutes

    # Status and state
    status: MonitorStatus = MonitorStatus.ACTIVE
    last_polled_at: Optional[datetime] = None
    last_event_at: Optional[datetime] = None
    last_error: Optional[str] = None
    poll_cursor: Optional[dict] = None  # Provider-specific cursor for pagination

    # Webhook state (for providers that support webhooks)
    webhook_id: Optional[str] = None  # ID returned from provider when webhook set up
    webhook_secret: Optional[str] = None  # Secret for verifying webhook payloads

    # Statistics
    events_detected: int = 0
    playbooks_triggered: int = 0

    # Soft delete
    deleted_at: Optional[datetime] = None


class MonitorEvent(MongoModel):
    """
    Tracks events detected by monitors for deduplication and audit trail.
    """
    organization_id: PyObjectId
    monitor_id: PyObjectId

    # Event identification
    provider_event_id: str  # Unique ID from provider for deduplication
    event_type: str  # e.g., "message", "file_created", "task_updated"

    # Event data
    event_data: dict = Field(default_factory=dict)
    context_data: Optional[dict] = None  # Surrounding context (e.g., Slack messages)

    # Processing state
    processed: bool = False
    task_id: Optional[PyObjectId] = None  # Task created from this event
    playbook_instance_id: Optional[str] = None  # Playbook instance if triggered

    # Timing
    provider_timestamp: Optional[datetime] = None  # When event occurred in provider


# Request/Response schemas

class MonitorCreate(BaseModel):
    """Schema for creating a monitor."""
    name: str
    description: Optional[str] = None
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[str] = None
    provider: MonitorProvider
    connection_id: str
    provider_config: dict = Field(default_factory=dict)
    playbook_id: str
    input_data_template: Optional[dict] = None
    queue_id: Optional[str] = None
    project_id: Optional[str] = None
    poll_interval_seconds: int = 300


class MonitorUpdate(BaseModel):
    """Schema for updating a monitor."""
    name: Optional[str] = None
    description: Optional[str] = None
    scope_type: Optional[ScopeType] = None
    scope_id: Optional[str] = None
    provider_config: Optional[dict] = None
    playbook_id: Optional[str] = None
    input_data_template: Optional[dict] = None
    queue_id: Optional[str] = None
    project_id: Optional[str] = None
    poll_interval_seconds: Optional[int] = None
    status: Optional[MonitorStatus] = None
