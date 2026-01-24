"""Generic job queue model."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import Field

from app.models.base import MongoModel, PyObjectId


class JobStatus(str, Enum):
    """Job status options."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobType(str, Enum):
    """Available job types."""

    WALKTHROUGH = "walkthrough"
    # Add more job types as needed


class Job(MongoModel):
    """Generic job queue model."""

    tenant_id: PyObjectId

    # Job identification
    job_type: JobType

    # Status
    status: JobStatus = JobStatus.PENDING
    progress: int = 0  # 0-100
    current_step: Optional[str] = None

    # Timing
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    elapsed_ms: Optional[int] = None

    # Context
    requested_by: Optional[PyObjectId] = None
    project_id: Optional[PyObjectId] = None

    # Type-specific params (stored as JSON)
    params: Dict[str, Any] = Field(default_factory=dict)

    # Results
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def start(self) -> None:
        """Mark job as started."""
        self.status = JobStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

    def complete(self, result: Dict[str, Any]) -> None:
        """Mark job as completed."""
        self.status = JobStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
        self.result = result
        self.progress = 100
        if self.started_at:
            self.elapsed_ms = int(
                (self.completed_at - self.started_at).total_seconds() * 1000
            )

    def fail(self, error: str) -> None:
        """Mark job as failed."""
        self.status = JobStatus.FAILED
        self.completed_at = datetime.now(timezone.utc)
        self.error = error
        if self.started_at:
            self.elapsed_ms = int(
                (self.completed_at - self.started_at).total_seconds() * 1000
            )

    def update_progress(self, progress: int, step: Optional[str] = None) -> None:
        """Update job progress."""
        self.progress = min(max(progress, 0), 100)
        if step:
            self.current_step = step

    class Config:
        json_schema_extra = {
            "example": {
                "job_type": "walkthrough",
                "status": "running",
                "progress": 45,
                "current_step": "Capturing homepage...",
                "params": {
                    "scenario_text": "Navigate to homepage and capture screenshots",
                    "label": "Homepage walkthrough",
                },
            }
        }
