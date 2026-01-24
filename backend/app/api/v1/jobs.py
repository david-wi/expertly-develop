"""Job queue API endpoints."""

from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import UserContext, get_current_user
from app.models.job import JobStatus, JobType
from app.schemas.job import JobResponse, JobListResponse, JobCreateResponse
from app.services.job_service import job_service

router = APIRouter()


def job_to_response(job) -> JobResponse:
    """Convert job model to response schema."""
    return JobResponse(
        id=str(job.id),
        job_type=job.job_type.value if isinstance(job.job_type, JobType) else job.job_type,
        status=job.status.value if isinstance(job.status, JobStatus) else job.status,
        progress=job.progress,
        current_step=job.current_step,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        elapsed_ms=job.elapsed_ms,
        project_id=str(job.project_id) if job.project_id else None,
        result=job.result,
        error=job.error,
    )


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_current_user),
):
    """List jobs with optional filters."""
    status_filter = JobStatus(status) if status else None
    type_filter = JobType(job_type) if job_type else None
    project_filter = ObjectId(project_id) if project_id else None

    jobs = await job_service.list_jobs(
        tenant_id=user.tenant_id,
        status=status_filter,
        job_type=type_filter,
        project_id=project_filter,
        limit=limit,
        offset=offset,
    )

    total = await job_service.count_jobs(user.tenant_id)
    stats = await job_service.get_queue_stats(user.tenant_id)

    return JobListResponse(
        items=[job_to_response(j) for j in jobs],
        total=total,
        stats=stats,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Get a job by ID."""
    job = await job_service.get_job(ObjectId(job_id))

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    return job_to_response(job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(
    job_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Cancel a pending or running job."""
    job = await job_service.get_job(ObjectId(job_id))

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.status not in [JobStatus.PENDING, JobStatus.RUNNING]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job with status: {job.status}",
        )

    success = await job_service.cancel_job(ObjectId(job_id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel job",
        )
