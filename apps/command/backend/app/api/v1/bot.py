from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId
from pydantic import BaseModel

from app.database import get_database
from app.models import Task, TaskStatus, User, UserType
from app.api.deps import get_current_user
from app.config import get_settings

router = APIRouter()


def serialize_task(task: dict) -> dict:
    """Convert ObjectIds to strings in task document."""
    result = {**task, "_id": str(task["_id"])}
    for field in ["organization_id", "queue_id", "assigned_to_id", "checked_out_by_id",
                  "parent_task_id", "project_id", "sop_id"]:
        if task.get(field):
            result[field] = str(task[field])
    return result


class ClaimRequest(BaseModel):
    """Request to claim a task."""
    queue_ids: list[str] | None = None  # Optional filter by queue IDs


class HeartbeatRequest(BaseModel):
    """Heartbeat request with list of active task IDs."""
    task_ids: list[str]


@router.get("/poll")
async def poll_tasks(
    queue_id: str | None = None,
    limit: int = 10,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """
    Poll for available tasks.

    Returns queued tasks that the bot can claim, ordered by priority.
    """
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "status": TaskStatus.QUEUED.value
    }

    # Filter by queue if specified
    if queue_id:
        if not ObjectId.is_valid(queue_id):
            raise HTTPException(status_code=400, detail="Invalid queue ID")
        query["queue_id"] = ObjectId(queue_id)
    elif current_user.user_type == UserType.VIRTUAL and current_user.bot_config:
        # Bot with configured allowed queues
        allowed = current_user.bot_config.allowed_queue_ids
        if allowed:
            query["queue_id"] = {"$in": [ObjectId(q) for q in allowed if ObjectId.is_valid(q)]}

    # Only show tasks in queues that allow bots (if user is a bot)
    if current_user.user_type == UserType.VIRTUAL:
        # Get queue IDs that allow bots
        bot_queues = await db.queues.find(
            {"organization_id": current_user.organization_id, "allow_bots": True},
            {"_id": 1}
        ).to_list(100)
        bot_queue_ids = [q["_id"] for q in bot_queues]

        if "queue_id" in query:
            if isinstance(query["queue_id"], dict) and "$in" in query["queue_id"]:
                # Intersection with allowed queues
                query["queue_id"]["$in"] = [
                    q for q in query["queue_id"]["$in"] if q in bot_queue_ids
                ]
            elif query["queue_id"] not in bot_queue_ids:
                return []  # Requested queue doesn't allow bots
        else:
            query["queue_id"] = {"$in": bot_queue_ids}

    cursor = db.tasks.find(query).sort([("priority", 1), ("created_at", 1)]).limit(limit)
    tasks = await cursor.to_list(limit)

    return [serialize_task(t) for t in tasks]


@router.post("/claim")
async def claim_task(
    data: ClaimRequest | None = None,
    current_user: User = Depends(get_current_user)
) -> dict | None:
    """
    Atomically claim the next available task.

    Uses findOneAndUpdate for atomic checkout to prevent race conditions.
    Returns the claimed task or null if none available.
    """
    db = get_database()
    settings = get_settings()

    query = {
        "organization_id": current_user.organization_id,
        "status": TaskStatus.QUEUED.value
    }

    # Filter by queue IDs if specified
    if data and data.queue_ids:
        valid_ids = [ObjectId(q) for q in data.queue_ids if ObjectId.is_valid(q)]
        if valid_ids:
            query["queue_id"] = {"$in": valid_ids}

    # Bot queue filtering
    if current_user.user_type == UserType.VIRTUAL:
        bot_queues = await db.queues.find(
            {"organization_id": current_user.organization_id, "allow_bots": True},
            {"_id": 1}
        ).to_list(100)
        bot_queue_ids = [q["_id"] for q in bot_queues]

        if "queue_id" in query and "$in" in query.get("queue_id", {}):
            query["queue_id"]["$in"] = [
                q for q in query["queue_id"]["$in"] if q in bot_queue_ids
            ]
        else:
            if "queue_id" not in query:
                query["queue_id"] = {"$in": bot_queue_ids}
            elif query["queue_id"] not in bot_queue_ids:
                return None

        # Check concurrent task limit for bots
        if current_user.bot_config:
            max_concurrent = current_user.bot_config.max_concurrent_tasks
            active_count = await db.tasks.count_documents({
                "organization_id": current_user.organization_id,
                "checked_out_by_id": current_user.id,
                "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
            })
            if active_count >= max_concurrent:
                raise HTTPException(
                    status_code=429,
                    detail=f"Concurrent task limit reached ({max_concurrent})"
                )

    now = datetime.now(timezone.utc)

    # Atomic claim - find and update in one operation
    result = await db.tasks.find_one_and_update(
        query,
        {
            "$set": {
                "status": TaskStatus.CHECKED_OUT.value,
                "checked_out_by_id": current_user.id,
                "checked_out_at": now,
                "assigned_to_id": current_user.id,
                "updated_at": now
            }
        },
        sort=[("priority", 1), ("created_at", 1)],
        return_document=True
    )

    if not result:
        return None

    return serialize_task(result)


@router.post("/heartbeat")
async def heartbeat(
    data: HeartbeatRequest,
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Send heartbeat to keep checkouts alive.

    Updates checked_out_at timestamp for the specified tasks.
    Returns which tasks are still valid.
    """
    db = get_database()

    valid_ids = [ObjectId(t) for t in data.task_ids if ObjectId.is_valid(t)]
    if not valid_ids:
        return {"valid": [], "invalid": data.task_ids}

    now = datetime.now(timezone.utc)

    # Update checkout timestamp
    result = await db.tasks.update_many(
        {
            "_id": {"$in": valid_ids},
            "organization_id": current_user.organization_id,
            "checked_out_by_id": current_user.id,
            "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
        },
        {"$set": {"checked_out_at": now, "updated_at": now}}
    )

    # Find which tasks were updated
    updated_tasks = await db.tasks.find(
        {
            "_id": {"$in": valid_ids},
            "checked_out_by_id": current_user.id,
            "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
        },
        {"_id": 1}
    ).to_list(100)

    valid = [str(t["_id"]) for t in updated_tasks]
    invalid = [t for t in data.task_ids if t not in valid]

    return {"valid": valid, "invalid": invalid, "updated": result.modified_count}


@router.post("/release-stale")
async def release_stale_checkouts(
    timeout_minutes: int = 30,
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Release tasks that have been checked out too long without heartbeat.

    Admin/owner only endpoint.
    """
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_database()

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeout_minutes)

    result = await db.tasks.update_many(
        {
            "organization_id": current_user.organization_id,
            "status": TaskStatus.CHECKED_OUT.value,
            "checked_out_at": {"$lt": cutoff}
        },
        {
            "$set": {
                "status": TaskStatus.QUEUED.value,
                "checked_out_by_id": None,
                "checked_out_at": None,
                "assigned_to_id": None,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    return {"released": result.modified_count}


@router.get("/my-tasks")
async def get_my_active_tasks(
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get tasks currently checked out by the current user/bot."""
    db = get_database()

    cursor = db.tasks.find({
        "organization_id": current_user.organization_id,
        "checked_out_by_id": current_user.id,
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    }).sort("checked_out_at", 1)

    tasks = await cursor.to_list(100)
    return [serialize_task(t) for t in tasks]
