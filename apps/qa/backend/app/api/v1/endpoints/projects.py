"""Project endpoints."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Project, Environment, TestCase, TestRun, User
from app.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectDetailResponse,
    ProjectStats,
)
from app.api.v1.endpoints import environments, tests, suites, runs
from app.api.deps import get_current_user, get_project_with_access

router = APIRouter()

# Include sub-routers
router.include_router(environments.router, prefix="/{project_id}/environments", tags=["environments"])
router.include_router(tests.router, prefix="/{project_id}/tests", tags=["tests"])
router.include_router(suites.router, prefix="/{project_id}/suites", tags=["suites"])
router.include_router(runs.router, prefix="/{project_id}/runs", tags=["runs"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    status: Optional[str] = Query(None, pattern="^(active|archived)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all projects for the current user's organization."""
    query = db.query(Project).filter(
        Project.organization_id == current_user.organization_id,
        Project.deleted_at.is_(None)
    )

    if status:
        query = query.filter(Project.status == status)
    else:
        query = query.filter(Project.status == "active")

    projects = query.order_by(Project.updated_at.desc()).all()
    return projects


@router.post("", response_model=ProjectResponse, status_code=201)
def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project."""
    now = datetime.utcnow()

    project = Project(
        id=str(uuid.uuid4()),
        organization_id=current_user.organization_id,
        name=project_in.name,
        description=project_in.description,
        settings=project_in.settings.model_dump() if project_in.settings else {},
        status="active",
        created_at=now,
        updated_at=now,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("/{project_id}", response_model=ProjectDetailResponse)
def get_project(
    project: Project = Depends(get_project_with_access),
    db: Session = Depends(get_db),
):
    """Get project details with statistics."""
    # Get environments
    environments = (
        db.query(Environment)
        .filter(Environment.project_id == project.id)
        .all()
    )

    # Get test case stats
    test_cases = (
        db.query(TestCase)
        .filter(TestCase.project_id == project.id, TestCase.deleted_at.is_(None))
        .all()
    )

    approved_tests = len([t for t in test_cases if t.status == "approved"])
    draft_tests = len([t for t in test_cases if t.status == "draft"])

    # Get recent runs
    recent_runs = (
        db.query(TestRun)
        .filter(TestRun.project_id == project.id)
        .order_by(TestRun.created_at.desc())
        .limit(10)
        .all()
    )

    passed_runs = len([r for r in recent_runs if r.status == "completed"])
    failed_runs = len([r for r in recent_runs if r.status == "failed"])

    stats = ProjectStats(
        total_tests=len(test_cases),
        approved_tests=approved_tests,
        draft_tests=draft_tests,
        total_runs=len(recent_runs),
        passed_runs=passed_runs,
        failed_runs=failed_runs,
    )

    return ProjectDetailResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        settings=project.settings,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        stats=stats,
        environments=[
            {
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "base_url": e.base_url,
                "is_default": e.is_default,
            }
            for e in environments
        ],
        recent_runs=[
            {
                "id": r.id,
                "name": r.name,
                "status": r.status,
                "summary": r.summary,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent_runs
        ],
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_in: ProjectUpdate,
    project: Project = Depends(get_project_with_access),
    db: Session = Depends(get_db),
):
    """Update a project."""
    update_data = project_in.model_dump(exclude_unset=True)

    if "settings" in update_data and update_data["settings"]:
        update_data["settings"] = update_data["settings"].model_dump()

    for field, value in update_data.items():
        setattr(project, field, value)

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project: Project = Depends(get_project_with_access),
    db: Session = Depends(get_db),
):
    """Soft-delete a project."""
    project.deleted_at = datetime.utcnow()
    project.status = "archived"
    project.updated_at = datetime.utcnow()

    db.commit()
