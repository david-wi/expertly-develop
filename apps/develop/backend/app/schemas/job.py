"""Job schemas for API requests/responses."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.models.job import JobStatus, JobType


class JobResponse(BaseModel):
    """Schema for job response."""

    id: str
    job_type: str
    status: str
    progress: int
    current_step: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    elapsed_ms: Optional[int]
    project_id: Optional[str]
    project_name: Optional[str] = None
    requested_by_name: Optional[str] = None
    result: Optional[Dict[str, Any]]
    error: Optional[str]

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Schema for job list response."""

    items: List[JobResponse]
    total: int
    stats: Dict[str, int]


class JobCreateResponse(BaseModel):
    """Schema for job creation response."""

    job_id: str
    status: str
    message: str
