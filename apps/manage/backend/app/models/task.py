from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class TaskStatus(str, Enum):
    QUEUED = "queued"
    CHECKED_OUT = "checked_out"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class TaskPhase(str, Enum):
    """Workflow phase representing the lifecycle stage of a task.

    Phases are separate from operational status - a task can be
    in phase=in_review with status=in_progress (reviewer actively working).
    """
    PLANNING = "planning"
    READY = "ready"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    IN_REVIEW = "in_review"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    WAITING_ON_SUBPLAYBOOK = "waiting_on_subplaybook"


# Valid phase transitions
VALID_PHASE_TRANSITIONS: dict[TaskPhase, list[TaskPhase]] = {
    TaskPhase.PLANNING: [TaskPhase.READY],
    TaskPhase.READY: [TaskPhase.IN_PROGRESS, TaskPhase.WAITING_ON_SUBPLAYBOOK],
    TaskPhase.IN_PROGRESS: [TaskPhase.PENDING_REVIEW, TaskPhase.APPROVED],
    TaskPhase.PENDING_REVIEW: [TaskPhase.IN_REVIEW],
    TaskPhase.IN_REVIEW: [TaskPhase.CHANGES_REQUESTED, TaskPhase.APPROVED],
    TaskPhase.CHANGES_REQUESTED: [TaskPhase.IN_PROGRESS],
    TaskPhase.APPROVED: [],  # Terminal state
    TaskPhase.WAITING_ON_SUBPLAYBOOK: [TaskPhase.IN_PROGRESS],
}


class Task(MongoModel):
    """Task model - work items in queues."""
    organization_id: str  # UUID from Identity service
    queue_id: PyObjectId
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.QUEUED
    phase: TaskPhase = TaskPhase.PLANNING
    priority: int = 5  # 1-10, lower is higher priority

    # Assignment - user IDs are UUIDs from Identity
    assigned_to_id: Optional[str] = None
    checked_out_at: Optional[datetime] = None
    checked_out_by_id: Optional[str] = None

    # Review assignment - user IDs are UUIDs from Identity
    reviewer_id: Optional[str] = None
    review_requested_at: Optional[datetime] = None

    # Hierarchy - local MongoDB ObjectIds
    parent_task_id: Optional[PyObjectId] = None
    project_id: Optional[PyObjectId] = None

    # SOP reference - local MongoDB ObjectId
    sop_id: Optional[PyObjectId] = None
    current_step: Optional[int] = None

    # Input/Output
    input_data: Optional[dict[str, Any]] = None
    output_data: Optional[dict[str, Any]] = None

    # Timing
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None

    # Retry
    retry_count: int = 0
    max_retries: int = 3

    # Approval assignment
    approver_type: Optional[str] = None  # "user", "team", "anyone"
    approver_id: Optional[str] = None  # User or Team UUID from Identity
    approver_queue_id: Optional[PyObjectId] = None  # Queue where approval task goes
    approval_required: bool = False

    # Scheduling (Advanced Settings)
    scheduled_start: Optional[datetime] = None  # Don't start before this date/time
    scheduled_end: Optional[datetime] = None  # Optional: work window closes
    schedule_timezone: Optional[str] = None  # Timezone for scheduling

    # Manual ordering - decimal for easy insertion between items
    # Initial value: YYYYMMDD.HHMMSS0001 (2 days after creation)
    sequence: Optional[float] = None


class TaskCreate(BaseModel):
    """Schema for creating a task."""
    queue_id: str
    title: str
    description: Optional[str] = None
    priority: int = 5
    parent_task_id: Optional[str] = None
    project_id: Optional[str] = None
    sop_id: Optional[str] = None
    input_data: Optional[dict[str, Any]] = None
    max_retries: int = 3
    # Approval fields
    approver_type: Optional[str] = None
    approver_id: Optional[str] = None
    approver_queue_id: Optional[str] = None
    approval_required: bool = False
    # Scheduling fields
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    schedule_timezone: Optional[str] = None


class TaskUpdate(BaseModel):
    """Schema for updating a task."""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    queue_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    project_id: Optional[str] = None
    sop_id: Optional[str] = None
    phase: Optional[TaskPhase] = None
    # Approval fields
    approver_type: Optional[str] = None
    approver_id: Optional[str] = None
    approver_queue_id: Optional[str] = None
    approval_required: Optional[bool] = None
    # Scheduling fields
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    schedule_timezone: Optional[str] = None
    # Manual ordering
    sequence: Optional[float] = None


class TaskCheckout(BaseModel):
    """Schema for checking out a task."""
    task_id: str


class TaskStart(BaseModel):
    """Schema for starting a task."""
    pass


class TaskComplete(BaseModel):
    """Schema for completing a task."""
    output_data: Optional[dict[str, Any]] = None


class TaskFail(BaseModel):
    """Schema for failing a task."""
    reason: str
    retry: bool = True


class RecurrenceType(str, Enum):
    """Types of recurrence patterns."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"  # Uses cron expression


class RecurringTask(MongoModel):
    """Recurring task template - creates tasks on a schedule."""
    organization_id: str  # UUID from Identity service
    queue_id: PyObjectId
    title: str
    description: Optional[str] = None
    priority: int = 5
    project_id: Optional[PyObjectId] = None

    # Recurrence settings
    recurrence_type: RecurrenceType = RecurrenceType.DAILY
    cron_expression: Optional[str] = None  # For custom schedules, e.g., "0 9 * * 1-5"
    interval: int = 1  # Every N days/weeks/months
    days_of_week: list[int] = Field(default_factory=list)  # 0=Monday, 6=Sunday
    day_of_month: Optional[int] = None  # For monthly recurrence

    # Scheduling
    start_date: datetime
    end_date: Optional[datetime] = None  # None = no end
    next_run: Optional[datetime] = None
    last_run: Optional[datetime] = None
    timezone: str = "UTC"

    # Status
    is_active: bool = True
    created_tasks_count: int = 0

    # Task template data
    input_data: Optional[dict[str, Any]] = None
    max_retries: int = 3


class RecurringTaskCreate(BaseModel):
    """Schema for creating a recurring task."""
    queue_id: str
    title: str
    description: Optional[str] = None
    priority: int = 5
    project_id: Optional[str] = None
    recurrence_type: RecurrenceType = RecurrenceType.DAILY
    cron_expression: Optional[str] = None
    interval: int = 1
    days_of_week: list[int] = Field(default_factory=list)
    day_of_month: Optional[int] = None
    start_date: Optional[datetime] = None  # Defaults to now
    end_date: Optional[datetime] = None
    timezone: str = "UTC"
    input_data: Optional[dict[str, Any]] = None
    max_retries: int = 3


class RecurringTaskUpdate(BaseModel):
    """Schema for updating a recurring task."""
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    queue_id: Optional[str] = None
    project_id: Optional[str] = None
    recurrence_type: Optional[RecurrenceType] = None
    cron_expression: Optional[str] = None
    interval: Optional[int] = None
    days_of_week: Optional[list[int]] = None
    day_of_month: Optional[int] = None
    end_date: Optional[datetime] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None
    input_data: Optional[dict[str, Any]] = None
    max_retries: Optional[int] = None
