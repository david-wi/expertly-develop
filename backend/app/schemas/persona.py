"""Persona schemas for API requests/responses."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class PersonaCredentialsInput(BaseModel):
    """Input schema for persona credentials."""

    username: Optional[str] = None
    password: Optional[str] = None


class PersonaCreate(BaseModel):
    """Schema for creating a persona."""

    project_id: str
    name: str = Field(..., min_length=1, max_length=100)
    role_description: Optional[str] = Field(None, max_length=1000)
    goals: List[str] = []
    task_types: List[str] = []
    credentials: Optional[PersonaCredentialsInput] = None


class PersonaUpdate(BaseModel):
    """Schema for updating a persona."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role_description: Optional[str] = Field(None, max_length=1000)
    goals: Optional[List[str]] = None
    task_types: Optional[List[str]] = None
    credentials: Optional[PersonaCredentialsInput] = None


class PersonaResponse(BaseModel):
    """Schema for persona response."""

    id: str
    project_id: str
    name: str
    role_description: Optional[str]
    goals: List[str]
    task_types: List[str]
    has_credentials: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PersonaListResponse(BaseModel):
    """Schema for persona list response."""

    items: List[PersonaResponse]
    total: int
