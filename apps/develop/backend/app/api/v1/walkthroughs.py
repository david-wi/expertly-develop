"""Walkthrough API endpoints."""

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import UserContext, get_current_user
from app.database import get_database
from app.models.job import JobType
from app.schemas.walkthrough import WalkthroughCreate, WalkthroughResponse
from app.services.job_service import job_service

router = APIRouter()


@router.post("", response_model=WalkthroughResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_walkthrough(
    data: WalkthroughCreate,
    user: UserContext = Depends(get_current_user),
):
    """
    Create a new walkthrough job.

    Returns immediately with job_id. Use GET /api/v1/jobs/{job_id} to track progress.
    """
    db = get_database()

    # Verify project exists
    project = await db.projects.find_one({
        "_id": ObjectId(data.project_id),
        "tenant_id": user.tenant_id,
        "deleted_at": None,
    })

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Verify persona exists if provided
    if data.persona_id:
        persona = await db.personas.find_one({
            "_id": ObjectId(data.persona_id),
            "project_id": ObjectId(data.project_id),
        })
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Persona not found",
            )

    # If using preconfigured scenario, fetch the template
    scenario_text = data.scenario_text
    observations = data.observations or []

    if data.preconfigured_scenario:
        scenario = await db.preconfigured_scenarios.find_one({
            "code": data.preconfigured_scenario,
            "$or": [
                {"tenant_id": user.tenant_id},
                {"tenant_id": None},
            ]
        })
        if scenario:
            scenario_text = scenario.get("scenario_template", scenario_text)
            observations = observations or scenario.get("default_observations", [])

    # Build job params
    params = {
        "project_id": data.project_id,
        "scenario_text": scenario_text,
        "label": data.label or "Visual Walkthrough",
        "description": data.description,
        "observations": observations,
        "persona_id": data.persona_id,
        "preconfigured_scenario": data.preconfigured_scenario,
    }

    # Create the job
    job = await job_service.create_job(
        tenant_id=user.tenant_id,
        job_type=JobType.WALKTHROUGH,
        params=params,
        requested_by=user.user_id,
        project_id=ObjectId(data.project_id),
    )

    return WalkthroughResponse(
        job_id=str(job.id),
        status="pending",
        message="Walkthrough job created. Use GET /api/v1/jobs/{job_id} to track progress.",
    )
