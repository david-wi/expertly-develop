from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import uuid4
from datetime import datetime
import json

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.product import Product
from app.models.requirement import Requirement
from app.models.release_snapshot import ReleaseSnapshot
from app.schemas.release import (
    ReleaseSnapshotCreate, ReleaseSnapshotUpdate, ReleaseSnapshotResponse
)

router = APIRouter()


@router.get("", response_model=List[ReleaseSnapshotResponse])
async def list_releases(
    product_id: str = Query(..., description="Product ID to filter by"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List release snapshots for a product."""
    stmt = (
        select(ReleaseSnapshot)
        .where(ReleaseSnapshot.product_id == product_id)
        .order_by(ReleaseSnapshot.created_at.desc())
    )
    result = await db.execute(stmt)
    releases = result.scalars().all()
    return releases


@router.post("", response_model=ReleaseSnapshotResponse, status_code=201)
async def create_release(
    data: ReleaseSnapshotCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new release snapshot."""
    # Verify product exists
    stmt = select(Product).where(Product.id == data.product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Get current requirements
    req_stmt = (
        select(Requirement)
        .where(Requirement.product_id == data.product_id)
        .order_by(Requirement.order_index)
    )
    req_result = await db.execute(req_stmt)
    requirements = req_result.scalars().all()

    # Build snapshot
    requirements_snapshot = [
        {
            "id": r.id,
            "stable_key": r.stable_key,
            "title": r.title,
            "status": r.status,
            "priority": r.priority,
            "parent_id": r.parent_id,
        }
        for r in requirements
    ]

    # Calculate stats
    status_counts = {}
    for r in requirements:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1

    stats = {
        "total": len(requirements),
        "by_status": status_counts,
    }

    now = datetime.utcnow().isoformat()
    release = ReleaseSnapshot(
        id=str(uuid4()),
        product_id=data.product_id,
        version_name=data.version_name.strip(),
        description=data.description.strip() if data.description else None,
        requirements_snapshot=json.dumps(requirements_snapshot),
        stats=json.dumps(stats),
        status="draft",
        created_at=now,
        released_at=None,
    )

    db.add(release)
    await db.flush()
    await db.refresh(release)

    return release


@router.get("/{release_id}", response_model=ReleaseSnapshotResponse)
async def get_release(
    release_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single release snapshot by ID."""
    stmt = select(ReleaseSnapshot).where(ReleaseSnapshot.id == release_id)
    result = await db.execute(stmt)
    release = result.scalar_one_or_none()
    if not release:
        raise HTTPException(status_code=404, detail="Release snapshot not found")
    return release


@router.patch("/{release_id}", response_model=ReleaseSnapshotResponse)
async def update_release(
    release_id: str,
    data: ReleaseSnapshotUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a release snapshot."""
    stmt = select(ReleaseSnapshot).where(ReleaseSnapshot.id == release_id)
    result = await db.execute(stmt)
    release = result.scalar_one_or_none()
    if not release:
        raise HTTPException(status_code=404, detail="Release snapshot not found")

    if data.version_name is not None:
        release.version_name = data.version_name.strip()
    if data.description is not None:
        release.description = data.description.strip() if data.description else None
    if data.status is not None:
        release.status = data.status
        if data.status == "released" and not release.released_at:
            release.released_at = datetime.utcnow().isoformat()

    await db.flush()
    await db.refresh(release)

    return release


@router.delete("/{release_id}", status_code=204)
async def delete_release(
    release_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a release snapshot."""
    stmt = select(ReleaseSnapshot).where(ReleaseSnapshot.id == release_id)
    result = await db.execute(stmt)
    release = result.scalar_one_or_none()
    if not release:
        raise HTTPException(status_code=404, detail="Release snapshot not found")

    await db.delete(release)

    return None
