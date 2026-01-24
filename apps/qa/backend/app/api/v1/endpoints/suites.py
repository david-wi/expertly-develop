"""Test suite endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TestSuite, Project, User
from app.schemas import TestSuiteCreate, TestSuiteUpdate, TestSuiteResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=list[TestSuiteResponse])
def list_suites(
    project_id: str,
    type: Optional[str] = Query(None, pattern="^(smoke|regression|critical|custom)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List test suites for a project."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(TestSuite).filter(TestSuite.project_id == project_id)

    if type:
        query = query.filter(TestSuite.type == type)

    suites = query.order_by(TestSuite.updated_at.desc()).all()
    return suites


@router.post("", response_model=TestSuiteResponse, status_code=201)
def create_suite(
    project_id: str,
    suite_in: TestSuiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new test suite."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
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
    db.commit()
    db.refresh(suite)

    return suite


@router.get("/{suite_id}", response_model=TestSuiteResponse)
def get_suite(
    project_id: str,
    suite_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a test suite by ID."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suite = (
        db.query(TestSuite)
        .filter(
            TestSuite.id == suite_id,
            TestSuite.project_id == project_id,
        )
        .first()
    )

    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    return suite


@router.patch("/{suite_id}", response_model=TestSuiteResponse)
def update_suite(
    project_id: str,
    suite_id: str,
    suite_in: TestSuiteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a test suite."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suite = (
        db.query(TestSuite)
        .filter(
            TestSuite.id == suite_id,
            TestSuite.project_id == project_id,
        )
        .first()
    )

    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    update_data = suite_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(suite, field, value)

    suite.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(suite)

    return suite


@router.delete("/{suite_id}", status_code=204)
def delete_suite(
    project_id: str,
    suite_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a test suite."""
    # Validate project access
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suite = (
        db.query(TestSuite)
        .filter(
            TestSuite.id == suite_id,
            TestSuite.project_id == project_id,
        )
        .first()
    )

    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")

    db.delete(suite)
    db.commit()
