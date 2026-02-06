from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class Team(MongoModel):
    """Team model - groups of users."""
    organization_id: PyObjectId
    name: str
    description: Optional[str] = None
    member_ids: list[PyObjectId] = Field(default_factory=list)
    lead_id: Optional[PyObjectId] = None


class TeamCreate(BaseModel):
    """Schema for creating a team."""
    name: str
    description: Optional[str] = None
    member_ids: list[str] = Field(default_factory=list)
    lead_id: Optional[str] = None


class TeamUpdate(BaseModel):
    """Schema for updating a team."""
    name: Optional[str] = None
    description: Optional[str] = None
    member_ids: Optional[list[str]] = None
    lead_id: Optional[str] = None
