"""Test suite endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import TestSuite, Project, User
from app.schemas import TestSuiteCreate, TestSuiteUpdate, TestSuiteResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=list[TestSuiteResponse])
async def list_suites(
    project_id: str,
    type: Optional[str] = Query(None, pattern="^(smoke|regression|critical|custom)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List test suites for a project."""
    # Validate project access
    project_stmt = select(Project).where(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )
    project_result = await db.execute(project_stmt)
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(TestSuite).where(TestSuite.project_id == project_id)

    if type:
        query = query.where(TestSuite.type == type)

    query = query.order_by(TestSuite.updated_at.desc())
    result = await db.execute(query)
    suites = result.scalars().all()
    return suites


@router.post("", response_model=TestSuiteResponse, status_code=201)
async def create_suite(
    project_id: str,
    suite_in: TestSuiteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new test suite."""
    # Validate project access
    project_stmt = select(Project).where(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )
    project_result = await db.execute(project_stmt)
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.utcnow()

    suite = TestSuite(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=suite_in.name,
        description=suite_in.description,
        type=suite_in.type,
        test_case_ids=suite_in.test_case_ids,
        created_at=now,
        updated_at=now,
    )

    db.add(suite)
    await db.flush()
    await db.refresh(suite)

    return suite


@router.get("/{suite_id}", response_model=TestSuiteResponse)
async def get_suite(
    project_id: str,
    suite_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a test suite by ID."""
    # Validate project access
    project_stmt = select(Project).where(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )
    project_result = await db.execute(project_stmt)
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suite_stmt = select(TestSuite).where(
        TestSuite.id == suite_id,
        TestSuite.project_id == project_id,
    )
    suite_result = await db.execute(suite_stmt)
    suite = suite_result.scalar_one_or_none()

    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    return suite


@router.patch("/{suite_id}", response_model=TestSuiteResponse)
async def update_suite(
    project_id: str,
    suite_id: str,
    suite_in: TestSuiteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a test suite."""
    # Validate project access
    project_stmt = select(Project).where(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )
    project_result = await db.execute(project_stmt)
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suite_stmt = select(TestSuite).where(
        TestSuite.id == suite_id,
        TestSuite.project_id == project_id,
    )
    suite_result = await db.execute(suite_stmt)
    suite = suite_result.scalar_one_or_none()

    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    update_data = suite_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(suite, field, value)

    suite.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(suite)

    return suite


@router.delete("/{suite_id}", status_code=204)
async def delete_suite(
    project_id: str,
    suite_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a test suite."""
    # Validate project access
    project_stmt = select(Project).where(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )
    project_result = await db.execute(project_stmt)
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suite_stmt = select(TestSuite).where(
        TestSuite.id == suite_id,
        TestSuite.project_id == project_id,
    )
    suite_result = await db.execute(suite_stmt)
    suite = suite_result.scalar_one_or_none()

    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    await db.delete(suite)
