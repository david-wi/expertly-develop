import os
import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session_maker
from app.api.deps import get_current_user, CurrentUser
from app.config import get_settings
from app.models.product import Product
from app.models.artifact import Artifact
from app.models.artifact_version import ArtifactVersion
from app.models.requirement import Requirement
from app.models.requirement_version import RequirementVersion
from app.schemas.ai import (
    ParseRequirementsRequest,
    ParsedRequirement,
    GenerateFromArtifactsRequest,
    GenerateJobStartResponse,
    GenerateJobStatusResponse,
    ExistingRequirement,
)
from app.services.ai_service import AIService, ENRICHMENT_BATCH_SIZE, MAX_CONCURRENCY

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
        "progress": None,
        "created_count": 0,
        "created_at": time.time(),
    }

    asyncio.create_task(
        _run_generation(
            job_id=job_id,
            product_id=data.product_id,
            product_prefix=product.prefix,
            user_name=current_user.name,
            combined_description=combined_description,
            existing_requirements=existing_requirements,
            target_parent_id=data.target_parent_id,
            product_name=product.name,
        )
    )

    return GenerateJobStartResponse(job_id=job_id)


async def _generate_stable_key(db: AsyncSession, product_id: str, prefix: str) -> str:
    """Generate stable key for a requirement."""
    stmt = select(func.count(Requirement.id)).where(Requirement.product_id == product_id)
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"{prefix}-{str(count + 1).zfill(3)}"


async def _batch_create_in_db(
    product_id: str,
    product_prefix: str,
    user_name: str,
    nodes: list[dict],
    temp_to_real: dict[str, str],
) -> dict[str, str]:
    """Persist a batch of nodes to the DB. Returns updated temp_to_real mapping."""
    now = datetime.utcnow().isoformat()

    async with async_session_maker() as db:
        try:
            created_pairs = []
            for node in nodes:
                temp_id = node.get("temp_id", "")
                title = (node.get("title") or "").strip()
                if not title:
                    continue

                stable_key = await _generate_stable_key(db, product_id, product_prefix)
                requirement_id = str(uuid4())
                temp_to_real[temp_id] = requirement_id

                # Resolve parent_ref to real ID
                parent_ref = node.get("parent_ref")
                parent_id = None
                if parent_ref:
                    parent_id = temp_to_real.get(parent_ref, parent_ref)

                node_type = node.get("node_type", "requirement")
                valid_types = {"product", "module", "feature", "requirement", "guardrail"}
                if node_type not in valid_types:
                    node_type = "requirement"

                tags = node.get("tags", ["functional"])

                requirement = Requirement(
                    id=requirement_id,
                    product_id=product_id,
                    parent_id=parent_id,
                    stable_key=stable_key,
                    title=title,
                    node_type=node_type,
                    what_this_does=(node.get("what_this_does") or "").strip() or None,
                    why_this_exists=(node.get("why_this_exists") or "").strip() or None,
                    not_included=(node.get("not_included") or "").strip() or None,
                    acceptance_criteria=(node.get("acceptance_criteria") or "").strip() or None,
                    status="draft",
                    priority=node.get("priority", "medium"),
                    tags=json.dumps(tags) if tags else None,
                    order_index=0,
                    current_version=1,
                    created_at=now,
                    updated_at=now,
                )
                db.add(requirement)
                created_pairs.append((requirement, node))

            await db.flush()

            # Calculate order indices
            parent_order_counts: dict[str, int] = {}
            for requirement, node in created_pairs:
                parent_key = requirement.parent_id or "root"
                if parent_key not in parent_order_counts:
                    if requirement.parent_id:
                        max_stmt = select(func.max(Requirement.order_index)).where(
                            and_(Requirement.product_id == product_id, Requirement.parent_id == requirement.parent_id, Requirement.id != requirement.id)
                        )
                    else:
                        max_stmt = select(func.max(Requirement.order_index)).where(
                            and_(Requirement.product_id == product_id, Requirement.parent_id.is_(None), Requirement.id != requirement.id)
                        )
                    result = await db.execute(max_stmt)
                    max_order = result.scalar()
                    parent_order_counts[parent_key] = (max_order or -1) + 1

                requirement.order_index = parent_order_counts[parent_key]
                parent_order_counts[parent_key] += 1

                # Create version record
                version = RequirementVersion(
                    id=str(uuid4()),
                    requirement_id=requirement.id,
                    version_number=1,
                    snapshot=json.dumps({
                        "title": requirement.title,
                        "node_type": requirement.node_type,
                        "what_this_does": requirement.what_this_does,
                        "why_this_exists": requirement.why_this_exists,
                        "not_included": requirement.not_included,
                        "acceptance_criteria": requirement.acceptance_criteria,
                        "status": requirement.status,
                        "priority": requirement.priority,
                        "tags": node.get("tags", []),
                    }),
                    change_summary="AI generation from artifacts",
                    changed_by=user_name,
                    changed_at=now,
                    status="active",
                )
                db.add(version)

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    return temp_to_real


async def _batch_update_enrichment(
    temp_to_real: dict[str, str],
    enriched_nodes: list[dict],
):
    """Update existing DB records with enrichment details."""
    async with async_session_maker() as db:
        try:
            for node in enriched_nodes:
                temp_id = node.get("temp_id", "")
                real_id = temp_to_real.get(temp_id)
                if not real_id:
                    continue

                result = await db.execute(
                    select(Requirement).where(Requirement.id == real_id)
                )
                req = result.scalar_one_or_none()
                if not req:
                    continue

                if node.get("what_this_does"):
                    req.what_this_does = node["what_this_does"].strip()
                if node.get("why_this_exists"):
                    req.why_this_exists = node["why_this_exists"].strip()
                if node.get("not_included"):
                    req.not_included = node["not_included"].strip()
                if node.get("acceptance_criteria"):
                    req.acceptance_criteria = node["acceptance_criteria"].strip()
                req.updated_at = datetime.utcnow().isoformat()

            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def _run_generation(
    job_id: str,
    product_id: str,
    product_prefix: str,
    user_name: str,
    combined_description: str,
    existing_requirements: list[ExistingRequirement],
    target_parent_id: str | None,
    product_name: str,
):
    """Background task: three-phase generation with incremental DB persistence."""
    job = _generation_jobs[job_id]

    def update_progress(msg: str):
        job["progress"] = msg

    def update_count(n: int):
        job["created_count"] = n

    try:
        ai_service = AIService()
        temp_to_real: dict[str, str] = {}

        # Build context once
        tree_text, file_context, images, url_context, related_reqs_context, target_info = \
            ai_service._build_input_context(
                combined_description, None, existing_requirements, target_parent_id,
                product_name,
            )

        # ---- Phase 1: Generate outline ----
        update_progress("Generating high-level structure (product, modules, features)...")
        logger.info(f"Job {job_id}: Phase 1 — generating outline")

        outline = await ai_service.generate_outline(
            description=combined_description,
            tree_text=tree_text,
            file_context=file_context,
            images=images,
            url_context=url_context,
            related_reqs_context=related_reqs_context,
            target_info=target_info,
            product_name=product_name,
        )

        # Assign temp_ids if missing
        for i, node in enumerate(outline):
            if not node.get("temp_id"):
                node["temp_id"] = f"temp-{i + 1}"

        # Save outline to DB immediately
        update_progress(f"Saving {len(outline)} outline nodes...")
        temp_to_real = await _batch_create_in_db(
            product_id, product_prefix, user_name, outline, temp_to_real,
        )
        update_count(len(temp_to_real))
        logger.info(f"Job {job_id}: Phase 1 complete — {len(outline)} outline nodes saved")

        # ---- Phase 2: Expand features into requirements ----
        features = [n for n in outline if n.get("node_type") == "feature"]
        logger.info(f"Job {job_id}: Phase 2 — expanding {len(features)} features")

        if features:
            # Calculate starting temp_id for requirements
            max_outline_id = 0
            for n in outline:
                tid = n.get("temp_id", "")
                if tid.startswith("temp-"):
                    try:
                        max_outline_id = max(max_outline_id, int(tid.split("-")[1]))
                    except ValueError:
                        pass
            next_id = max_outline_id + 1

            semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
            completed_features = 0
            ID_BLOCK_SIZE = 50
            all_requirement_nodes: list[dict] = []

            async def expand_and_save(feature_node: dict, start_id: int) -> None:
                nonlocal completed_features
                async with semaphore:
                    nodes = await ai_service.expand_feature(
                        description=combined_description,
                        outline=outline,
                        feature_node=feature_node,
                        product_name=product_name,
                        next_temp_id_start=start_id,
                    )
                    # Save this feature's requirements to DB immediately
                    # Replace parent_ref with the real ID of the feature
                    feature_temp_id = feature_node.get("temp_id", "")
                    for node in nodes:
                        if node.get("parent_ref") == feature_temp_id:
                            node["parent_ref"] = temp_to_real.get(feature_temp_id, feature_temp_id)

                    await _batch_create_in_db(
                        product_id, product_prefix, user_name, nodes, temp_to_real,
                    )
                    all_requirement_nodes.extend(nodes)
                    completed_features += 1
                    update_count(len(temp_to_real))
                    update_progress(
                        f"Expanding features ({completed_features}/{len(features)}) — {len(temp_to_real)} nodes created"
                    )

            tasks = []
            for i, feature in enumerate(features):
                start = next_id + (i * ID_BLOCK_SIZE)
                tasks.append(expand_and_save(feature, start))

            await asyncio.gather(*tasks)
            logger.info(f"Job {job_id}: Phase 2 complete — {len(all_requirement_nodes)} requirements saved")
        else:
            all_requirement_nodes = []

        # ---- Phase 3: Enrich all nodes with details ----
        all_nodes = outline + all_requirement_nodes
        batches = [
            all_nodes[i:i + ENRICHMENT_BATCH_SIZE]
            for i in range(0, len(all_nodes), ENRICHMENT_BATCH_SIZE)
        ]
        total_batches = len(batches)
        logger.info(f"Job {job_id}: Phase 3 — enriching {len(all_nodes)} nodes in {total_batches} batches")

        semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
        completed_batches = 0

        async def enrich_and_save(batch_nodes: list) -> None:
            nonlocal completed_batches
            async with semaphore:
                enriched = await ai_service.enrich_batch(
                    description=combined_description,
                    all_nodes=all_nodes,
                    batch_nodes=batch_nodes,
                    product_name=product_name,
                )
                # Update DB records with enrichment
                await _batch_update_enrichment(temp_to_real, enriched)
                completed_batches += 1
                update_progress(
                    f"Adding details ({completed_batches}/{total_batches} batches) — {len(temp_to_real)} nodes total"
                )

        await asyncio.gather(*(enrich_and_save(batch) for batch in batches))
        logger.info(f"Job {job_id}: Phase 3 complete — all nodes enriched")

        job["status"] = "completed"
        job["progress"] = f"Done — {len(temp_to_real)} requirements created"

    except Exception as e:
        logger.error(f"AI generation from artifacts failed (job {job_id}): {e}")
        job["status"] = "failed"
        job["error"] = str(e)
        # Note: partially created nodes remain in DB — this is by design
        # so the user can see what was generated before the failure


@router.get("/generate-from-artifacts/{job_id}", response_model=GenerateJobStatusResponse)
async def get_generation_status(
    job_id: str,
):
    """Poll the status of an async requirements generation job.

    No auth required — the job_id is an unguessable UUID that serves as
    a bearer token.  Removing auth here avoids Identity-service round-trips
    during polling, which previously timed out when the event loop was
    saturated by concurrent AI calls.
    """
    job = _generation_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")

    return GenerateJobStatusResponse(
        status=job["status"],
        requirements=job.get("requirements"),
        error=job.get("error"),
        progress=job.get("progress"),
        created_count=job.get("created_count", 0),
    )
