"""Project API endpoints."""

from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import UserContext, get_current_user
from app.models.project import Visibility, SiteCredentials
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    SiteCredentialsInput,
)
from app.services.project_service import project_service

router = APIRouter()


def project_to_response(project, user: UserContext = None) -> ProjectResponse:
    """Convert project model to response schema."""
    is_owner = False
    can_edit = False
    if user:
        is_owner = project.owner_id == user.user_id
        can_edit = is_owner or user.role == "admin"
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        visibility=project.visibility.value if isinstance(project.visibility, Visibility) else project.visibility,
        site_url=project.site_url,
        has_credentials=project.site_credentials is not None,
        is_owner=is_owner,
        can_edit=can_edit,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    visibility: Optional[Visibility] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_current_user),
):
    """List projects accessible to the current user."""
    projects = await project_service.list_projects(
        tenant_id=user.tenant_id,
        user_id=user.user_id,
        visibility=visibility,
        limit=limit,
        offset=offset,
    )

    total = await project_service.count_projects(user.tenant_id)

    return ProjectListResponse(
        items=[project_to_response(p, user) for p in projects],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    user: UserContext = Depends(get_current_user),
):
    """Create a new project."""
    project = await project_service.create_project(
        tenant_id=user.tenant_id,
        owner_id=user.user_id,
        name=data.name,
        description=data.description,
        visibility=data.visibility,
        site_url=data.site_url,
    )

    return project_to_response(project, user)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Get a project by ID."""
    project = await project_service.get_project(ObjectId(project_id))

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check access
    if project.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project_to_response(project, user)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    user: UserContext = Depends(get_current_user),
):
    """Update a project."""
    # Verify project exists and user has access
    existing = await project_service.get_project(ObjectId(project_id))
    if not existing or existing.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Check ownership or admin
    if existing.owner_id != user.user_id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this project",
        )

    updates = data.model_dump(exclude_none=True)
    project = await project_service.update_project(ObjectId(project_id), **updates)

    return project_to_response(project, user)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Soft-delete a project."""
    existing = await project_service.get_project(ObjectId(project_id))
    if not existing or existing.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if existing.owner_id != user.user_id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this project",
        )

    await project_service.soft_delete(ObjectId(project_id))


@router.put("/{project_id}/credentials", response_model=ProjectResponse)
async def update_project_credentials(
    project_id: str,
    credentials: SiteCredentialsInput,
    user: UserContext = Depends(get_current_user),
):
    """Update project site credentials."""
    existing = await project_service.get_project(ObjectId(project_id))
    if not existing or existing.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    if existing.owner_id != user.user_id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update credentials",
        )

    site_credentials = SiteCredentials(**credentials.model_dump())
    project = await project_service.update_site_credentials(
        ObjectId(project_id),
        site_credentials,
    )

    return project_to_response(project, user)
