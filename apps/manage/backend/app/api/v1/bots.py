"""
Bot management API endpoints.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional

from app.database import get_database
from app.models import User, UserType, UserRole, TaskStatus, BotActivity, BotActivityType, BotStatus
from app.api.deps import get_current_user

router = APIRouter()


class BotConfigUpdate(BaseModel):
    """Schema for updating bot configuration."""
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
        "id": str(bot["_id"]),
        "organization_id": str(bot["organization_id"]),
        "email": bot["email"],
        "name": bot["name"],
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
        "created_at": bot["created_at"],
    }


async def get_bot_status(db, bot_id: ObjectId, organization_id: ObjectId) -> tuple[BotStatus, datetime | None]:
    """Determine bot status based on recent activity."""
    # Check if bot is paused (is_active = False)
    bot = await db.users.find_one({"_id": bot_id})
    if not bot or not bot.get("is_active", True):
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


async def get_bot_stats_7d(db, bot_id: ObjectId, organization_id: ObjectId) -> dict:
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
    status_filter: str | None = None,
    queue_id: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """
    List all bots in the organization with their status.

    Args:
        status_filter: Filter by status (online, offline, paused, busy)
        queue_id: Filter by bots that can work on this queue
    """
    db = get_database()

    # Get all virtual users (bots)
    query = {
        "organization_id": current_user.organization_id,
        "user_type": UserType.VIRTUAL.value
    }

    cursor = db.users.find(query).sort("name", 1)
    bots = await cursor.to_list(100)

    results = []
    for bot in bots:
        bot_id = bot["_id"]

        # Filter by queue if specified
        if queue_id:
            allowed_queues = bot.get("bot_config", {}).get("allowed_queue_ids", [])
            if allowed_queues and queue_id not in allowed_queues:
                continue

        # Get status
        bot_status, last_seen = await get_bot_status(db, bot_id, current_user.organization_id)

        # Filter by status if specified
        if status_filter and bot_status.value != status_filter:
            continue

        # Get current task count
        current_task_count = await db.tasks.count_documents({
            "organization_id": current_user.organization_id,
            "checked_out_by_id": bot_id,
            "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
        })

        # Get 7-day stats
        stats_7d = await get_bot_stats_7d(db, bot_id, current_user.organization_id)

        results.append(serialize_bot_with_status(
            bot, bot_status, last_seen, current_task_count, stats_7d
        ))

    return results


@router.get("/{bot_id}")
async def get_bot(
    bot_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get detailed information about a specific bot."""
    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    bot = await db.users.find_one({
        "_id": ObjectId(bot_id),
        "organization_id": current_user.organization_id,
        "user_type": UserType.VIRTUAL.value
    })

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot_status, last_seen = await get_bot_status(db, bot["_id"], current_user.organization_id)
    current_task_count = await db.tasks.count_documents({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": bot["_id"],
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    })
    stats_7d = await get_bot_stats_7d(db, bot["_id"], current_user.organization_id)

    return serialize_bot_with_status(bot, bot_status, last_seen, current_task_count, stats_7d)


@router.get("/{bot_id}/activity")
async def get_bot_activity(
    bot_id: str,
    limit: int = 50,
    activity_type: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get activity history for a bot."""
    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    # Verify bot exists
    bot = await db.users.find_one({
        "_id": ObjectId(bot_id),
        "organization_id": current_user.organization_id,
        "user_type": UserType.VIRTUAL.value
    })
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    query = {
        "bot_id": ObjectId(bot_id),
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
        tasks = await db.tasks.find(
            {"_id": {"$in": task_ids}},
            {"_id": 1, "title": 1}
        ).to_list(100)
        task_titles = {str(t["_id"]): t["title"] for t in tasks}

    return [
        {
            "id": str(a["_id"]),
            "bot_id": str(a["bot_id"]),
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
    days: int = 7,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get performance statistics for a bot."""
    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    if days < 1 or days > 90:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 90")

    # Verify bot exists
    bot = await db.users.find_one({
        "_id": ObjectId(bot_id),
        "organization_id": current_user.organization_id,
        "user_type": UserType.VIRTUAL.value
    })
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    bot_oid = ObjectId(bot_id)

    # Count activities by type
    completed = await db.bot_activities.count_documents({
        "bot_id": bot_oid,
        "organization_id": current_user.organization_id,
        "activity_type": BotActivityType.TASK_COMPLETED.value,
        "created_at": {"$gte": cutoff}
    })

    failed = await db.bot_activities.count_documents({
        "bot_id": bot_oid,
        "organization_id": current_user.organization_id,
        "activity_type": BotActivityType.TASK_FAILED.value,
        "created_at": {"$gte": cutoff}
    })

    claimed = await db.bot_activities.count_documents({
        "bot_id": bot_oid,
        "organization_id": current_user.organization_id,
        "activity_type": BotActivityType.TASK_CLAIMED.value,
        "created_at": {"$gte": cutoff}
    })

    # Duration stats
    pipeline = [
        {
            "$match": {
                "bot_id": bot_oid,
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
        {"bot_id": bot_oid, "organization_id": current_user.organization_id},
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
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Pause a bot.

    Paused bots will not claim new tasks.
    Requires admin role.
    """
    if current_user.role not in [UserRole.ADMIN.value, UserRole.OWNER.value]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    result = await db.users.find_one_and_update(
        {
            "_id": ObjectId(bot_id),
            "organization_id": current_user.organization_id,
            "user_type": UserType.VIRTUAL.value
        },
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Bot not found")

    return {"success": True, "bot_id": bot_id, "status": "paused"}


@router.post("/{bot_id}/resume")
async def resume_bot(
    bot_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Resume a paused bot.

    Requires admin role.
    """
    if current_user.role not in [UserRole.ADMIN.value, UserRole.OWNER.value]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    result = await db.users.find_one_and_update(
        {
            "_id": ObjectId(bot_id),
            "organization_id": current_user.organization_id,
            "user_type": UserType.VIRTUAL.value
        },
        {"$set": {"is_active": True, "updated_at": datetime.now(timezone.utc)}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Bot not found")

    return {"success": True, "bot_id": bot_id, "status": "resumed"}


@router.patch("/{bot_id}/config")
async def update_bot_config(
    bot_id: str,
    data: BotConfigUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Update bot configuration.

    Requires admin role.
    """
    if current_user.role not in [UserRole.ADMIN.value, UserRole.OWNER.value]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    # Get current bot
    bot = await db.users.find_one({
        "_id": ObjectId(bot_id),
        "organization_id": current_user.organization_id,
        "user_type": UserType.VIRTUAL.value
    })

    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Merge config updates
    current_config = bot.get("bot_config", {}) or {}
    update_dict = data.model_dump(exclude_unset=True)

    for key, value in update_dict.items():
        if value is not None:
            current_config[key] = value

    result = await db.users.find_one_and_update(
        {"_id": ObjectId(bot_id)},
        {
            "$set": {
                "bot_config": current_config,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        return_document=True
    )

    bot_status, last_seen = await get_bot_status(db, result["_id"], current_user.organization_id)
    current_task_count = await db.tasks.count_documents({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": result["_id"],
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    })
    stats_7d = await get_bot_stats_7d(db, result["_id"], current_user.organization_id)

    return serialize_bot_with_status(result, bot_status, last_seen, current_task_count, stats_7d)


@router.get("/{bot_id}/tasks")
async def get_bot_current_tasks(
    bot_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get current tasks assigned to a bot."""
    db = get_database()

    if not ObjectId.is_valid(bot_id):
        raise HTTPException(status_code=400, detail="Invalid bot ID")

    # Verify bot exists
    bot = await db.users.find_one({
        "_id": ObjectId(bot_id),
        "organization_id": current_user.organization_id,
        "user_type": UserType.VIRTUAL.value
    })
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    cursor = db.tasks.find({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": ObjectId(bot_id),
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
