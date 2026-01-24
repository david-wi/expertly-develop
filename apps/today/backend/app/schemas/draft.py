"""Draft schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Any


class DraftBase(BaseModel):
    """Base draft schema."""
    type: str = Field(..., pattern=r"^(email|slack|document|note)$")
    recipient: Optional[str] = Field(None, max_length=255)
    subject: Optional[str] = Field(None, max_length=500)
    body: str = Field(..., min_length=1)
    task_id: Optional[UUID] = None
    relationship_context: Optional[dict[str, Any]] = None


class DraftCreate(DraftBase):
    """Schema for creating a draft."""
    pass


class DraftUpdate(BaseModel):
    """Schema for updating a draft."""
    recipient: Optional[str] = Field(None, max_length=255)
    subject: Optional[str] = Field(None, max_length=500)
    body: Optional[str] = None


class DraftApprove(BaseModel):
    """Schema for approving a draft."""
    feedback: Optional[str] = None


class DraftReject(BaseModel):
    """Schema for rejecting a draft."""
    feedback: str = Field(..., min_length=1)


class DraftResponse(DraftBase):
    """Schema for draft response."""
    id: UUID
    tenant_id: UUID
    user_id: Optional[UUID]
    status: str
    feedback: Optional[str]
    revision_of_id: Optional[UUID]
    approved_at: Optional[str]
    sent_at: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
