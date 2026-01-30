"""Environment endpoints."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Environment, Project, User
from app.schemas import EnvironmentCreate, EnvironmentUpdate, EnvironmentResponse
from app.services.encryption import get_encryption_service
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=list[EnvironmentResponse])
async def list_environments(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all environments for a project."""
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
        select(Environment)
        .where(Environment.project_id == project_id)
        .order_by(Environment.created_at.desc())
    )
    environments = result.scalars().all()

    return environments


@router.post("", response_model=EnvironmentResponse, status_code=201)
async def create_environment(
    project_id: str,
    env_in: EnvironmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new environment."""
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

    # If this is default, unset other defaults
    if env_in.is_default:
        await db.execute(
            update(Environment)
            .where(
                Environment.project_id == project_id,
                Environment.is_default == True,
            )
            .values(is_default=False)
        )

    encryption_service = get_encryption_service()
    now = datetime.utcnow()

    environment = Environment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=env_in.name,
        type=env_in.type,
        base_url=env_in.base_url,
        credentials_encrypted=encryption_service.encrypt_credentials(
            env_in.credentials.model_dump() if env_in.credentials else None
        ),
        is_default=env_in.is_default,
        notes=env_in.notes,
        created_at=now,
        updated_at=now,
    )

    db.add(environment)
    await db.flush()
    await db.refresh(environment)

    return environment


@router.get("/{environment_id}", response_model=EnvironmentResponse)
async def get_environment(
    project_id: str,
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get an environment by ID."""
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
        select(Environment).where(
            Environment.id == environment_id,
            Environment.project_id == project_id,
        )
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(status_code=404, detail="Environment not found")

    return environment


@router.patch("/{environment_id}", response_model=EnvironmentResponse)
async def update_environment(
    project_id: str,
    environment_id: str,
    env_in: EnvironmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an environment."""
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
        select(Environment).where(
            Environment.id == environment_id,
            Environment.project_id == project_id,
        )
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(status_code=404, detail="Environment not found")

    update_data = env_in.model_dump(exclude_unset=True)

    # Handle is_default
    if update_data.get("is_default"):
        await db.execute(
            update(Environment)
            .where(
                Environment.project_id == project_id,
                Environment.is_default == True,
                Environment.id != environment_id,
            )
            .values(is_default=False)
        )

    # Handle credentials encryption
    if "credentials" in update_data:
        encryption_service = get_encryption_service()
        update_data["credentials_encrypted"] = encryption_service.encrypt_credentials(
            update_data["credentials"].model_dump() if update_data["credentials"] else None
        )
        del update_data["credentials"]

    for field, value in update_data.items():
        setattr(environment, field, value)

    environment.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(environment)

    return environment


@router.delete("/{environment_id}", status_code=204)
async def delete_environment(
    project_id: str,
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an environment."""
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
        select(Environment).where(
            Environment.id == environment_id,
            Environment.project_id == project_id,
        )
    )
    environment = result.scalar_one_or_none()

    if not environment:
        raise HTTPException(status_code=404, detail="Environment not found")

    await db.delete(environment)
    await db.flush()
