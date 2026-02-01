"""Schemas for organization membership management."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr


class AddMemberRequest(BaseModel):
    """Request to add a member to an organization."""
    user_id: Optional[UUID] = None  # Either user_id or email required
    email: Optional[EmailStr] = None  # Look up user by email
    role: str = "member"  # owner, admin, member
    is_primary: bool = False


class UpdateMemberRequest(BaseModel):
    """Request to update a membership."""
    role: Optional[str] = None
    is_primary: Optional[bool] = None


class MemberResponse(BaseModel):
    """Response for an organization member."""
    id: UUID  # Membership ID
    user_id: UUID
    organization_id: UUID
    role: str
    is_primary: bool
    joined_at: datetime

    # User details
    user_name: str
    user_email: Optional[str]
    user_avatar_url: Optional[str]
    user_type: str

    class Config:
        from_attributes = True


class MemberListResponse(BaseModel):
    """Response for listing organization members."""
    items: List[MemberResponse]
    total: int


class UserOrganizationResponse(BaseModel):
    """Organization that a user belongs to."""
    id: UUID  # Membership ID
    organization_id: UUID
    organization_name: str
    organization_slug: str
    role: str
    is_primary: bool
    joined_at: datetime

    class Config:
        from_attributes = True


class UserOrganizationsListResponse(BaseModel):
    """List of organizations a user belongs to."""
    items: List[UserOrganizationResponse]
    total: int
