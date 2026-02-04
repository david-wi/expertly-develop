from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login request with email and password."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response with session token and user info."""
    session_token: str
    expires_at: datetime
    user: "AuthUserResponse"


class AuthUserResponse(BaseModel):
    """User info returned from auth endpoints."""
    id: UUID
    name: str
    email: Optional[str]
    organization_id: UUID
    organization_name: Optional[str] = None
    role: str
    avatar_url: Optional[str] = None
    is_expertly_admin: bool = False

    class Config:
        from_attributes = True


class AccessibleOrganization(BaseModel):
    """Organization that a user has access to."""
    id: UUID
    name: str
    slug: str
    role: str  # Role within this organization
    is_primary: bool = False

    class Config:
        from_attributes = True


class AccessibleOrganizationsResponse(BaseModel):
    """Response containing all organizations a user can access."""
    organizations: List[AccessibleOrganization]
    is_expertly_admin: bool = False  # If true, user has access to all orgs


class ValidateResponse(BaseModel):
    """Session validation response."""
    valid: bool
    user: Optional[AuthUserResponse] = None
    expires_at: Optional[datetime] = None


class SessionInfo(BaseModel):
    """Session information."""
    id: UUID
    created_at: datetime
    expires_at: datetime
    last_active_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True


# =====================
# Magic Code (Passwordless Login)
# =====================

class MagicCodeRequest(BaseModel):
    """Request a magic code for passwordless login."""
    email: EmailStr


class MagicCodeResponse(BaseModel):
    """Response after requesting a magic code."""
    message: str
    expires_in_minutes: int = 15


class MagicCodeVerifyRequest(BaseModel):
    """Verify a magic code to complete login."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


# =====================
# Password Management
# =====================

class ChangePasswordRequest(BaseModel):
    """Change password for logged-in user."""
    current_password: str
    new_password: str


class ChangePasswordResponse(BaseModel):
    """Response after changing password."""
    message: str


class ForgotPasswordRequest(BaseModel):
    """Request a password reset."""
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Response after requesting password reset."""
    message: str


class ResetPasswordRequest(BaseModel):
    """Reset password using a token."""
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    """Response after resetting password."""
    message: str


class PasswordValidationError(BaseModel):
    """Password validation error details."""
    errors: List[str]


# =====================
# Organization Switching
# =====================

class SwitchOrganizationRequest(BaseModel):
    """Switch to a different organization."""
    organization_id: UUID


class SwitchOrganizationResponse(BaseModel):
    """Response after switching organizations."""
    message: str
    user: AuthUserResponse


# Update forward references
LoginResponse.model_rebuild()
SwitchOrganizationResponse.model_rebuild()
