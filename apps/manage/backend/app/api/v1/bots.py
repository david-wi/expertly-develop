"""
Bot management API endpoints.

Bots are users with user_type='bot' stored in Identity service.
Bot activity logs are stored locally in Manage's MongoDB.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from typing import Optional

from app.database import get_database
from app.models import TaskStatus, BotActivity, BotActivityType, BotStatus, BotConfigUpdate
from app.api.deps import get_current_user
from app.utils.auth import get_identity_client
from identity_client.auth import get_session_token
from identity_client.models import User as IdentityUser

router = APIRouter()


class BotConfigUpdateRequest(BaseModel):
    """Bot configuration update request."""
    poll_interval_seconds: Optional[int] = None
    max_concurrent_tasks: Optional[int] = None
    allowed_queue_ids: Optional[list[str]] = None
    capabilities: Optional[list[str]] = None
    what_i_can_help_with: Optional[str] = None


def serialize_bot_with_status(
    bot: dict,
    status: BotStatus,
    last_seen: datetime | None,
    current_task_count: int,
    stats_7d: dict
) -> dict:
    """Serialize a bot user with status information."""
    bot_config = bot.get("bot_config", {}) or {}
    return {
        "id": bot.get("id"),
        "organization_id": bot.get("organization_id"),
        "email": bot.get("email"),
        "name": bot.get("name"),
        "avatar_url": bot.get("avatar_url"),
        "title": bot.get("title"),
        "responsibilities": bot.get("responsibilities"),
        "is_active": bot.get("is_active", True),
        "poll_interval_seconds": bot_config.get("poll_interval_seconds", 5),
        "max_concurrent_tasks": bot_config.get("max_concurrent_tasks", 1),
        "allowed_queue_ids": bot_config.get("allowed_queue_ids", []),
        "capabilities": bot_config.get("capabilities", []),
        "what_i_can_help_with": bot_config.get("what_i_can_help_with"),
        "status": status.value,
        "last_seen_at": last_seen,
        "current_task_count": current_task_count,
        "tasks_completed_7d": stats_7d.get("completed", 0),
        "tasks_failed_7d": stats_7d.get("failed", 0),
        "avg_task_duration_seconds": stats_7d.get("avg_duration"),
        "created_at": bot.get("created_at"),
    }


async def get_bot_status(db, bot_id: str, organization_id: str, is_active: bool = True) -> tuple[BotStatus, datetime | None]:
    """Determine bot status based on recent activity."""
    # Check if bot is paused (is_active = False)
    if not is_active:
        return BotStatus.PAUSED, None

    # Check for recent heartbeat activity
    five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    last_activity = await db.bot_activities.find_one(
        {
            "bot_id": bot_id,
            "organization_id": organization_id,
            "activity_type": {"$in": [
                BotActivityType.HEARTBEAT.value,
                BotActivityType.TASK_CLAIMED.value,
                BotActivityType.TASK_COMPLETED.value,
                BotActivityType.TASK_STARTED.value,
            ]}
        },
        sort=[("created_at", -1)]
    )

    if not last_activity:
        return BotStatus.OFFLINE, None

    last_seen = last_activity["created_at"]
    if last_seen < five_minutes_ago:
        return BotStatus.OFFLINE, last_seen

    # Check if bot has active tasks
    active_task_count = await db.tasks.count_documents({
        "organization_id": organization_id,
        "checked_out_by_id": bot_id,
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    })

    if active_task_count > 0:
        return BotStatus.BUSY, last_seen

    return BotStatus.ONLINE, last_seen


async def get_bot_stats_7d(db, bot_id: str, organization_id: str) -> dict:
    """Get bot statistics for the last 7 days."""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Count completed and failed tasks
    completed = await db.bot_activities.count_documents({
        "bot_id": bot_id,
        "organization_id": organization_id,
        "activity_type": BotActivityType.TASK_COMPLETED.value,
        "created_at": {"$gte": seven_days_ago}
    })

    failed = await db.bot_activities.count_documents({
        "bot_id": bot_id,
        "organization_id": organization_id,
        "activity_type": BotActivityType.TASK_FAILED.value,
        "created_at": {"$gte": seven_days_ago}
    })

    # Calculate average duration for completed tasks
    pipeline = [
        {
            "$match": {
                "bot_id": bot_id,
                "organization_id": organization_id,
                "activity_type": BotActivityType.TASK_COMPLETED.value,
                "created_at": {"$gte": seven_days_ago},
                "duration_seconds": {"$ne": None}
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_duration": {"$avg": "$duration_seconds"}
            }
        }
    ]

    avg_result = await db.bot_activities.aggregate(pipeline).to_list(1)
    avg_duration = avg_result[0]["avg_duration"] if avg_result else None

    return {
        "completed": completed,
        "failed": failed,
        "avg_duration": avg_duration
    }


@router.get("")
async def list_bots(
    request: Request,
    status_filter: str | None = None,
    queue_id: str | None = None,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """
    List all bots in the organization with their status.

    Args:
        status_filter: Filter by status (online, offline, paused, busy)
        queue_id: Filter by bots that can work on this queue
    """
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    db = get_database()
    client = get_identity_client()

    try:
        # Get all bots from Identity
        result = await client.list_users(
            session_token=session_token,
            organization_id=current_user.organization_id,
        )
        bots = [u for u in result.items if u.user_type == "bot"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch bots: {str(e)}")

    results = []
    for bot in bots:
        bot_dict = bot.model_dump()
        bot_id = bot.id

        # Filter by queue if specified
        if queue_id:
            bot_config = bot_dict.get("bot_config", {}) or {}
            allowed_queues = bot_config.get("allowed_queue_ids", [])
            if allowed_queues and queue_id not in allowed_queues:
                continue

        # Get status from local activity logs
        bot_status, last_seen = await get_bot_status(
            db, bot_id, current_user.organization_id, bot_dict.get("is_active", True)
        )

        # Filter by status if specified
        if status_filter and bot_status.value != status_filter:
            continue

        # Get current task count
        current_task_count = await db.tasks.count_documents({
            "organization_id": current_user.organization_id,
            "checked_out_by_id": bot_id,
            "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
        })

        # Get 7-day stats from local activity logs
        stats_7d = await get_bot_stats_7d(db, bot_id, current_user.organization_id)

        results.append(serialize_bot_with_status(
            bot_dict, bot_status, last_seen, current_task_count, stats_7d
        ))

    return results


@router.get("/{bot_id}")
async def get_bot(
    bot_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get detailed information about a specific bot."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    db = get_database()
    client = get_identity_client()

    try:
        user = await client.get_user(bot_id, session_token)
        if user.user_type != "bot":
            raise HTTPException(status_code=404, detail="Bot not found")
        if user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Bot not found")
        bot_dict = user.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Bot not found")
        raise HTTPException(status_code=500, detail=f"Failed to fetch bot: {str(e)}")

    bot_status, last_seen = await get_bot_status(
        db, bot_id, current_user.organization_id, bot_dict.get("is_active", True)
    )
    current_task_count = await db.tasks.count_documents({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": bot_id,
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    })
    stats_7d = await get_bot_stats_7d(db, bot_id, current_user.organization_id)

    return serialize_bot_with_status(bot_dict, bot_status, last_seen, current_task_count, stats_7d)


@router.get("/{bot_id}/activity")
async def get_bot_activity(
    bot_id: str,
    request: Request,
    limit: int = 50,
    activity_type: str | None = None,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """Get activity history for a bot."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    db = get_database()
    client = get_identity_client()

    # Verify bot exists via Identity
    try:
        user = await client.get_user(bot_id, session_token)
        if user.user_type != "bot" or user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Bot not found")
    except HTTPException:
        raise
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Bot not found")
        raise HTTPException(status_code=500, detail=f"Failed to verify bot: {str(e)}")

    query = {
        "bot_id": bot_id,
        "organization_id": current_user.organization_id
    }

    if activity_type:
        query["activity_type"] = activity_type

    cursor = db.bot_activities.find(query).sort("created_at", -1).limit(limit)
    activities = await cursor.to_list(limit)

    # Get task titles for activities with task_id
    task_ids = [a["task_id"] for a in activities if a.get("task_id")]
    task_titles = {}
    if task_ids:
        from bson import ObjectId
        tasks = await db.tasks.find(
            {"_id": {"$in": [ObjectId(tid) if ObjectId.is_valid(tid) else tid for tid in task_ids]}},
            {"_id": 1, "title": 1}
        ).to_list(100)
        task_titles = {str(t["_id"]): t["title"] for t in tasks}

    return [
        {
            "id": str(a["_id"]),
            "bot_id": a["bot_id"],
            "activity_type": a["activity_type"],
            "task_id": str(a["task_id"]) if a.get("task_id") else None,
            "task_title": task_titles.get(str(a.get("task_id"))) if a.get("task_id") else None,
            "duration_seconds": a.get("duration_seconds"),
            "error_message": a.get("error_message"),
            "metadata": a.get("metadata"),
            "created_at": a["created_at"],
        }
        for a in activities
    ]


@router.get("/{bot_id}/stats")
async def get_bot_stats(
    bot_id: str,
    request: Request,
    days: int = 7,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get performance statistics for a bot."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")

    db = get_database()
    client = get_identity_client()

    # Verify bot exists via Identity
    try:
        user = await client.get_user(bot_id, session_token)
        if user.user_type != "bot" or user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Bot not found")
    except HTTPException:
        raise
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Bot not found")
        raise HTTPException(status_code=500, detail=f"Failed to verify bot: {str(e)}")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Count activities by type
    completed = await db.bot_activities.count_documents({
        "bot_id": bot_id,
        "organization_id": current_user.organization_id,
        "activity_type": BotActivityType.TASK_COMPLETED.value,
        "created_at": {"$gte": cutoff}
    })

    failed = await db.bot_activities.count_documents({
        "bot_id": bot_id,
        "organization_id": current_user.organization_id,
        "activity_type": BotActivityType.TASK_FAILED.value,
        "created_at": {"$gte": cutoff}
    })

    claimed = await db.bot_activities.count_documents({
        "bot_id": bot_id,
        "organization_id": current_user.organization_id,
        "activity_type": BotActivityType.TASK_CLAIMED.value,
        "created_at": {"$gte": cutoff}
    })

    # Duration stats
    pipeline = [
        {
            "$match": {
                "bot_id": bot_id,
                "organization_id": current_user.organization_id,
                "activity_type": BotActivityType.TASK_COMPLETED.value,
                "created_at": {"$gte": cutoff},
                "duration_seconds": {"$ne": None}
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_duration": {"$avg": "$duration_seconds"},
                "min_duration": {"$min": "$duration_seconds"},
                "max_duration": {"$max": "$duration_seconds"}
            }
        }
    ]

    duration_result = await db.bot_activities.aggregate(pipeline).to_list(1)
    duration_stats = duration_result[0] if duration_result else {}

    # Last activity
    last_activity = await db.bot_activities.find_one(
        {"bot_id": bot_id, "organization_id": current_user.organization_id},
        sort=[("created_at", -1)]
    )

    return {
        "bot_id": bot_id,
        "period_days": days,
        "tasks_completed": completed,
        "tasks_failed": failed,
        "tasks_claimed": claimed,
        "avg_duration_seconds": duration_stats.get("avg_duration"),
        "min_duration_seconds": duration_stats.get("min_duration"),
        "max_duration_seconds": duration_stats.get("max_duration"),
        "last_activity_at": last_activity["created_at"] if last_activity else None,
    }


@router.post("/{bot_id}/pause")
async def pause_bot(
    bot_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """
    Pause a bot.

    Paused bots will not claim new tasks.
    Requires admin role.
    """
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.patch(
                f"{client.base_url}/api/v1/users/{bot_id}",
                json={"is_active": False},
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Bot not found")
            response.raise_for_status()

        return {"success": True, "bot_id": bot_id, "status": "paused"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause bot: {str(e)}")


@router.post("/{bot_id}/resume")
async def resume_bot(
    bot_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """
    Resume a paused bot.

    Requires admin role.
    """
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    client = get_identity_client()

    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.patch(
                f"{client.base_url}/api/v1/users/{bot_id}",
                json={"is_active": True},
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Bot not found")
            response.raise_for_status()

        return {"success": True, "bot_id": bot_id, "status": "resumed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume bot: {str(e)}")


@router.patch("/{bot_id}/config")
async def update_bot_config(
    bot_id: str,
    data: BotConfigUpdateRequest,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """
    Update bot configuration.

    Requires admin role.
    """
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()
    client = get_identity_client()

    # Get current bot config from Identity
    try:
        user = await client.get_user(bot_id, session_token)
        if user.user_type != "bot" or user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Bot not found")
    except HTTPException:
        raise
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Bot not found")
        raise HTTPException(status_code=500, detail=f"Failed to fetch bot: {str(e)}")

    # Merge config updates
    current_config = user.bot_config.model_dump() if user.bot_config else {}
    update_dict = data.model_dump(exclude_unset=True)

    for key, value in update_dict.items():
        if value is not None:
            current_config[key] = value

    # Update via Identity
    try:
        import httpx
        async with httpx.AsyncClient() as http_client:
            response = await http_client.patch(
                f"{client.base_url}/api/v1/users/{bot_id}",
                json={"bot_config": current_config},
                headers={
                    "X-Session-Token": session_token,
                    "X-Organization-Id": current_user.organization_id,
                    "Content-Type": "application/json",
                },
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Bot not found")
            response.raise_for_status()
            result = response.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update bot config: {str(e)}")

    bot_status, last_seen = await get_bot_status(
        db, bot_id, current_user.organization_id, result.get("is_active", True)
    )
    current_task_count = await db.tasks.count_documents({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": bot_id,
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    })
    stats_7d = await get_bot_stats_7d(db, bot_id, current_user.organization_id)

    return serialize_bot_with_status(result, bot_status, last_seen, current_task_count, stats_7d)


@router.get("/{bot_id}/tasks")
async def get_bot_current_tasks(
    bot_id: str,
    request: Request,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """Get current tasks assigned to a bot."""
    session_token = get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Session required")

    db = get_database()
    client = get_identity_client()

    # Verify bot exists via Identity
    try:
        user = await client.get_user(bot_id, session_token)
        if user.user_type != "bot" or user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=404, detail="Bot not found")
    except HTTPException:
        raise
    except Exception as e:
        if "404" in str(e) or "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Bot not found")
        raise HTTPException(status_code=500, detail=f"Failed to verify bot: {str(e)}")

    cursor = db.tasks.find({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": bot_id,
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    }).sort("checked_out_at", 1)

    tasks = await cursor.to_list(100)

    return [
        {
            "id": str(t["_id"]),
            "title": t["title"],
            "status": t["status"],
            "priority": t["priority"],
            "checked_out_at": t.get("checked_out_at"),
            "started_at": t.get("started_at"),
        }
        for t in tasks
    ]
