"""Question schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class QuestionBase(BaseModel):
    """Base question schema."""
    text: str = Field(..., min_length=1)
    context: Optional[str] = None
    why_asking: Optional[str] = None
    what_claude_will_do: Optional[str] = None
    priority: int = Field(default=3, ge=1, le=5)


class QuestionCreate(QuestionBase):
    """Schema for creating a question."""
    task_ids: List[UUID] = Field(default_factory=list)  # Tasks this question unblocks


class QuestionResponse(QuestionBase):
    """Schema for question response."""
    id: UUID
    tenant_id: UUID
    user_id: Optional[UUID]
    priority_reason: Optional[str]
    status: str
    answer: Optional[str]
    answered_at: Optional[str]
    answered_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionAnswer(BaseModel):
    """Schema for answering a question."""
    answer: str = Field(..., min_length=1)


class QuestionDismiss(BaseModel):
    """Schema for dismissing a question."""
    reason: Optional[str] = None


class QuestionWithUnblockedTasks(QuestionResponse):
    """Schema for question response with unblocked task info."""
    unblocked_task_ids: List[UUID] = Field(default_factory=list)
