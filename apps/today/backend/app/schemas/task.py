"""Task schemas."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any


class TaskBase(BaseModel):
    """Base task schema."""
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    priority: int = Field(default=3, ge=1, le=5)
    assignee: str = Field(default="claude", pattern=r"^(claude|user)$")
    project_id: Optional[UUID] = None
    due_date: Optional[str] = None
    context: dict = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class TaskCreate(TaskBase):
    """Schema for creating a task."""
    source: Optional[str] = Field(None, pattern=r"^(manual|recurring|claude)$")


class TaskUpdate(BaseModel):
    """Schema for updating a task."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    assignee: Optional[str] = Field(None, pattern=r"^(claude|user)$")
    project_id: Optional[UUID] = None
    due_date: Optional[str] = None
    context: Optional[dict] = None
    tags: Optional[List[str]] = None


class TaskResponse(TaskBase):
    """Schema for task response."""
    id: UUID
    tenant_id: UUID
    user_id: Optional[UUID]
    status: str
    blocking_question_id: Optional[UUID]
    output: Optional[str]
    source: Optional[str]
    worker_id: Optional[str]  # ID of bot/agent working on this task
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskStart(BaseModel):
    """Schema for starting/claiming a task."""
    worker_id: Optional[str] = Field(None, max_length=100, description="ID of the bot/agent claiming this task")


class TaskComplete(BaseModel):
    """Schema for completing a task.

    learnings_captured must be explicitly set to true to complete a task.
    This enforces the mandatory Learning Loop after every task.
    Set to false only if the task genuinely produced no learnings to capture.
    """
    output: Optional[str] = None
    learnings_captured: bool = Field(
        ...,  # Required field
        description="Must explicitly acknowledge whether learnings were captured. Part of mandatory Learning Loop."
    )
    learnings_summary: Optional[str] = Field(
        None,
        description="Brief summary of what was learned (required if learnings_captured=true)"
    )
    follow_up_tasks: List[TaskCreate] = Field(default_factory=list)


class TaskBlock(BaseModel):
    """Schema for blocking a task."""
    question_text: str = Field(..., min_length=1)
    why_asking: Optional[str] = None
    what_claude_will_do: Optional[str] = None
    priority: int = Field(default=3, ge=1, le=5)


class TaskSummary(BaseModel):
    """Lightweight task summary for context."""
    id: UUID
    title: str
    status: str
    priority: int

    class Config:
        from_attributes = True


class LogEntry(BaseModel):
    """Audit log entry for task history."""
    timestamp: str
    action: str
    actor: str
    details: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class PersonContext(BaseModel):
    """Person info with relationship context."""
    id: UUID
    name: str
    role: Optional[str] = None  # role in the task (subject, recipient, etc.)
    email: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    relationship: Optional[str] = None
    communication_notes: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectSummary(BaseModel):
    """Project summary for task context."""
    id: UUID
    name: str
    description: Optional[str] = None
    project_type: str
    status: str

    class Config:
        from_attributes = True


class PlaybookMatch(BaseModel):
    """Schema for matched playbook info."""
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


class TaskContext(BaseModel):
    """Schema for task context."""
    project: Optional[ProjectSummary] = None
    related_people: List[PersonContext] = Field(default_factory=list)
    related_tasks: List[TaskSummary] = Field(default_factory=list)
    history: List[LogEntry] = Field(default_factory=list)


class TaskNextResponse(BaseModel):
    """Schema for /tasks/next response."""
    task: TaskResponse
    context: TaskContext
    matched_playbooks: List[PlaybookMatch] = Field(default_factory=list)
    must_consult_warnings: List[MustConsultWarning] = Field(default_factory=list)
