from typing import List, Optional

from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.desk import Desk
from app.models.work_item import WorkItem, WorkItemStatus
from app.schemas.desk import (
    DeskCreate,
    DeskUpdate,
    DeskResponse,
    AddMemberRequest,
    RouteWorkItemRequest,
)
from app.services.desk_routing_service import (
    is_desk_covered,
    route_work_item,
    auto_route_unassigned,
)

router = APIRouter()


async def _get_work_item_count(db, desk_id: str) -> int:
    """Count active work items routed to a desk."""
    return await db.work_items.count_documents({
        "desk_id": desk_id,
        "status": {"$in": [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS, WorkItemStatus.WAITING]},
    })


def desk_to_response(desk: Desk, active_work_items_count: int = 0) -> DeskResponse:
    return DeskResponse(
        id=str(desk.id),
        name=desk.name,
        description=desk.description,
        desk_type=desk.desk_type,
        is_active=desk.is_active,
        routing_rules=[r.model_dump() for r in desk.routing_rules],
        coverage=[c.model_dump() for c in desk.coverage],
        members=desk.members,
        priority=desk.priority,
        member_count=len(desk.members),
        active_work_items_count=active_work_items_count,
        is_covered=is_desk_covered(desk),
        created_at=desk.created_at,
        updated_at=desk.updated_at,
    )


@router.get("", response_model=List[DeskResponse])
async def list_desks(is_active: Optional[bool] = None):
    """List all desks with member counts and active work item counts."""
    db = get_database()

    query = {}
    if is_active is not None:
        query["is_active"] = is_active

    cursor = db.desks.find(query).sort([("priority", -1), ("name", 1)])
    desk_docs = await cursor.to_list(500)

    results = []
    for doc in desk_docs:
        desk = Desk(**doc)
        count = await _get_work_item_count(db, str(desk.id))
        results.append(desk_to_response(desk, active_work_items_count=count))

    return results


@router.post("", response_model=DeskResponse)
async def create_desk(data: DeskCreate):
    """Create a new desk."""
    db = get_database()

    desk = Desk(**data.model_dump())
    await db.desks.insert_one(desk.model_dump_mongo())

    return desk_to_response(desk)


@router.get("/{desk_id}", response_model=DeskResponse)
async def get_desk(desk_id: str):
    """Get a desk by ID with its work items count."""
    db = get_database()

    doc = await db.desks.find_one({"_id": ObjectId(desk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Desk not found")

    desk = Desk(**doc)
    count = await _get_work_item_count(db, str(desk.id))
    return desk_to_response(desk, active_work_items_count=count)


@router.patch("/{desk_id}", response_model=DeskResponse)
async def update_desk(desk_id: str, data: DeskUpdate):
    """Update a desk."""
    db = get_database()

    doc = await db.desks.find_one({"_id": ObjectId(desk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Desk not found")

    desk = Desk(**doc)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(desk, field, value)

    desk.mark_updated()

    await db.desks.update_one(
        {"_id": ObjectId(desk_id)},
        {"$set": desk.model_dump_mongo()},
    )

    count = await _get_work_item_count(db, str(desk.id))
    return desk_to_response(desk, active_work_items_count=count)


@router.delete("/{desk_id}")
async def delete_desk(desk_id: str):
    """Delete a desk. Work items routed to this desk will have their desk_id cleared."""
    db = get_database()

    doc = await db.desks.find_one({"_id": ObjectId(desk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Desk not found")

    # Clear desk_id from any work items assigned to this desk
    await db.work_items.update_many(
        {"desk_id": desk_id},
        {"$set": {"desk_id": None}},
    )

    await db.desks.delete_one({"_id": ObjectId(desk_id)})

    return {"status": "deleted", "id": desk_id}


@router.post("/{desk_id}/members", response_model=DeskResponse)
async def add_member(desk_id: str, data: AddMemberRequest):
    """Add a member to a desk."""
    db = get_database()

    doc = await db.desks.find_one({"_id": ObjectId(desk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Desk not found")

    desk = Desk(**doc)

    if data.user_id in desk.members:
        raise HTTPException(status_code=400, detail="User is already a member of this desk")

    desk.members.append(data.user_id)
    desk.mark_updated()

    await db.desks.update_one(
        {"_id": ObjectId(desk_id)},
        {"$set": {"members": desk.members, "updated_at": desk.updated_at}},
    )

    count = await _get_work_item_count(db, str(desk.id))
    return desk_to_response(desk, active_work_items_count=count)


@router.delete("/{desk_id}/members/{user_id}", response_model=DeskResponse)
async def remove_member(desk_id: str, user_id: str):
    """Remove a member from a desk."""
    db = get_database()

    doc = await db.desks.find_one({"_id": ObjectId(desk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Desk not found")

    desk = Desk(**doc)

    if user_id not in desk.members:
        raise HTTPException(status_code=404, detail="User is not a member of this desk")

    desk.members.remove(user_id)
    desk.mark_updated()

    await db.desks.update_one(
        {"_id": ObjectId(desk_id)},
        {"$set": {"members": desk.members, "updated_at": desk.updated_at}},
    )

    count = await _get_work_item_count(db, str(desk.id))
    return desk_to_response(desk, active_work_items_count=count)


@router.get("/{desk_id}/work-items")
async def get_desk_work_items(
    desk_id: str,
    status: Optional[str] = None,
):
    """Get work items routed to this desk."""
    db = get_database()

    # Verify desk exists
    doc = await db.desks.find_one({"_id": ObjectId(desk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Desk not found")

    query = {"desk_id": desk_id}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS, WorkItemStatus.WAITING]}

    cursor = db.work_items.find(query).sort([("priority", -1), ("created_at", 1)])
    work_items = await cursor.to_list(1000)

    # Serialize work items
    results = []
    for wi_doc in work_items:
        wi = WorkItem(**wi_doc)
        results.append({
            "id": str(wi.id),
            "work_type": wi.work_type,
            "status": wi.status,
            "title": wi.title,
            "description": wi.description,
            "priority": wi.priority,
            "assigned_to": wi.assigned_to,
            "due_at": wi.due_at.isoformat() if wi.due_at else None,
            "is_overdue": wi.is_overdue,
            "is_snoozed": wi.is_snoozed,
            "created_at": wi.created_at.isoformat(),
            "updated_at": wi.updated_at.isoformat(),
        })

    return results


@router.post("/route", response_model=dict)
async def route_work_item_endpoint(data: RouteWorkItemRequest):
    """Route a specific work item to the best matching desk."""
    db = get_database()

    wi_doc = await db.work_items.find_one({"_id": ObjectId(data.work_item_id)})
    if not wi_doc:
        raise HTTPException(status_code=404, detail="Work item not found")

    work_item = WorkItem(**wi_doc)
    desk_id = await route_work_item(work_item, db)

    if desk_id:
        await db.work_items.update_one(
            {"_id": ObjectId(data.work_item_id)},
            {"$set": {"desk_id": desk_id}},
        )
        return {"status": "routed", "desk_id": desk_id, "work_item_id": data.work_item_id}
    else:
        return {"status": "no_match", "desk_id": None, "work_item_id": data.work_item_id}


@router.post("/auto-route")
async def auto_route_endpoint():
    """Route all unassigned work items to their best matching desks."""
    db = get_database()
    count = await auto_route_unassigned(db)
    return {"status": "completed", "routed_count": count}
