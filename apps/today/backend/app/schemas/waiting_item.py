"""WaitingItem schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class WaitingItemBase(BaseModel):
    """Base waiting item schema."""
    what: str = Field(..., min_length=1)
    who: Optional[str] = Field(None, max_length=255)
    follow_up_date: Optional[str] = None
    why_it_matters: Optional[str] = None
    task_id: Optional[UUID] = None
    person_id: Optional[UUID] = None


class WaitingItemCreate(WaitingItemBase):
    """Schema for creating a waiting item."""
    since: Optional[str] = None  # Allow setting since date for migration


class WaitingItemUpdate(BaseModel):
    """Schema for updating a waiting item."""
    what: Optional[str] = None
    who: Optional[str] = Field(None, max_length=255)
    follow_up_date: Optional[str] = None
    why_it_matters: Optional[str] = None


class WaitingItemResolve(BaseModel):
    """Schema for resolving a waiting item."""
    resolution_notes: Optional[str] = None


class WaitingItemResponse(WaitingItemBase):
    """Schema for waiting item response."""
    id: UUID
    tenant_id: UUID
    status: str
    since: Optional[str]
    resolved_at: Optional[str]
    resolution_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
