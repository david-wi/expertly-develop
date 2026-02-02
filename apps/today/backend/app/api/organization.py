"""Organization (tenant) management API endpoints.

Organization data comes from Identity service.
"""

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.deps import get_context, CurrentContext
from app.models.task import Task
from app.models.log import Log
from app.utils.auth import get_identity_client
from sqlalchemy import select, func

from identity_client.client import IdentityClientError

router = APIRouter()


def _get_session_token(request: Request) -> str:
    """Extract session token from request."""
    token = request.cookies.get("expertly_session")
    if not token:
        token = request.headers.get("X-Session-Token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token required"
        )
    return token


class OrganizationUpdate(BaseModel):
    """Schema for updating organization settings."""
    name: str | None = Field(None, min_length=1, max_length=255)


class OrganizationResponse(BaseModel):
    """Schema for organization response."""
    id: str
    name: str
    slug: str
    settings: dict = {}

    class Config:
        from_attributes = True


class UsageStats(BaseModel):
    """Usage statistics for the organization."""
    total_users: int
    total_tasks: int
    tasks_completed_this_month: int
    tasks_created_this_month: int
    api_calls_this_month: int
    storage_used_mb: float = 0.0


class OrganizationWithUsage(OrganizationResponse):
    """Organization response with usage statistics."""
    usage: UsageStats


def require_admin(ctx: CurrentContext = Depends(get_context)) -> CurrentContext:
    """Dependency that requires admin role."""
    # Map identity role to local role for check
    role_mapping = {"owner": "admin", "admin": "admin"}
    if role_mapping.get(ctx.user.role, ctx.user.role) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return ctx


@router.get("", response_model=OrganizationWithUsage)
async def get_organization(
    request: Request,
    ctx: CurrentContext = Depends(get_context),
):
    """Get current organization details with usage stats."""
    token = _get_session_token(request)
    client = get_identity_client()

    try:
        # Get organization from Identity service
        org = await client.get_organization(
            org_id=ctx.user.organization_id,
            session_token=token,
        )

        # Get user count from Identity service
        users_result = await client.list_users(
            session_token=token,
            organization_id=ctx.user.organization_id,
        )
        total_users = users_result.total

    except IdentityClientError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )

    # Calculate local usage stats (tasks, logs)
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    tenant_id = UUID(ctx.user.organization_id)

    # Count total tasks
    task_count = await ctx.db.execute(
        select(func.count(Task.id)).where(Task.tenant_id == tenant_id)
    )
    total_tasks = task_count.scalar_one()

    # Count tasks completed this month
    completed_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant_id,
            Task.status == "completed",
        )
    )
    tasks_completed_this_month = completed_count.scalar_one()

    # Count tasks created this month
    created_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant_id,
            Task.created_at >= month_start
        )
    )
    tasks_created_this_month = created_count.scalar_one()

    # Count API calls this month (from logs)
    api_calls_count = await ctx.db.execute(
        select(func.count(Log.id)).where(
            Log.tenant_id == tenant_id,
            Log.created_at >= month_start
        )
    )
    api_calls_this_month = api_calls_count.scalar_one()

    usage = UsageStats(
        total_users=total_users,
        total_tasks=total_tasks,
        tasks_completed_this_month=tasks_completed_this_month,
        tasks_created_this_month=tasks_created_this_month,
        api_calls_this_month=api_calls_this_month,
    )

    return OrganizationWithUsage(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        settings={},
        usage=usage,
    )


@router.put("", response_model=OrganizationResponse)
async def update_organization(
    request: Request,
    data: OrganizationUpdate,
    ctx: CurrentContext = Depends(require_admin),
):
    """Update organization settings (admin only).

    Note: Organization updates go through Identity service.
    """
    # Organization updates would need to go through Identity API
    # For now, return current state
    token = _get_session_token(request)
    client = get_identity_client()

    try:
        org = await client.get_organization(
            org_id=ctx.user.organization_id,
            session_token=token,
        )
        return OrganizationResponse(
            id=str(org.id),
            name=org.name,
            slug=org.slug,
            settings={},
        )
    except IdentityClientError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e.message)
        )


@router.get("/usage", response_model=UsageStats)
async def get_usage(
    request: Request,
    ctx: CurrentContext = Depends(get_context),
):
    """Get detailed usage statistics for the organization."""
    token = _get_session_token(request)
    client = get_identity_client()
    tenant_id = UUID(ctx.user.organization_id)

    try:
        # Get user count from Identity
        users_result = await client.list_users(
            session_token=token,
            organization_id=ctx.user.organization_id,
        )
        total_users = users_result.total
    except IdentityClientError:
        total_users = 0

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Count total tasks
    task_count = await ctx.db.execute(
        select(func.count(Task.id)).where(Task.tenant_id == tenant_id)
    )
    total_tasks = task_count.scalar_one()

    # Count tasks completed this month
    completed_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant_id,
            Task.status == "completed",
        )
    )
    tasks_completed_this_month = completed_count.scalar_one()

    # Count tasks created this month
    created_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant_id,
            Task.created_at >= month_start
        )
    )
    tasks_created_this_month = created_count.scalar_one()

    # Count API calls this month (from logs)
    api_calls_count = await ctx.db.execute(
        select(func.count(Log.id)).where(
            Log.tenant_id == tenant_id,
            Log.created_at >= month_start
        )
    )
    api_calls_this_month = api_calls_count.scalar_one()

    return UsageStats(
        total_users=total_users,
        total_tasks=total_tasks,
        tasks_completed_this_month=tasks_completed_this_month,
        tasks_created_this_month=tasks_created_this_month,
        api_calls_this_month=api_calls_this_month,
    )
