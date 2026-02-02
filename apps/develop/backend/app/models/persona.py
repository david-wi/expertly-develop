"""Persona model for project user roles."""

from datetime import datetime
from typing import List, Optional
from pydantic import Field

from app.models.base import MongoModel, TimestampMixin, PyObjectId


class PersonaCredentials(MongoModel):
    """Encrypted credentials for persona login."""

    username: Optional[str] = None  # Encrypted
    password: Optional[str] = None  # Encrypted


class Persona(MongoModel, TimestampMixin):
    """Persona model representing a user role within a project."""

    project_id: PyObjectId
    organization_id: str  # Identity organization UUID
    name: str
    role_description: Optional[str] = None
    goals: List[str] = Field(default_factory=list)
    task_types: List[str] = Field(default_factory=list)
    credentials: Optional[PersonaCredentials] = None

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Admin User",
                "role_description": "IT administrator responsible for system configuration",
                "goals": ["Configure system", "Add users", "Manage permissions"],
                "task_types": ["configuration", "user_management"],
            }
        }
