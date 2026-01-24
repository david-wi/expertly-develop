"""Playbook schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class PlaybookBase(BaseModel):
    """Base playbook schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    triggers: List[str] = Field(default_factory=list)
    must_consult: bool = False
    content: str = Field(..., min_length=1)


class PlaybookCreate(PlaybookBase):
    """Schema for creating a playbook."""
    learned_from: Optional[str] = None
    source_task_id: Optional[UUID] = None


class PlaybookPropose(BaseModel):
    """Schema for proposing a new playbook."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    category: Optional[str] = None
    triggers: List[str] = Field(default_factory=list)
    learned_from: Optional[str] = None
    source_task_id: Optional[UUID] = None


class PlaybookUpdate(BaseModel):
    """Schema for updating a playbook."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    triggers: Optional[List[str]] = None
    must_consult: Optional[bool] = None
    content: Optional[str] = None


class PlaybookResponse(PlaybookBase):
    """Schema for playbook response."""
    id: UUID
    tenant_id: UUID
    learned_from: Optional[str]
    source_task_id: Optional[UUID]
    last_used: Optional[str]
    use_count: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlaybookMatchResult(BaseModel):
    """Schema for a matched playbook."""
    id: UUID
    name: str
    must_consult: bool
    match_reason: str
    relevance_score: float = 1.0
    content_preview: Optional[str] = None


class MustConsultWarning(BaseModel):
    """Schema for must_consult warning."""
    playbook_name: str
    playbook_id: UUID
    warning: str


class PlaybookMatchResponse(BaseModel):
    """Schema for playbook match response."""
    matched: List[PlaybookMatchResult]
    must_consult: List[MustConsultWarning]
