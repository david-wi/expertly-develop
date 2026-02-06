from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.work_item import WorkItem, WorkItemType, WorkItemStatus
from app.schemas.work_item import WorkItemCreate, WorkItemUpdate, WorkItemResponse
from app.services.websocket_manager import manager

router = APIRouter()


def work_item_to_response(wi: WorkItem) -> WorkItemResponse:
    return WorkItemResponse(
        id=str(wi.id),
        work_type=wi.work_type,
        status=wi.status,
        title=wi.title,
        description=wi.description,
        priority=wi.priority,
        quote_request_id=str(wi.quote_request_id) if wi.quote_request_id else None,
        quote_id=str(wi.quote_id) if wi.quote_id else None,
        shipment_id=str(wi.shipment_id) if wi.shipment_id else None,
        tender_id=str(wi.tender_id) if wi.tender_id else None,
        customer_id=str(wi.customer_id) if wi.customer_id else None,
        carrier_id=str(wi.carrier_id) if wi.carrier_id else None,
        invoice_id=str(wi.invoice_id) if wi.invoice_id else None,
        desk_id=wi.desk_id,
        assigned_to=wi.assigned_to,
        assigned_at=wi.assigned_at,
        due_at=wi.due_at,
        snoozed_until=wi.snoozed_until,
        is_overdue=wi.is_overdue,
        is_snoozed=wi.is_snoozed,
        completed_at=wi.completed_at,
        completed_by=wi.completed_by,
        resolution_notes=wi.resolution_notes,
        created_at=wi.created_at,
        updated_at=wi.updated_at,
    )


@router.get("", response_model=List[WorkItemResponse])
async def list_work_items(
    status: Optional[WorkItemStatus] = None,
    work_type: Optional[WorkItemType] = None,
    assigned_to: Optional[str] = None,
    include_snoozed: bool = False,
):
    """List work items (unified inbox)."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    else:
        # Default to open items
        query["status"] = {"$in": [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS, WorkItemStatus.WAITING]}

    if work_type:
        query["work_type"] = work_type
    if assigned_to:
        query["assigned_to"] = assigned_to

    if not include_snoozed:
        query["$or"] = [
            {"snoozed_until": None},
            {"snoozed_until": {"$lt": datetime.utcnow()}},
        ]

    cursor = db.work_items.find(query).sort([("priority", -1), ("created_at", 1)])
    work_items = await cursor.to_list(1000)

    return [work_item_to_response(WorkItem(**wi)) for wi in work_items]


@router.get("/dashboard")
async def get_dashboard_stats():
    """Get dashboard statistics."""
    db = get_database()

    # Count work items by type
    pipeline = [
        {"$match": {"status": {"$in": [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS]}}},
        {"$group": {"_id": "$work_type", "count": {"$sum": 1}}},
    ]
    type_counts = await db.work_items.aggregate(pipeline).to_list(20)

    # Count overdue items
    overdue_count = await db.work_items.count_documents({
        "status": {"$in": [WorkItemStatus.OPEN, WorkItemStatus.IN_PROGRESS]},
        "due_at": {"$lt": datetime.utcnow()},
    })

    # Count shipments needing attention
    at_risk_shipments = await db.shipments.count_documents({
        "status": {"$in": ["booked", "pending_pickup", "in_transit"]},
        "carrier_id": None,
    })

    # Today's pickups and deliveries
    from datetime import timedelta
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    todays_pickups = await db.shipments.count_documents({
        "pickup_date": {"$gte": today_start, "$lt": today_end},
        "status": {"$in": ["booked", "pending_pickup"]},
    })

    todays_deliveries = await db.shipments.count_documents({
        "delivery_date": {"$gte": today_start, "$lt": today_end},
        "status": {"$in": ["in_transit", "out_for_delivery"]},
    })

    return {
        "work_items_by_type": {item["_id"]: item["count"] for item in type_counts},
        "overdue_count": overdue_count,
        "at_risk_shipments": at_risk_shipments,
        "todays_pickups": todays_pickups,
        "todays_deliveries": todays_deliveries,
    }


@router.get("/{work_item_id}", response_model=WorkItemResponse)
async def get_work_item(work_item_id: str):
    """Get a work item by ID."""
    db = get_database()

    wi = await db.work_items.find_one({"_id": ObjectId(work_item_id)})
    if not wi:
        raise HTTPException(status_code=404, detail="Work item not found")

    return work_item_to_response(WorkItem(**wi))


@router.post("", response_model=WorkItemResponse)
async def create_work_item(data: WorkItemCreate):
    """Create a new work item."""
    db = get_database()

    wi_data = data.model_dump()

    # Convert ObjectId fields
    for field in ["quote_request_id", "quote_id", "shipment_id", "tender_id", "customer_id", "carrier_id", "invoice_id"]:
        if wi_data.get(field):
            wi_data[field] = ObjectId(wi_data[field])

    work_item = WorkItem(**wi_data)
    await db.work_items.insert_one(work_item.model_dump_mongo())

    await manager.broadcast("work_item_created", {"id": str(work_item.id), "work_type": work_item.work_type})
    return work_item_to_response(work_item)


@router.patch("/{work_item_id}", response_model=WorkItemResponse)
async def update_work_item(work_item_id: str, data: WorkItemUpdate):
    """Update a work item."""
    db = get_database()

    wi_doc = await db.work_items.find_one({"_id": ObjectId(work_item_id)})
    if not wi_doc:
        raise HTTPException(status_code=404, detail="Work item not found")

    work_item = WorkItem(**wi_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(work_item, field, value)

    work_item.mark_updated()

    await db.work_items.update_one(
        {"_id": ObjectId(work_item_id)},
        {"$set": work_item.model_dump_mongo()}
    )

    return work_item_to_response(work_item)


class CompleteWorkItemRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/{work_item_id}/complete", response_model=WorkItemResponse)
async def complete_work_item(work_item_id: str, data: CompleteWorkItemRequest):
    """Mark a work item as complete."""
    db = get_database()

    wi_doc = await db.work_items.find_one({"_id": ObjectId(work_item_id)})
    if not wi_doc:
        raise HTTPException(status_code=404, detail="Work item not found")

    work_item = WorkItem(**wi_doc)
    work_item.complete(user_id="system", notes=data.notes)

    await db.work_items.update_one(
        {"_id": ObjectId(work_item_id)},
        {"$set": work_item.model_dump_mongo()}
    )

    await manager.broadcast("work_item_completed", {"id": str(work_item.id)})
    return work_item_to_response(work_item)


class SnoozeWorkItemRequest(BaseModel):
    until: datetime


@router.post("/{work_item_id}/snooze", response_model=WorkItemResponse)
async def snooze_work_item(work_item_id: str, data: SnoozeWorkItemRequest):
    """Snooze a work item."""
    db = get_database()

    wi_doc = await db.work_items.find_one({"_id": ObjectId(work_item_id)})
    if not wi_doc:
        raise HTTPException(status_code=404, detail="Work item not found")

    work_item = WorkItem(**wi_doc)
    work_item.snooze(data.until)

    await db.work_items.update_one(
        {"_id": ObjectId(work_item_id)},
        {"$set": work_item.model_dump_mongo()}
    )

    return work_item_to_response(work_item)


class AssignWorkItemRequest(BaseModel):
    user_id: str


@router.post("/{work_item_id}/assign", response_model=WorkItemResponse)
async def assign_work_item(work_item_id: str, data: AssignWorkItemRequest):
    """Assign a work item to a user."""
    db = get_database()

    wi_doc = await db.work_items.find_one({"_id": ObjectId(work_item_id)})
    if not wi_doc:
        raise HTTPException(status_code=404, detail="Work item not found")

    work_item = WorkItem(**wi_doc)
    work_item.assign(data.user_id)

    await db.work_items.update_one(
        {"_id": ObjectId(work_item_id)},
        {"$set": work_item.model_dump_mongo()}
    )

    await manager.broadcast("work_item_assigned", {"id": str(work_item.id), "assigned_to": data.user_id})
    return work_item_to_response(work_item)
