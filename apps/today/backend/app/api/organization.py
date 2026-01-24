"""Organization (tenant) management API endpoints."""

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_context, CurrentContext
from app.models.tenant import Tenant
from app.models.user import User
from app.models.task import Task
from app.models.log import Log
from sqlalchemy import select, func

router = APIRouter()


class OrganizationUpdate(BaseModel):
    """Schema for updating organization settings."""
    name: str | None = Field(None, min_length=1, max_length=255)
    settings: dict | None = None


class OrganizationResponse(BaseModel):
    """Schema for organization response."""
    id: UUID
    name: str
    slug: str
    tier: str
    settings: dict
    created_at: str
    updated_at: str

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
    if ctx.user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return ctx


@router.get("", response_model=OrganizationWithUsage)
async def get_organization(
    ctx: CurrentContext = Depends(get_context),
):
    """Get current organization details with usage stats."""
    tenant = ctx.tenant

    # Calculate usage stats
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Count users
    user_count = await ctx.db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    total_users = user_count.scalar_one()

    # Count total tasks
    task_count = await ctx.db.execute(
        select(func.count(Task.id)).where(Task.tenant_id == tenant.id)
    )
    total_tasks = task_count.scalar_one()

    # Count tasks completed this month
    completed_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant.id,
            Task.status == "completed",
            Task.completed_at >= month_start
        )
    )
    tasks_completed_this_month = completed_count.scalar_one()

    # Count tasks created this month
    created_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant.id,
            Task.created_at >= month_start
        )
    )
    tasks_created_this_month = created_count.scalar_one()

    # Count API calls this month (from logs)
    api_calls_count = await ctx.db.execute(
        select(func.count(Log.id)).where(
            Log.tenant_id == tenant.id,
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

    response = OrganizationWithUsage(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        tier=tenant.tier,
        settings=tenant.settings,
        created_at=str(tenant.created_at),
        updated_at=str(tenant.updated_at),
        usage=usage,
    )

    return response


@router.put("", response_model=OrganizationResponse)
async def update_organization(
    data: OrganizationUpdate,
    ctx: CurrentContext = Depends(require_admin),
):
    """Update organization settings (admin only)."""
    tenant = ctx.tenant

    if data.name is not None:
        tenant.name = data.name

    if data.settings is not None:
        tenant.settings = {**tenant.settings, **data.settings}

    await ctx.db.flush()
    await ctx.db.refresh(tenant)

    return OrganizationResponse.model_validate(tenant)


@router.get("/usage", response_model=UsageStats)
async def get_usage(
    ctx: CurrentContext = Depends(get_context),
):
    """Get detailed usage statistics for the organization."""
    tenant = ctx.tenant
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Count users
    user_count = await ctx.db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    total_users = user_count.scalar_one()

    # Count total tasks
    task_count = await ctx.db.execute(
        select(func.count(Task.id)).where(Task.tenant_id == tenant.id)
    )
    total_tasks = task_count.scalar_one()

    # Count tasks completed this month
    completed_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant.id,
            Task.status == "completed",
            Task.completed_at >= month_start
        )
    )
    tasks_completed_this_month = completed_count.scalar_one()

    # Count tasks created this month
    created_count = await ctx.db.execute(
        select(func.count(Task.id)).where(
            Task.tenant_id == tenant.id,
            Task.created_at >= month_start
        )
    )
    tasks_created_this_month = created_count.scalar_one()

    # Count API calls this month (from logs)
    api_calls_count = await ctx.db.execute(
        select(func.count(Log.id)).where(
            Log.tenant_id == tenant.id,
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
