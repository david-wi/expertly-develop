from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId

from app.models.base import PyObjectId
from app.models.queue import ScopeType


def utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class PlaybookItemType(str, Enum):
    """Type of item in the playbook hierarchy."""
    PLAYBOOK = "playbook"
    GROUP = "group"


class AssigneeType(str, Enum):
    """Who can be assigned to or approve a step."""
    USER = "user"      # Specific person
    TEAM = "team"      # Anyone on a team
    ANYONE = "anyone"  # Any person in org


class PlaybookStep(BaseModel):
    """A single step in a playbook."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    order: int
    title: str
    description: Optional[str] = None  # Markdown content
    when_to_perform: Optional[str] = None  # When/conditions for this step

    # Parallel execution - steps with same parallel_group run together
    parallel_group: Optional[str] = None

    # Nested playbook (optional) - use another playbook for this step
    nested_playbook_id: Optional[str] = None

    # Assignment - who works on this step
    assignee_type: AssigneeType = AssigneeType.ANYONE
    assignee_id: Optional[str] = None  # user_id or team_id when assignee_type is USER or TEAM
    queue_id: Optional[str] = None  # Override default queue

    # Approval (optional) - requires approval before continuing
    approval_required: bool = False
    approver_type: Optional[AssigneeType] = None
    approver_id: Optional[str] = None  # user_id or team_id when approver_type is USER or TEAM
    approver_queue_id: Optional[str] = None  # Queue for approval tasks


class PlaybookStepCreate(BaseModel):
    """Schema for creating/updating a step (without auto-generated id)."""
    id: Optional[str] = None  # Optional - will be generated if not provided
    order: Optional[int] = None  # Optional - will be assigned based on position
    title: str
    description: Optional[str] = None
    when_to_perform: Optional[str] = None
    parallel_group: Optional[str] = None
    nested_playbook_id: Optional[str] = None
    assignee_type: AssigneeType = AssigneeType.ANYONE
    assignee_id: Optional[str] = None
    queue_id: Optional[str] = None
    approval_required: bool = False
    approver_type: Optional[AssigneeType] = None
    approver_id: Optional[str] = None
    approver_queue_id: Optional[str] = None


class PlaybookHistoryEntry(BaseModel):
    """A historical version of a playbook."""
    version: int
    name: str
    description: Optional[str] = None
    inputs_template: Optional[str] = None  # Template for required inputs
    steps: list[PlaybookStep] = Field(default_factory=list)  # Snapshot of steps
    changed_at: datetime = Field(default_factory=utc_now)
    changed_by: Optional[str] = None  # User ID who made the change


class Playbook(BaseModel):
    """
    Playbook model - a template for multi-step processes.

    Playbooks can be private (user-scoped), team-scoped, or organization-wide.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )

    id: str = Field(default_factory=lambda: str(uuid4()), alias="_id")
    organization_id: PyObjectId

    # Core fields
    name: str
    description: Optional[str] = None
    inputs_template: Optional[str] = None  # What information to provide when invoking

    # Steps - the ordered list of steps in this playbook
    steps: list[PlaybookStep] = Field(default_factory=list)

    # Scope - who can access this playbook
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[PyObjectId] = None  # User or Team ID (null = organization-wide)

    # Versioning and history
    version: int = 1
    history: list[PlaybookHistoryEntry] = Field(default_factory=list)

    # Status
    is_active: bool = True

    # Instance tracking
    instance_count: int = 0  # Number of times this playbook has been instantiated
    last_instance_created_at: Optional[datetime] = None  # When the last instance was created

    # Hierarchy fields
    item_type: PlaybookItemType = PlaybookItemType.PLAYBOOK
    parent_id: Optional[str] = None  # ID of parent playbook/group
    order_index: int = 0  # Position among siblings

    # Assignment defaults (for tasks using this playbook)
    default_queue_id: Optional[str] = None  # Where assignments go by default
    default_approver_type: Optional[str] = None  # "user", "team", "anyone"
    default_approver_id: Optional[str] = None  # User or Team ID
    default_approver_queue_id: Optional[str] = None  # Queue for approval tasks

    # Timestamps
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    created_by: Optional[str] = None  # User ID who created it

    def model_dump_mongo(self, **kwargs) -> dict:
        """Dump model for MongoDB storage."""
        data = self.model_dump(by_alias=True, **kwargs)
        return data


class PlaybookCreate(BaseModel):
    """Schema for creating a playbook."""
    name: str
    description: Optional[str] = None
    inputs_template: Optional[str] = None
    steps: list[PlaybookStepCreate] = Field(default_factory=list)
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[str] = None  # User or Team ID
    item_type: PlaybookItemType = PlaybookItemType.PLAYBOOK
    parent_id: Optional[str] = None
    # Assignment defaults
    default_queue_id: Optional[str] = None
    default_approver_type: Optional[str] = None
    default_approver_id: Optional[str] = None
    default_approver_queue_id: Optional[str] = None


class PlaybookUpdate(BaseModel):
    """Schema for updating a playbook."""
    name: Optional[str] = None
    description: Optional[str] = None
    inputs_template: Optional[str] = None
    steps: Optional[list[PlaybookStepCreate]] = None
    scope_type: Optional[ScopeType] = None
    scope_id: Optional[str] = None
    is_active: Optional[bool] = None
    parent_id: Optional[str] = None
    # Assignment defaults
    default_queue_id: Optional[str] = None
    default_approver_type: Optional[str] = None
    default_approver_id: Optional[str] = None
    default_approver_queue_id: Optional[str] = None


class PlaybookReorderItem(BaseModel):
    """Schema for a single item in a reorder request."""
    id: str
    parent_id: Optional[str] = None
    order_index: int


class PlaybookReorderRequest(BaseModel):
    """Schema for bulk reordering playbooks."""
    items: list[PlaybookReorderItem]
