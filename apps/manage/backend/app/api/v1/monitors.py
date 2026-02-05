from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import Monitor, MonitorCreate, MonitorUpdate, MonitorEvent, User, MonitorStatus, MonitorProvider
from app.models.queue import ScopeType
from app.api.deps import get_current_user
from app.services.monitor_service import MonitorService

router = APIRouter()


def serialize_monitor(monitor: dict) -> dict:
    """Convert ObjectIds to strings in monitor document."""
    result = {**monitor}
    result["_id"] = str(monitor["_id"])
    result["id"] = str(monitor["_id"])
    result["organization_id"] = str(monitor["organization_id"])
    result["connection_id"] = str(monitor["connection_id"])

    if monitor.get("scope_id"):
        result["scope_id"] = str(monitor["scope_id"])
    if monitor.get("queue_id"):
        result["queue_id"] = str(monitor["queue_id"])
    if monitor.get("project_id"):
        result["project_id"] = str(monitor["project_id"])

    return result


def serialize_event(event: dict) -> dict:
    """Convert ObjectIds to strings in event document."""
    result = {**event}
    result["_id"] = str(event["_id"])
    result["id"] = str(event["_id"])
    result["organization_id"] = str(event["organization_id"])
    result["monitor_id"] = str(event["monitor_id"])

    if event.get("task_id"):
        result["task_id"] = str(event["task_id"])

    return result


@router.get("")
async def list_monitors(
    project_id: str | None = None,
    provider: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """
    List monitors for the organization.

    Optional filters:
    - project_id: Filter by project
    - provider: Filter by provider type (slack, google_drive, etc.)
    - status: Filter by status (active, paused, error)
    """
    db = get_database()

    query = {
        "organization_id": current_user.organization_id,
        "deleted_at": None
    }

    if project_id:
        if not ObjectId.is_valid(project_id):
            raise HTTPException(status_code=400, detail="Invalid project_id")
        query["project_id"] = ObjectId(project_id)

    if provider:
        query["provider"] = provider

    if status:
        query["status"] = status

    cursor = db.monitors.find(query).sort("created_at", -1)
    monitors = await cursor.to_list(100)

    return [serialize_monitor(m) for m in monitors]


@router.get("/{monitor_id}")
async def get_monitor(
    monitor_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    monitor = await db.monitors.find_one({
        "_id": ObjectId(monitor_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    return serialize_monitor(monitor)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_monitor(
    data: MonitorCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Create a new monitor.

    The monitor will watch the specified provider for events and
    trigger the configured playbook when events are detected.
    """
    db = get_database()

    # Validate connection exists and belongs to org
    if not ObjectId.is_valid(data.connection_id):
        raise HTTPException(status_code=400, detail="Invalid connection_id")

    connection = await db.connections.find_one({
        "_id": ObjectId(data.connection_id),
        "organization_id": current_user.organization_id,
        "status": "active"
    })
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found or inactive")

    # Validate playbook exists (if provided)
    if data.playbook_id:
        playbook = await db.playbooks.find_one({"_id": data.playbook_id})
        if not playbook:
            raise HTTPException(status_code=404, detail="Playbook not found")

    # Validate scope
    scope_id = None
    if data.scope_id:
        if not ObjectId.is_valid(data.scope_id):
            raise HTTPException(status_code=400, detail="Invalid scope_id")
        scope_id = ObjectId(data.scope_id)

    if data.scope_type == ScopeType.USER:
        if not scope_id:
            scope_id = current_user.id

    if data.scope_type == ScopeType.TEAM and not scope_id:
        raise HTTPException(status_code=400, detail="Team monitors require scope_id")

    if data.scope_type == ScopeType.ORGANIZATION:
        scope_id = None

    # Validate optional queue
    queue_id = None
    if data.queue_id:
        if not ObjectId.is_valid(data.queue_id):
            raise HTTPException(status_code=400, detail="Invalid queue_id")
        queue = await db.queues.find_one({
            "_id": ObjectId(data.queue_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        })
        if not queue:
            raise HTTPException(status_code=404, detail="Queue not found")
        queue_id = ObjectId(data.queue_id)

    # Validate optional project
    project_id = None
    if data.project_id:
        if not ObjectId.is_valid(data.project_id):
            raise HTTPException(status_code=400, detail="Invalid project_id")
        project = await db.projects.find_one({
            "_id": ObjectId(data.project_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        })
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = ObjectId(data.project_id)

    # Optionally validate provider config
    service = MonitorService()
    is_valid, error = await service.validate_monitor_config(
        data.provider,
        ObjectId(data.connection_id),
        data.provider_config,
        current_user.organization_id
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid provider configuration: {error}")

    monitor = Monitor(
        organization_id=current_user.organization_id,
        name=data.name,
        description=data.description,
        scope_type=data.scope_type,
        scope_id=scope_id,
        provider=data.provider,
        connection_id=ObjectId(data.connection_id),
        provider_config=data.provider_config,
        playbook_id=data.playbook_id,
        input_data_template=data.input_data_template,
        queue_id=queue_id,
        project_id=project_id,
        poll_interval_seconds=data.poll_interval_seconds,
        status=MonitorStatus.ACTIVE
    )

    await db.monitors.insert_one(monitor.model_dump_mongo())

    return serialize_monitor(monitor.model_dump_mongo())


@router.patch("/{monitor_id}")
async def update_monitor(
    monitor_id: str,
    data: MonitorUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    monitor = await db.monitors.find_one({
        "_id": ObjectId(monitor_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert string IDs to ObjectIds
    if "scope_id" in update_data and update_data["scope_id"]:
        update_data["scope_id"] = ObjectId(update_data["scope_id"])
    if "queue_id" in update_data and update_data["queue_id"]:
        update_data["queue_id"] = ObjectId(update_data["queue_id"])
    if "project_id" in update_data and update_data["project_id"]:
        update_data["project_id"] = ObjectId(update_data["project_id"])

    # Clear error if resuming from error state
    if update_data.get("status") == MonitorStatus.ACTIVE.value:
        update_data["last_error"] = None

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.monitors.find_one_and_update(
        {"_id": ObjectId(monitor_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    return serialize_monitor(result)


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(
    monitor_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft-delete a monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    monitor = await db.monitors.find_one({
        "_id": ObjectId(monitor_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    await db.monitors.update_one(
        {"_id": ObjectId(monitor_id)},
        {"$set": {"deleted_at": datetime.now(timezone.utc)}}
    )


@router.post("/{monitor_id}/poll")
async def trigger_poll(
    monitor_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Manually trigger a poll for a monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    monitor = await db.monitors.find_one({
        "_id": ObjectId(monitor_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    service = MonitorService()
    result = await service.poll_monitor(monitor_id, current_user.organization_id)

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    return result


@router.post("/{monitor_id}/pause")
async def pause_monitor(
    monitor_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Pause a monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    result = await db.monitors.find_one_and_update(
        {
            "_id": ObjectId(monitor_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        },
        {"$set": {
            "status": MonitorStatus.PAUSED.value,
            "updated_at": datetime.now(timezone.utc)
        }},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Monitor not found")

    return serialize_monitor(result)


@router.post("/{monitor_id}/resume")
async def resume_monitor(
    monitor_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Resume a paused or errored monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    result = await db.monitors.find_one_and_update(
        {
            "_id": ObjectId(monitor_id),
            "organization_id": current_user.organization_id,
            "deleted_at": None
        },
        {"$set": {
            "status": MonitorStatus.ACTIVE.value,
            "last_error": None,
            "updated_at": datetime.now(timezone.utc)
        }},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Monitor not found")

    return serialize_monitor(result)


@router.get("/{monitor_id}/events")
async def get_monitor_events(
    monitor_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get recent events for a monitor."""
    db = get_database()

    if not ObjectId.is_valid(monitor_id):
        raise HTTPException(status_code=400, detail="Invalid monitor ID")

    # Verify monitor exists and belongs to org
    monitor = await db.monitors.find_one({
        "_id": ObjectId(monitor_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })

    if not monitor:
        raise HTTPException(status_code=404, detail="Monitor not found")

    cursor = db.monitor_events.find({
        "monitor_id": ObjectId(monitor_id)
    }).sort("created_at", -1).limit(min(limit, 100))

    events = await cursor.to_list(min(limit, 100))

    return [serialize_event(e) for e in events]


@router.get("/stats/summary")
async def get_monitors_summary(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get summary statistics for all monitors."""
    db = get_database()

    pipeline = [
        {
            "$match": {
                "organization_id": current_user.organization_id,
                "deleted_at": None
            }
        },
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_events": {"$sum": "$events_detected"},
                "total_playbooks": {"$sum": "$playbooks_triggered"}
            }
        }
    ]

    results = await db.monitors.aggregate(pipeline).to_list(10)

    summary = {
        "total": 0,
        "active": 0,
        "paused": 0,
        "error": 0,
        "total_events_detected": 0,
        "total_playbooks_triggered": 0
    }

    for r in results:
        status_key = r["_id"]
        summary[status_key] = r["count"]
        summary["total"] += r["count"]
        summary["total_events_detected"] += r["total_events"]
        summary["total_playbooks_triggered"] += r["total_playbooks"]

    return summary
