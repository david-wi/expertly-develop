"""User model - shadow records for Identity users."""

from datetime import datetime
from typing import Optional
from pydantic import Field
import uuid

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class User(MongoModel, TimestampMixin):
    """
    User model - shadow records for Identity service users.

    Authentication is handled by Identity service. This collection stores
    local references for relationships and caches user data.
    """

    tenant_id: PyObjectId
    email: str
    name: str
    role: str = "user"  # admin, user
    is_default: bool = False
    api_key: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    deleted_at: Optional[datetime] = None

    # Link to Identity service
    identity_id: Optional[str] = None  # UUID from Identity service

    class Config:
        json_schema_extra = {
            "example": {
                "email": "david@example.com",
                "name": "David",
                "role": "admin",
                "is_default": True,
                "identity_id": "550e8400-e29b-41d4-a716-446655440000",
            }
        }
