from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import Queue, QueueCreate, QueueUpdate
from app.models.queue import ScopeType
from app.api.deps import get_current_user
from identity_client.models import User as IdentityUser

router = APIRouter()


def serialize_queue(queue: dict) -> dict:
    """Convert ObjectIds to strings in queue document."""
    return {
        **queue,
        "_id": str(queue["_id"]),
        "organization_id": queue["organization_id"],  # Already a string UUID
        "scope_id": queue["scope_id"] if queue.get("scope_id") else None  # Already a string UUID
    }


@router.get("")
async def list_queues(
    scope_type: str | None = None,
    scope_id: str | None = None,
    include_system: bool = True,
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """
    List queues accessible to the current user.

    Filter by scope_type (user/team/organization) and/or scope_id (user or team UUID).
    """
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "deleted_at": None  # Exclude soft-deleted queues
    }

    if scope_type:
        query["scope_type"] = scope_type

    if scope_id:
        query["scope_id"] = scope_id  # String UUID from Identity

    if not include_system:
        query["is_system"] = False

    cursor = db.queues.find(query)
    queues = await cursor.to_list(100)

    return [serialize_queue(q) for q in queues]


@router.get("/stats")
async def get_queue_stats(
    current_user: IdentityUser = Depends(get_current_user)
) -> list[dict]:
    """Get task statistics for all queues."""
    db = get_database()

    pipeline = [
        {"$match": {"organization_id": current_user.organization_id, "deleted_at": None}},
        {
            "$lookup": {
                "from": "tasks",
                "localField": "_id",
                "foreignField": "queue_id",
                "as": "tasks"
            }
        },
        {
            "$project": {
                "_id": 1,
                "purpose": 1,
                "scope_type": 1,
                "scope_id": 1,
                "is_system": 1,
                "total_tasks": {"$size": "$tasks"},
                "queued": {
                    "$size": {
                        "$filter": {
                            "input": "$tasks",
                            "cond": {"$eq": ["$$this.status", "queued"]}
                        }
                    }
                },
                "in_progress": {
                    "$size": {
                        "$filter": {
                            "input": "$tasks",
                            "cond": {"$in": ["$$this.status", ["checked_out", "in_progress"]]}
                        }
                    }
                },
                "completed": {
                    "$size": {
                        "$filter": {
                            "input": "$tasks",
                            "cond": {"$eq": ["$$this.status", "completed"]}
                        }
                    }
                },
                "failed": {
                    "$size": {
                        "$filter": {
                            "input": "$tasks",
                            "cond": {"$eq": ["$$this.status", "failed"]}
                        }
                    }
                }
            }
        }
    ]

    results = await db.queues.aggregate(pipeline).to_list(100)
    return [
        {**r, "_id": str(r["_id"]), "scope_id": str(r["scope_id"]) if r.get("scope_id") else None}
        for r in results
    ]


@router.get("/{queue_id}")
async def get_queue(
    queue_id: str,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Get a specific queue."""
    db = get_database()

    if not ObjectId.is_valid(queue_id):
        raise HTTPException(status_code=400, detail="Invalid queue ID")

    queue = await db.queues.find_one({
        "_id": ObjectId(queue_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    return serialize_queue(queue)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_queue(
    data: QueueCreate,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """
    Create a new queue.

    A queue is a tuple of (purpose, scope):
    - purpose: What the queue is for (e.g., "Marketing Collateral Approval")
    - scope_type: Who it belongs to (user/team/organization)
    - scope_id: The user or team UUID (null for organization-wide)
    """
    db = get_database()

    # scope_id is now a string UUID from Identity
    scope_id = data.scope_id

    # User scopes must have a user UUID
    if data.scope_type == ScopeType.USER:
        if not scope_id:
            scope_id = current_user.id  # Default to current user (string UUID)
        # User validation is handled by Identity service

    # Team scopes must have a team UUID
    if data.scope_type == ScopeType.TEAM:
        if not scope_id:
            raise HTTPException(status_code=400, detail="Team queues require scope_id (team UUID)")
        # Team validation is handled by Identity service

    # Organization scopes should not have scope_id
    if data.scope_type == ScopeType.ORGANIZATION:
        scope_id = None

    queue = Queue(
        organization_id=current_user.organization_id,
        purpose=data.purpose,
        description=data.description,
        scope_type=data.scope_type,
        scope_id=scope_id,
        priority_default=data.priority_default,
        allow_bots=data.allow_bots
    )

    await db.queues.insert_one(queue.model_dump_mongo())

    return serialize_queue(queue.model_dump_mongo())


@router.patch("/{queue_id}")
async def update_queue(
    queue_id: str,
    data: QueueUpdate,
    current_user: IdentityUser = Depends(get_current_user)
) -> dict:
    """Update a queue."""
    db = get_database()

    if not ObjectId.is_valid(queue_id):
        raise HTTPException(status_code=400, detail="Invalid queue ID")

    queue = await db.queues.find_one({
        "_id": ObjectId(queue_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # scope_id is now a string UUID - no conversion needed

    result = await db.queues.find_one_and_update(
        {"_id": ObjectId(queue_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    return serialize_queue(result)


@router.delete("/{queue_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_queue(
    queue_id: str,
    current_user: IdentityUser = Depends(get_current_user)
):
    """Soft-delete a queue."""
    db = get_database()

    if not ObjectId.is_valid(queue_id):
        raise HTTPException(status_code=400, detail="Invalid queue ID")

    queue = await db.queues.find_one({
        "_id": ObjectId(queue_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    # Soft delete - set deleted_at timestamp
    await db.queues.update_one(
        {"_id": ObjectId(queue_id)},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}}
    )
