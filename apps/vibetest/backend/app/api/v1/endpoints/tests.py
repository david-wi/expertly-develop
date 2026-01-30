"""Test case endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import TestCase, TestCaseHistory, Project, User
from app.schemas import TestCaseCreate, TestCaseUpdate, TestCaseResponse
from app.api.deps import get_current_user, get_project_with_access

router = APIRouter()


@router.get("", response_model=list[TestCaseResponse])
async def list_tests(
    project_id: str,
    status: Optional[str] = Query(None, pattern="^(draft|approved|archived)$"),
    priority: Optional[str] = Query(None, pattern="^(critical|high|medium|low)$"),
    execution_type: Optional[str] = Query(None, pattern="^(manual|browser|api|visual)$"),
    tag: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List test cases for a project."""
    # Validate project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = select(TestCase).where(
        TestCase.project_id == project_id,
        TestCase.deleted_at.is_(None),
    )

    if status:
        query = query.where(TestCase.status == status)

    if priority:
        query = query.where(TestCase.priority == priority)

    if execution_type:
        query = query.where(TestCase.execution_type == execution_type)

    query = query.order_by(TestCase.updated_at.desc())
    result = await db.execute(query)
    tests = result.scalars().all()

    # Filter by tag (JSON array)
    if tag:
        tests = [t for t in tests if tag in (t.tags or [])]

    # Filter by search term
    if search:
        search_lower = search.lower()
        tests = [
            t for t in tests
            if search_lower in t.title.lower()
            or (t.description and search_lower in t.description.lower())
        ]

    return tests


@router.post("", response_model=TestCaseResponse, status_code=201)
async def create_test(
    project_id: str,
    test_in: TestCaseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new test case."""
    # Validate project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.utcnow()

    test_case = TestCase(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=test_in.title,
        description=test_in.description,
        preconditions=test_in.preconditions,
        steps=[s.model_dump() for s in test_in.steps],
        expected_results=test_in.expected_results,
        tags=test_in.tags,
        priority=test_in.priority,
        status=test_in.status,
        execution_type=test_in.execution_type,
        automation_config=test_in.automation_config.model_dump() if test_in.automation_config else None,
        created_by=test_in.created_by,
        created_at=now,
        updated_at=now,
    )

    db.add(test_case)
    await db.flush()
    await db.refresh(test_case)

    return test_case


@router.get("/{test_id}", response_model=TestCaseResponse)
async def get_test(
    project_id: str,
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a test case by ID."""
    # Validate project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(TestCase).where(
            TestCase.id == test_id,
            TestCase.project_id == project_id,
            TestCase.deleted_at.is_(None),
        )
    )
    test_case = result.scalar_one_or_none()

    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    return test_case


@router.patch("/{test_id}", response_model=TestCaseResponse)
async def update_test(
    project_id: str,
    test_id: str,
    test_in: TestCaseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a test case."""
    # Validate project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(TestCase).where(
            TestCase.id == test_id,
            TestCase.project_id == project_id,
            TestCase.deleted_at.is_(None),
        )
    )
    test_case = result.scalar_one_or_none()

    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    # Record history
    history = TestCaseHistory(
        id=str(uuid.uuid4()),
        test_case_id=test_id,
        changed_at=datetime.utcnow(),
        changed_by=current_user.email,
        previous_data={
            "title": test_case.title,
            "description": test_case.description,
            "steps": test_case.steps,
            "expected_results": test_case.expected_results,
            "status": test_case.status,
        },
        change_type="update",
    )
    db.add(history)

    update_data = test_in.model_dump(exclude_unset=True)

    # Handle steps conversion
    if "steps" in update_data and update_data["steps"]:
        update_data["steps"] = [s.model_dump() for s in update_data["steps"]]

    # Handle automation_config conversion
    if "automation_config" in update_data and update_data["automation_config"]:
        update_data["automation_config"] = update_data["automation_config"].model_dump()

    # Handle approval
    if update_data.get("status") == "approved" and test_case.status != "approved":
        update_data["approved_at"] = datetime.utcnow()
        update_data["approved_by"] = current_user.email

    for field, value in update_data.items():
        setattr(test_case, field, value)

    test_case.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(test_case)

    return test_case


@router.delete("/{test_id}", status_code=204)
async def delete_test(
    project_id: str,
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a test case."""
    # Validate project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(TestCase).where(
            TestCase.id == test_id,
            TestCase.project_id == project_id,
            TestCase.deleted_at.is_(None),
        )
    )
    test_case = result.scalar_one_or_none()

    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    # Record history
    history = TestCaseHistory(
        id=str(uuid.uuid4()),
        test_case_id=test_id,
        changed_at=datetime.utcnow(),
        changed_by=current_user.email,
        previous_data={
            "title": test_case.title,
            "status": test_case.status,
        },
        change_type="delete",
    )
    db.add(history)

    test_case.deleted_at = datetime.utcnow()
    test_case.status = "archived"
    test_case.updated_at = datetime.utcnow()

    await db.flush()


@router.post("/{test_id}/approve", response_model=TestCaseResponse)
async def approve_test(
    project_id: str,
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve a test case."""
    # Validate project access
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
            Project.deleted_at.is_(None)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(TestCase).where(
            TestCase.id == test_id,
            TestCase.project_id == project_id,
            TestCase.deleted_at.is_(None),
        )
    )
    test_case = result.scalar_one_or_none()

    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    test_case.status = "approved"
    test_case.approved_at = datetime.utcnow()
    test_case.approved_by = current_user.email
    test_case.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(test_case)

    return test_case
