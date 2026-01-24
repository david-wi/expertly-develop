"""Client schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class ClientBase(BaseModel):
    """Base client schema."""
    name: str = Field(..., min_length=1, max_length=255)
    status: str = Field(default="active", pattern="^(prospect|active|churned|archived)$")
    notes: Optional[str] = None


class ClientCreate(ClientBase):
    """Schema for creating a client."""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating a client."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[str] = Field(None, pattern="^(prospect|active|churned|archived)$")
    notes: Optional[str] = None


class ClientResponse(ClientBase):
    """Schema for client response."""
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClientWithPeople(ClientResponse):
    """Schema for client with people list."""
    people: List[dict] = []
