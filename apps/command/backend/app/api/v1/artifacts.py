"""Artifacts API endpoints using shared artifacts-mongo package."""

from bson import ObjectId
from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from identity_client.models import User as IdentityUser
from app.utils.auth import get_current_user
from app.database import get_database as get_db

# Import from shared package
from artifacts_mongo import (
    create_artifacts_router,
    ArtifactRouterConfig,
    UserContext,
)


async def get_user_context(
    user: IdentityUser = Depends(get_current_user),
) -> UserContext:
    """Convert IdentityUser to artifacts UserContext."""
    return UserContext(
        user_id=user.id,
        organization_id=user.organization_id,
        name=user.name,
    )


async def validate_task_context(
    task_id: str,
    organization_id: str,
    db: AsyncIOMotorDatabase,
) -> bool:
    """Validate that a task exists and belongs to the organization."""
    if not ObjectId.is_valid(task_id):
        return False
    doc = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": organization_id,
    })
    return doc is not None


async def validate_project_context(
    project_id: str,
    organization_id: str,
    db: AsyncIOMotorDatabase,
) -> bool:
    """Validate that a project exists and belongs to the organization."""
    if not ObjectId.is_valid(project_id):
        return False
    doc = await db.projects.find_one({
        "_id": ObjectId(project_id),
        "organization_id": organization_id,
    })
    return doc is not None


# Create router for task artifacts
# This allows attaching files to tasks
task_artifacts_config = ArtifactRouterConfig(
    get_db=get_db,
    get_user_context=get_user_context,
    context_key="task_id",
    context_validator=validate_task_context,
    context_collection="tasks",
    context_name_field="title",
)

task_artifacts_router = create_artifacts_router(task_artifacts_config)

# Create router for project artifacts
# This allows attaching files to projects
project_artifacts_config = ArtifactRouterConfig(
    get_db=get_db,
    get_user_context=get_user_context,
    context_key="project_id",
    context_validator=validate_project_context,
    context_collection="projects",
    context_name_field="name",
)

project_artifacts_router = create_artifacts_router(project_artifacts_config)

# Default router uses task_id as context
router = task_artifacts_router
