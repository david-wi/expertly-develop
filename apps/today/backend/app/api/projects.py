"""Project API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import get_context, CurrentContext
from app.models import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter()


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    project_type: Optional[str] = Query(None, pattern="^(project|initiative|goal)$"),
    status: Optional[str] = Query(None, pattern="^(active|on_hold|completed|archived)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ctx: CurrentContext = Depends(get_context),
):
    """List projects with optional filters."""
    query = select(Project).where(Project.tenant_id == ctx.tenant.id)

    if project_type:
        query = query.where(Project.project_type == project_type)
    if status:
        query = query.where(Project.status == status)

    query = query.order_by(Project.priority_order.asc(), Project.created_at.desc())
    query = query.limit(limit).offset(offset)

    result = await ctx.db.execute(query)
    projects = result.scalars().all()

    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    ctx: CurrentContext = Depends(get_context),
):
    """Create a new project."""
    project = Project(
        tenant_id=ctx.tenant.id,
        user_id=ctx.user.id,
        name=data.name,
        description=data.description,
        project_type=data.project_type,
        status=data.status,
        priority_order=data.priority_order,
        success_criteria=data.success_criteria,
        target_date=data.target_date,
        parent_id=data.parent_id,
    )
    ctx.db.add(project)
    await ctx.db.flush()

    return ProjectResponse.model_validate(project)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Get a project by ID."""
    result = await ctx.db.execute(
        select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == ctx.tenant.id,
            )
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    ctx: CurrentContext = Depends(get_context),
):
    """Update a project."""
    result = await ctx.db.execute(
        select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == ctx.tenant.id,
            )
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await ctx.db.flush()

    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Delete (archive) a project."""
    result = await ctx.db.execute(
        select(Project).where(
            and_(
                Project.id == project_id,
                Project.tenant_id == ctx.tenant.id,
            )
        )
    )
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = "archived"
    await ctx.db.flush()
