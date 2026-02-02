from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class StepStatus(str, Enum):
    """Status of a playbook step response."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class TaskStepResponse(MongoModel):
    """Per-step response for playbook execution on a task."""
    task_id: PyObjectId
    organization_id: str  # UUID from Identity service
    step_id: str  # UUID from PlaybookStep
    step_order: int  # For ordering display
    status: StepStatus = StepStatus.PENDING

    # User's response content
    notes: Optional[str] = None  # Markdown response/notes
    output_data: Optional[dict[str, Any]] = None  # Structured output data

    # Completion tracking
    completed_by_id: Optional[str] = None  # UUID from Identity service
    completed_at: Optional[datetime] = None


class TaskStepResponseCreate(BaseModel):
    """Schema for creating a step response (internal use during checkout)."""
    step_id: str
    step_order: int


class TaskStepResponseUpdate(BaseModel):
    """Schema for updating a step response."""
    notes: Optional[str] = None
    output_data: Optional[dict[str, Any]] = None


class TaskStepResponseComplete(BaseModel):
    """Schema for completing a step."""
    notes: Optional[str] = None
    output_data: Optional[dict[str, Any]] = None


class TaskStepResponseResponse(BaseModel):
    """Response schema for step response."""
    id: str
    task_id: str
    organization_id: str
    step_id: str
    step_order: int
    status: StepStatus
    notes: Optional[str] = None
    output_data: Optional[dict[str, Any]] = None
    completed_by_id: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
