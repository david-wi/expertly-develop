"""Knowledge schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class KnowledgeCategory:
    """Valid knowledge categories."""
    PLAYBOOK = "playbook"
    PERSON = "person"
    CLIENT = "client"
    PROJECT = "project"
    SETTING = "setting"
    RULE = "rule"

    ALL = [PLAYBOOK, PERSON, CLIENT, PROJECT, SETTING, RULE]


# Trigger phrases that force knowledge capture
TRIGGER_PHRASES = [
    "remember that",
    "for future reference",
    "here's how we do this",
    "going forward",
    "always",
    "never",
    "fyi for next time",
    "note that",
    "keep in mind",
    "important:",
]


class KnowledgeCapture(BaseModel):
    """Schema for capturing knowledge."""
    content: str = Field(..., min_length=1)
    category: str = Field(..., pattern=f"^({'|'.join(KnowledgeCategory.ALL)})$")
    source_task_id: Optional[UUID] = None
    trigger_phrase: Optional[str] = None


class KnowledgeResponse(BaseModel):
    """Schema for knowledge response."""
    id: UUID
    tenant_id: UUID
    content: str
    category: str
    source_type: str
    trigger_phrase: Optional[str]
    status: str
    routed_to_type: Optional[str]
    routed_to_id: Optional[UUID]
    learned_at: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RoutingResult(BaseModel):
    """Schema for routing result."""
    type: str
    id: Optional[UUID] = None
    field_updated: Optional[str] = None
    action_taken: str


class KnowledgeCaptureResponse(BaseModel):
    """Schema for knowledge capture response."""
    knowledge: KnowledgeResponse
    routed_to: Optional[RoutingResult] = None


class KnowledgeRoute(BaseModel):
    """Schema for manually routing knowledge."""
    target_type: str
    target_id: UUID


class KnowledgeDismiss(BaseModel):
    """Schema for dismissing knowledge."""
    reason: Optional[str] = None


class TriggerPhrasesResponse(BaseModel):
    """Schema for trigger phrases response."""
    phrases: List[str]
