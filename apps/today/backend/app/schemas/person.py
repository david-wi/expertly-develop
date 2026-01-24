"""Person schemas."""

from pydantic import BaseModel, Field, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional


class PersonBase(BaseModel):
    """Base person schema."""
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    relationship: Optional[str] = Field(None, max_length=100)
    relationship_to_user: Optional[str] = None
    political_context: Optional[str] = None
    communication_notes: Optional[str] = None
    context_notes: Optional[str] = None
    client_id: Optional[UUID] = None


class PersonCreate(PersonBase):
    """Schema for creating a person."""
    pass


class PersonUpdate(BaseModel):
    """Schema for updating a person."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)
    relationship: Optional[str] = Field(None, max_length=100)
    relationship_to_user: Optional[str] = None
    political_context: Optional[str] = None
    communication_notes: Optional[str] = None
    context_notes: Optional[str] = None
    client_id: Optional[UUID] = None
    last_contact: Optional[str] = None
    next_follow_up: Optional[str] = None


class PersonResponse(PersonBase):
    """Schema for person response."""
    id: UUID
    tenant_id: UUID
    last_contact: Optional[str]
    next_follow_up: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PersonContext(BaseModel):
    """Schema for person context in task/draft context."""
    id: UUID
    name: str
    relationship: Optional[str]
    relationship_to_user: Optional[str]
    political_context: Optional[str]
    communication_notes: Optional[str]
