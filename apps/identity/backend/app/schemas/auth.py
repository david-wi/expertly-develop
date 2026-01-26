from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


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

    class Config:
        from_attributes = True


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


# Update forward references
LoginResponse.model_rebuild()
