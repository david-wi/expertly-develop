"""User model."""

from datetime import datetime
from typing import Optional
from pydantic import Field
import uuid

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class User(MongoModel, TimestampMixin):
    """User model."""

    tenant_id: PyObjectId
    email: str
    name: str
    role: str = "user"  # admin, user
    is_default: bool = False
    api_key: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    deleted_at: Optional[datetime] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "david@example.com",
                "name": "David",
                "role": "admin",
                "is_default": True,
            }
        }
