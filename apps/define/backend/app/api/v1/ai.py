import os
import asyncio
import logging
import time
import uuid

import aiofiles
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.config import get_settings
from app.models.product import Product
from app.models.artifact import Artifact
from app.models.artifact_version import ArtifactVersion
from app.models.requirement import Requirement
from app.schemas.ai import (
    ParseRequirementsRequest,
    ParsedRequirement,
    GenerateFromArtifactsRequest,
    GenerateJobStartResponse,
    GenerateJobStatusResponse,
    ExistingRequirement,
)
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()

# In-memory job store for async generation jobs
# Keys: job_id, Values: {"status": str, "requirements": list|None, "error": str|None, "created_at": float}
_generation_jobs: dict[str, dict] = {}

# Auto-expire jobs older than 30 minutes
_JOB_EXPIRY_SECONDS = 30 * 60


def _cleanup_expired_jobs():
    """Remove jobs older than the expiry threshold."""
    now = time.time()
    expired = [jid for jid, job in _generation_jobs.items() if now - job["created_at"] > _JOB_EXPIRY_SECONDS]
    for jid in expired:
        del _generation_jobs[jid]


@router.post("/parse-requirements", response_model=dict)
async def parse_requirements(
    data: ParseRequirementsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Parse requirements from text/files using AI."""
    if not data.description.strip() and not data.files:
        raise HTTPException(status_code=400, detail="Description or files are required")

    ai_service = AIService()

    try:
        requirements = await ai_service.parse_requirements(
            description=data.description,
            files=data.files,
            existing_requirements=data.existing_requirements,
            target_parent_id=data.target_parent_id,
            product_name=data.product_name,
            context_urls=data.context_urls,
            related_requirement_ids=data.related_requirement_ids,
        )

        return {"requirements": requirements}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-from-artifacts", response_model=GenerateJobStartResponse)
async def generate_from_artifacts(
    data: GenerateFromArtifactsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Start async generation of requirements from artifact markdown content using AI.

    Returns a job_id immediately. Poll GET /ai/generate-from-artifacts/{job_id}
    for status and results.
    """
    _cleanup_expired_jobs()

    # Fetch product for name
    product_result = await db.execute(
        select(Product).where(Product.id == data.product_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Fetch artifacts
    artifact_query = select(Artifact).where(
        Artifact.product_id == data.product_id,
        Artifact.status == "active",
    )
    if data.artifact_ids:
        artifact_query = artifact_query.where(Artifact.id.in_(data.artifact_ids))
    artifact_result = await db.execute(artifact_query)
    artifacts = artifact_result.scalars().all()

    if not artifacts:
        raise HTTPException(status_code=400, detail="No artifacts found")

    # Gather markdown from each artifact's latest version (fast I/O step)
    combined_parts = []
    for artifact in artifacts:
        # Get latest version with completed conversion
        version_result = await db.execute(
            select(ArtifactVersion)
            .where(
                ArtifactVersion.artifact_id == artifact.id,
                ArtifactVersion.conversion_status == "completed",
            )
            .order_by(ArtifactVersion.version_number.desc())
            .limit(1)
        )
        version = version_result.scalar_one_or_none()
        if not version:
            continue

        # Read full markdown from disk if available
        markdown = None
        if version.markdown_storage_path:
            full_path = os.path.join(settings.uploads_dir, version.markdown_storage_path)
            if os.path.exists(full_path):
                async with aiofiles.open(full_path, "r") as f:
                    markdown = await f.read()

        # Fall back to inline content
        if not markdown and version.markdown_content:
            markdown = version.markdown_content

        if markdown:
            combined_parts.append(f"--- Artifact: {artifact.name} ---\n{markdown}")

    if not combined_parts:
        raise HTTPException(
            status_code=400,
            detail="No artifacts have completed markdown conversion",
        )

    combined_description = "\n\n".join(combined_parts)

    # Fetch existing requirements for context (exclude soft-deleted)
    req_result = await db.execute(
        select(Requirement).where(
            Requirement.product_id == data.product_id,
            Requirement.deleted_at.is_(None),
        )
    )
    existing_reqs = req_result.scalars().all()
    existing_requirements = [
        ExistingRequirement(
            id=r.id,
            stable_key=r.stable_key,
            title=r.title,
            parent_id=r.parent_id,
            node_type=r.node_type,
        )
        for r in existing_reqs
    ]

    # Create job and kick off background AI generation
    job_id = str(uuid.uuid4())
    _generation_jobs[job_id] = {
        "status": "processing",
        "requirements": None,
        "error": None,
        "created_at": time.time(),
    }

    asyncio.create_task(
        _run_generation(
            job_id=job_id,
            combined_description=combined_description,
            existing_requirements=existing_requirements,
            target_parent_id=data.target_parent_id,
            product_name=product.name,
        )
    )

    return GenerateJobStartResponse(job_id=job_id)


async def _run_generation(
    job_id: str,
    combined_description: str,
    existing_requirements: list[ExistingRequirement],
    target_parent_id: str | None,
    product_name: str,
):
    """Background task that runs the AI generation and updates the job store."""
    try:
        ai_service = AIService()
        requirements = await ai_service.parse_requirements(
            description=combined_description,
            files=None,
            existing_requirements=existing_requirements,
            target_parent_id=target_parent_id,
            product_name=product_name,
        )
        _generation_jobs[job_id]["status"] = "completed"
        _generation_jobs[job_id]["requirements"] = requirements
    except Exception as e:
        logger.error(f"AI generation from artifacts failed (job {job_id}): {e}")
        _generation_jobs[job_id]["status"] = "failed"
        _generation_jobs[job_id]["error"] = str(e)


@router.get("/generate-from-artifacts/{job_id}", response_model=GenerateJobStatusResponse)
async def get_generation_status(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Poll the status of an async requirements generation job."""
    job = _generation_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")

    return GenerateJobStatusResponse(
        status=job["status"],
        requirements=job["requirements"],
        error=job["error"],
    )
