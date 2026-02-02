"""
Authentication schemas for Salon app.

Note: Authentication is handled by Identity service at identity.ai.devintensive.com.
These schemas are for salon-specific user management (not auth itself).
"""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class InviteStaffRequest(BaseModel):
    """Invite a staff member to create a login via Identity service."""

    staff_id: str
    email: EmailStr
    role: str = "staff"  # staff, manager, admin


class CreateUserRequest(BaseModel):
    """Create a new salon user record (admin only).

    Note: Authentication is handled by Identity service.
    This creates a salon-specific user record that will be linked
    to an Identity user when they log in.
    """

    email: EmailStr
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    role: str = "staff"
    staff_id: Optional[str] = None


class UpdateUserRequest(BaseModel):
    """Update user account."""

    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User profile response."""

    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    salon_id: str
    staff_id: Optional[str] = None
    is_active: bool

    @classmethod
    def from_mongo(cls, user: dict) -> "UserResponse":
        return cls(
            id=str(user["_id"]),
            email=user["email"],
            first_name=user["first_name"],
            last_name=user["last_name"],
            role=user["role"],
            salon_id=str(user["salon_id"]),
            staff_id=str(user["staff_id"]) if user.get("staff_id") else None,
            is_active=user.get("is_active", True),
        )
