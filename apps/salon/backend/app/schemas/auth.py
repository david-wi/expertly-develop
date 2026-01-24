from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login credentials."""

    email: EmailStr
    password: str = Field(min_length=8)


class LoginResponse(BaseModel):
    """Login response with tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class TokenRefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str


class RegisterRequest(BaseModel):
    """User registration request."""

    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    salon_id: str  # Must be invited to a salon


class InviteStaffRequest(BaseModel):
    """Invite a staff member to create a login."""

    staff_id: str
    email: EmailStr
    role: str = "staff"  # staff, manager, admin


class CreateUserRequest(BaseModel):
    """Create a new user account (admin only)."""

    email: EmailStr
    password: str = Field(min_length=8)
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


# Update forward reference
LoginResponse.model_rebuild()
