"""Authentication-related schemas."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserResponse(BaseModel):
    """Public representation of a user (populated from Identity session)."""

    user_id: str = Field(alias="userId", description="User identifier")
    account_id: str = Field(alias="accountId", description="Organization identifier")
    email: Optional[str] = Field(default=None, description="User email address")
    name: str = Field(description="Display name")
    role: str = Field(description="User role within the account (admin, editor, viewer)")

    model_config = ConfigDict(populate_by_name=True)
