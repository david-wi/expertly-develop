from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class TeamCreate(BaseModel):
    """Schema for creating a team."""

    name: str
    description: Optional[str] = None


class TeamUpdate(BaseModel):
    """Schema for updating a team."""

    name: Optional[str] = None
    description: Optional[str] = None


class TeamMemberAdd(BaseModel):
    """Schema for adding a team member."""

    user_id: UUID
    role: str = "member"


class TeamMemberResponse(BaseModel):
    """Schema for team member response."""

    id: UUID
    user_id: UUID
    user_name: str
    user_avatar_url: Optional[str]
    user_type: str
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


class TeamResponse(BaseModel):
    """Schema for team response."""

    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str]
    member_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamDetailResponse(TeamResponse):
    """Schema for team detail response with members."""

    members: List[TeamMemberResponse] = []


class TeamListResponse(BaseModel):
    """Schema for team list response."""

    items: List[TeamResponse]
    total: int
