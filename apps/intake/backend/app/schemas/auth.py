"""Authentication and user-related schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    """Credentials for email/password login."""

    email: EmailStr = Field(description="User email address")
    password: str = Field(min_length=1, description="User password")

    model_config = ConfigDict(populate_by_name=True)


class LoginResponse(BaseModel):
    """Successful login payload."""

    token: str = Field(description="JWT bearer token")
    token_type: str = Field(default="bearer", alias="tokenType")
    expires_at: datetime = Field(alias="expiresAt", description="Token expiration timestamp")
    user: "UserResponse" = Field(description="Authenticated user details")

    model_config = ConfigDict(populate_by_name=True)


class UserResponse(BaseModel):
    """Public representation of a user."""

    user_id: str = Field(alias="userId", description="User identifier")
    account_id: str = Field(alias="accountId", description="Owning account identifier")
    email: EmailStr = Field(description="User email address")
    name: str = Field(description="Display name")
    phone: Optional[str] = Field(default=None, description="Phone number")
    role: str = Field(description="User role within the account (e.g. admin, member)")
    created_at: datetime = Field(alias="createdAt")
    last_login_at: Optional[datetime] = Field(
        default=None,
        alias="lastLoginAt",
        description="Timestamp of the most recent login",
    )

    model_config = ConfigDict(populate_by_name=True)


class AccountResponse(BaseModel):
    """Public representation of an account (organization / tenant)."""

    account_id: str = Field(alias="accountId")
    account_name: str = Field(alias="accountName", description="Display name of the account")
    is_active: bool = Field(default=True, alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


class CreateUserRequest(BaseModel):
    """Request to create a new user within the current account."""

    email: EmailStr = Field(description="Email address for the new user")
    name: str = Field(min_length=1, max_length=200, description="Display name")
    role: str = Field(
        default="member",
        description="Role to assign (e.g. admin, member, viewer)",
    )

    model_config = ConfigDict(populate_by_name=True)
