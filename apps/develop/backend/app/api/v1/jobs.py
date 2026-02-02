"""Job queue API endpoints."""

from typing import Dict, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import UserContext, get_user_context
from app.database import get_database
from app.models.job import JobStatus, JobType
from app.schemas.job import JobResponse, JobListResponse, JobCreateResponse
from app.services.job_service import job_service

router = APIRouter()


def job_to_response(
    job,
    project_names: Dict[str, str] = None,
    current_user: UserContext = None,
) -> JobResponse:
    """Convert job model to response schema."""
    # Use current user's name if they're the requester
    requested_by_name = None
    if current_user and job.requested_by == current_user.user_id:
        requested_by_name = current_user.name
    project_name = None
    if project_names and job.project_id:
        project_name = project_names.get(str(job.project_id))
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
        project_name=project_name,
        requested_by_name=requested_by_name,
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
    user: UserContext = Depends(get_user_context),
):
    """List jobs with optional filters."""
    status_filter = JobStatus(status) if status else None
    type_filter = JobType(job_type) if job_type else None
    project_filter = ObjectId(project_id) if project_id else None

    jobs = await job_service.list_jobs(
        organization_id=user.organization_id,
        status=status_filter,
        job_type=type_filter,
        project_id=project_filter,
        limit=limit,
        offset=offset,
    )

    db = get_database()

    # Lookup project names for jobs with project_id
    project_ids = [j.project_id for j in jobs if j.project_id]
    project_names = {}
    if project_ids:
        cursor = db.projects.find({"_id": {"$in": project_ids}}, {"_id": 1, "name": 1})
        async for p in cursor:
            project_names[str(p["_id"])] = p["name"]

    total = await job_service.count_jobs(user.organization_id)
    stats = await job_service.get_queue_stats(user.organization_id)

    return JobListResponse(
        items=[job_to_response(j, project_names, user) for j in jobs],
        total=total,
        stats=stats,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: UserContext = Depends(get_user_context),
):
    """Get a job by ID."""
    job = await job_service.get_job(ObjectId(job_id))

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    db = get_database()

    # Lookup project name if project_id is set
    project_names = {}
    if job.project_id:
        p = await db.projects.find_one({"_id": job.project_id}, {"_id": 1, "name": 1})
        if p:
            project_names[str(p["_id"])] = p["name"]

    return job_to_response(job, project_names, user)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(
    job_id: str,
    user: UserContext = Depends(get_user_context),
):
    """Cancel a pending or running job."""
    job = await job_service.get_job(ObjectId(job_id))

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job.organization_id != user.organization_id:
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
