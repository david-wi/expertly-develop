from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId

from app.models.base import PyObjectId
from app.models.queue import ScopeType


def utc_now() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class PlaybookHistoryEntry(BaseModel):
    """A historical version of a playbook."""
    version: int
    name: str
    description: Optional[str] = None
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

    # Scope - who can access this playbook
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[PyObjectId] = None  # User or Team ID (null = organization-wide)

    # Versioning and history
    version: int = 1
    history: list[PlaybookHistoryEntry] = Field(default_factory=list)

    # Status
    is_active: bool = True

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
    scope_type: ScopeType = ScopeType.ORGANIZATION
    scope_id: Optional[str] = None  # User or Team ID


class PlaybookUpdate(BaseModel):
    """Schema for updating a playbook."""
    name: Optional[str] = None
    description: Optional[str] = None
    scope_type: Optional[ScopeType] = None
    scope_id: Optional[str] = None
    is_active: Optional[bool] = None
