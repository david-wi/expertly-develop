from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, and_, select
from typing import List
from uuid import uuid4
from datetime import datetime
import json

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.product import Product
from app.models.requirement import Requirement
from app.models.requirement_version import RequirementVersion
from app.schemas.requirement import (
    RequirementCreate, RequirementUpdate, RequirementResponse, RequirementBatchCreate
)

router = APIRouter()


async def generate_stable_key(db: AsyncSession, product_id: str, prefix: str) -> str:
    """Generate stable key for a requirement."""
    stmt = select(func.count(Requirement.id)).where(Requirement.product_id == product_id)
    result = await db.execute(stmt)
    count = result.scalar() or 0
    return f"{prefix}-{str(count + 1).zfill(3)}"


@router.get("", response_model=List[RequirementResponse])
async def list_requirements(
    product_id: str = Query(..., description="Product ID to filter by"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List requirements for a product."""
    stmt = (
        select(Requirement)
        .where(Requirement.product_id == product_id)
        .order_by(Requirement.order_index)
    )
    result = await db.execute(stmt)
    requirements = result.scalars().all()
    return requirements


@router.post("", response_model=RequirementResponse, status_code=201)
async def create_requirement(
    data: RequirementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new requirement."""
    # Verify product exists
    stmt = select(Product).where(Product.id == data.product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    stable_key = await generate_stable_key(db, data.product_id, product.prefix)

    # Get max order index for siblings
    if data.parent_id:
        max_order_stmt = (
            select(func.max(Requirement.order_index))
            .where(
                and_(
                    Requirement.product_id == data.product_id,
                    Requirement.parent_id == data.parent_id,
                )
            )
        )
    else:
        max_order_stmt = (
            select(func.max(Requirement.order_index))
            .where(
                and_(
                    Requirement.product_id == data.product_id,
                    Requirement.parent_id.is_(None),
                )
            )
        )
    max_order_result = await db.execute(max_order_stmt)
    max_order = max_order_result.scalar()
    order_index = (max_order or -1) + 1

    requirement_id = str(uuid4())
    requirement = Requirement(
        id=requirement_id,
        product_id=data.product_id,
        parent_id=data.parent_id,
        stable_key=stable_key,
        title=data.title.strip(),
        what_this_does=data.what_this_does.strip() if data.what_this_does else None,
        why_this_exists=data.why_this_exists.strip() if data.why_this_exists else None,
        not_included=data.not_included.strip() if data.not_included else None,
        acceptance_criteria=data.acceptance_criteria.strip() if data.acceptance_criteria else None,
        status=data.status,
        priority=data.priority,
        tags=json.dumps(data.tags) if data.tags else None,
        order_index=order_index,
        current_version=1,
        created_at=now,
        updated_at=now,
    )

    db.add(requirement)

    # Create initial version
    version = RequirementVersion(
        id=str(uuid4()),
        requirement_id=requirement_id,
        version_number=1,
        snapshot=json.dumps({
            "title": requirement.title,
            "what_this_does": requirement.what_this_does,
            "why_this_exists": requirement.why_this_exists,
            "not_included": requirement.not_included,
            "acceptance_criteria": requirement.acceptance_criteria,
            "status": requirement.status,
            "priority": requirement.priority,
            "tags": data.tags,
        }),
        change_summary="Initial creation",
        changed_by=current_user.name,
        changed_at=now,
        status="active",
    )
    db.add(version)

    await db.flush()
    await db.refresh(requirement)

    return requirement


@router.get("/{requirement_id}", response_model=RequirementResponse)
async def get_requirement(
    requirement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single requirement by ID."""
    stmt = select(Requirement).where(Requirement.id == requirement_id)
    result = await db.execute(stmt)
    requirement = result.scalar_one_or_none()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return requirement


@router.patch("/{requirement_id}", response_model=RequirementResponse)
async def update_requirement(
    requirement_id: str,
    data: RequirementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a requirement."""
    stmt = select(Requirement).where(Requirement.id == requirement_id)
    result = await db.execute(stmt)
    requirement = result.scalar_one_or_none()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    changes = []
    if data.title is not None:
        requirement.title = data.title.strip()
        changes.append("title")
    if data.what_this_does is not None:
        requirement.what_this_does = data.what_this_does.strip() if data.what_this_does else None
        changes.append("what_this_does")
    if data.why_this_exists is not None:
        requirement.why_this_exists = data.why_this_exists.strip() if data.why_this_exists else None
        changes.append("why_this_exists")
    if data.not_included is not None:
        requirement.not_included = data.not_included.strip() if data.not_included else None
        changes.append("not_included")
    if data.acceptance_criteria is not None:
        requirement.acceptance_criteria = data.acceptance_criteria.strip() if data.acceptance_criteria else None
        changes.append("acceptance_criteria")
    if data.status is not None:
        requirement.status = data.status
        changes.append("status")
    if data.priority is not None:
        requirement.priority = data.priority
        changes.append("priority")
    if data.tags is not None:
        requirement.tags = json.dumps(data.tags) if data.tags else None
        changes.append("tags")
    if data.parent_id is not None:
        requirement.parent_id = data.parent_id if data.parent_id else None
        changes.append("parent_id")
    if data.order_index is not None:
        requirement.order_index = data.order_index
        changes.append("order_index")

    now = datetime.utcnow().isoformat()
    requirement.updated_at = now

    # Create new version if content changed
    if changes and any(c not in ["order_index", "parent_id"] for c in changes):
        requirement.current_version += 1
        version = RequirementVersion(
            id=str(uuid4()),
            requirement_id=requirement_id,
            version_number=requirement.current_version,
            snapshot=json.dumps({
                "title": requirement.title,
                "what_this_does": requirement.what_this_does,
                "why_this_exists": requirement.why_this_exists,
                "not_included": requirement.not_included,
                "acceptance_criteria": requirement.acceptance_criteria,
                "status": requirement.status,
                "priority": requirement.priority,
                "tags": json.loads(requirement.tags) if requirement.tags else None,
            }),
            change_summary=f"Updated: {', '.join(changes)}",
            changed_by=current_user.name,
            changed_at=now,
            status="active",
        )
        db.add(version)

        # Mark previous version as superseded
        update_stmt = (
            select(RequirementVersion)
            .where(
                RequirementVersion.requirement_id == requirement_id,
                RequirementVersion.version_number < requirement.current_version,
                RequirementVersion.status == "active",
            )
        )
        prev_versions_result = await db.execute(update_stmt)
        for prev_version in prev_versions_result.scalars().all():
            prev_version.status = "superseded"

    await db.flush()
    await db.refresh(requirement)

    return requirement


@router.delete("/{requirement_id}", status_code=204)
async def delete_requirement(
    requirement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a requirement and all related data."""
    stmt = select(Requirement).where(Requirement.id == requirement_id)
    result = await db.execute(stmt)
    requirement = result.scalar_one_or_none()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    await db.delete(requirement)

    return None


@router.post("/batch", response_model=List[RequirementResponse], status_code=201)
async def create_requirements_batch(
    data: RequirementBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create multiple requirements at once (for AI import)."""
    # Verify product exists
    stmt = select(Product).where(Product.id == data.product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    temp_id_to_real_id = {}
    created_requirements = []

    # First pass: create all requirements without parent relationships
    for item in data.requirements:
        stable_key = await generate_stable_key(db, data.product_id, product.prefix)
        requirement_id = str(uuid4())
        temp_id_to_real_id[item.temp_id] = requirement_id

        requirement = Requirement(
            id=requirement_id,
            product_id=data.product_id,
            parent_id=None,  # Set in second pass
            stable_key=stable_key,
            title=item.title.strip(),
            what_this_does=item.what_this_does.strip() if item.what_this_does else None,
            why_this_exists=item.why_this_exists.strip() if item.why_this_exists else None,
            not_included=item.not_included.strip() if item.not_included else None,
            acceptance_criteria=item.acceptance_criteria.strip() if item.acceptance_criteria else None,
            status="draft",
            priority=item.priority,
            tags=json.dumps(item.tags) if item.tags else None,
            order_index=0,
            current_version=1,
            created_at=now,
            updated_at=now,
        )
        db.add(requirement)
        created_requirements.append((requirement, item))

    await db.flush()  # Get IDs assigned

    # Second pass: resolve parent references and set order indices
    parent_order_counts = {}
    for requirement, item in created_requirements:
        if item.parent_ref:
            # Check if parent_ref is a temp_id
            if item.parent_ref in temp_id_to_real_id:
                requirement.parent_id = temp_id_to_real_id[item.parent_ref]
            else:
                # Assume it's an existing requirement ID
                requirement.parent_id = item.parent_ref

        # Calculate order index within siblings
        parent_key = requirement.parent_id or "root"
        if parent_key not in parent_order_counts:
            # Get current max order for this parent
            if requirement.parent_id:
                max_order_stmt = (
                    select(func.max(Requirement.order_index))
                    .where(
                        and_(
                            Requirement.product_id == data.product_id,
                            Requirement.parent_id == requirement.parent_id,
                            Requirement.id != requirement.id,
                        )
                    )
                )
            else:
                max_order_stmt = (
                    select(func.max(Requirement.order_index))
                    .where(
                        and_(
                            Requirement.product_id == data.product_id,
                            Requirement.parent_id.is_(None),
                            Requirement.id != requirement.id,
                        )
                    )
                )
            max_order_result = await db.execute(max_order_stmt)
            max_order = max_order_result.scalar()
            parent_order_counts[parent_key] = (max_order or -1) + 1

        requirement.order_index = parent_order_counts[parent_key]
        parent_order_counts[parent_key] += 1

        # Create initial version
        version = RequirementVersion(
            id=str(uuid4()),
            requirement_id=requirement.id,
            version_number=1,
            snapshot=json.dumps({
                "title": requirement.title,
                "what_this_does": requirement.what_this_does,
                "why_this_exists": requirement.why_this_exists,
                "not_included": requirement.not_included,
                "acceptance_criteria": requirement.acceptance_criteria,
                "status": requirement.status,
                "priority": requirement.priority,
                "tags": item.tags,
            }),
            change_summary="Bulk import",
            changed_by=current_user.name,
            changed_at=now,
            status="active",
        )
        db.add(version)

    await db.flush()

    # Refresh and return
    result = []
    for requirement, _ in created_requirements:
        await db.refresh(requirement)
        result.append(requirement)

    return result
