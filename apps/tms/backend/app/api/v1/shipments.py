from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.shipment import Shipment, ShipmentStatus
from app.models.tracking import TrackingEvent, TrackingEventType
from app.models.work_item import WorkItem, WorkItemType
from app.schemas.shipment import ShipmentCreate, ShipmentUpdate, ShipmentResponse
from app.services.number_generator import NumberGenerator
from app.services.carrier_matching import CarrierMatchingService
from app.services.websocket_manager import manager

router = APIRouter()


def shipment_to_response(shipment: Shipment) -> ShipmentResponse:
    """Convert Shipment model to response schema."""
    return ShipmentResponse(
        id=str(shipment.id),
        shipment_number=shipment.shipment_number,
        pro_number=shipment.pro_number,
        bol_number=shipment.bol_number,
        customer_id=str(shipment.customer_id),
        carrier_id=str(shipment.carrier_id) if shipment.carrier_id else None,
        quote_id=str(shipment.quote_id) if shipment.quote_id else None,
        status=shipment.status,
        stops=shipment.stops,
        equipment_type=shipment.equipment_type,
        weight_lbs=shipment.weight_lbs,
        commodity=shipment.commodity,
        piece_count=shipment.piece_count,
        pallet_count=shipment.pallet_count,
        special_requirements=shipment.special_requirements,
        customer_price=shipment.customer_price,
        carrier_cost=shipment.carrier_cost,
        fuel_surcharge=shipment.fuel_surcharge,
        fuel_surcharge_schedule_id=shipment.fuel_surcharge_schedule_id,
        assigned_equipment=shipment.assigned_equipment,
        margin=shipment.margin,
        margin_percent=shipment.margin_percent,
        pickup_date=shipment.pickup_date,
        delivery_date=shipment.delivery_date,
        actual_pickup_date=shipment.actual_pickup_date,
        actual_delivery_date=shipment.actual_delivery_date,
        last_known_location=shipment.last_known_location,
        last_check_call=shipment.last_check_call,
        eta=shipment.eta,
        is_at_risk=shipment.is_at_risk,
        internal_notes=shipment.internal_notes,
        customer_notes=shipment.customer_notes,
        assigned_to=shipment.assigned_to,
        created_by=shipment.created_by,
        split_parent_id=shipment.split_parent_id,
        split_children=shipment.split_children,
        consolidated_into=shipment.consolidated_into,
        created_at=shipment.created_at,
        updated_at=shipment.updated_at,
    )


@router.get("", response_model=List[ShipmentResponse])
async def list_shipments(
    status: Optional[ShipmentStatus] = None,
    customer_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    at_risk: Optional[bool] = None,
):
    """List all shipments with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)

    cursor = db.shipments.find(query).sort("created_at", -1)
    shipments = await cursor.to_list(1000)

    result = [shipment_to_response(Shipment(**s)) for s in shipments]

    # Filter by at_risk if specified
    if at_risk is not None:
        result = [s for s in result if s.is_at_risk == at_risk]

    return result


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(shipment_id: str):
    """Get a shipment by ID."""
    db = get_database()

    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    return shipment_to_response(Shipment(**shipment))


@router.post("", response_model=ShipmentResponse)
async def create_shipment(data: ShipmentCreate):
    """Create a new shipment."""
    db = get_database()

    shipment_data = data.model_dump()
    shipment_data["customer_id"] = ObjectId(shipment_data["customer_id"])
    if shipment_data.get("carrier_id"):
        shipment_data["carrier_id"] = ObjectId(shipment_data["carrier_id"])
    if shipment_data.get("quote_id"):
        shipment_data["quote_id"] = ObjectId(shipment_data["quote_id"])

    # Generate shipment number
    shipment_number = await NumberGenerator.get_next_shipment_number()
    shipment_data["shipment_number"] = shipment_number

    shipment = Shipment(**shipment_data)
    await db.shipments.insert_one(shipment.model_dump_mongo())

    # Create work item if no carrier assigned
    if not shipment.carrier_id:
        work_item = WorkItem(
            work_type=WorkItemType.SHIPMENT_NEEDS_CARRIER,
            title=f"Find carrier for {shipment_number}",
            priority=70,
            shipment_id=shipment.id,
            customer_id=shipment.customer_id,
        )
        await db.work_items.insert_one(work_item.model_dump_mongo())

    await manager.broadcast("shipment_created", {"id": str(shipment.id), "shipment_number": shipment.shipment_number})
    return shipment_to_response(shipment)


@router.patch("/{shipment_id}", response_model=ShipmentResponse)
async def update_shipment(shipment_id: str, data: ShipmentUpdate):
    """Update a shipment."""
    db = get_database()

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != shipment.status:
            shipment.transition_to(new_status)

    # Convert ObjectId fields
    if "carrier_id" in update_data and update_data["carrier_id"]:
        update_data["carrier_id"] = ObjectId(update_data["carrier_id"])

    for field, value in update_data.items():
        setattr(shipment, field, value)

    shipment.mark_updated()

    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": shipment.model_dump_mongo()}
    )

    await manager.broadcast("shipment_updated", {"id": shipment_id})
    return shipment_to_response(shipment)


class TransitionRequest(BaseModel):
    status: ShipmentStatus
    notes: Optional[str] = None


@router.post("/{shipment_id}/transition", response_model=ShipmentResponse)
async def transition_shipment(shipment_id: str, data: TransitionRequest):
    """Transition shipment status."""
    db = get_database()

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)

    try:
        shipment.transition_to(data.status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": shipment.model_dump_mongo()}
    )

    # Create tracking event
    event_type_map = {
        ShipmentStatus.PENDING_PICKUP: TrackingEventType.DISPATCHED,
        ShipmentStatus.IN_TRANSIT: TrackingEventType.DEPARTED_PICKUP,
        ShipmentStatus.OUT_FOR_DELIVERY: TrackingEventType.ARRIVED_AT_DELIVERY,
        ShipmentStatus.DELIVERED: TrackingEventType.DELIVERED,
    }

    if data.status in event_type_map:
        event = TrackingEvent(
            shipment_id=shipment.id,
            event_type=event_type_map[data.status],
            event_timestamp=datetime.utcnow(),
            reported_at=datetime.utcnow(),
            description=data.notes,
            source="manual",
        )
        await db.tracking_events.insert_one(event.model_dump_mongo())

    await manager.broadcast("shipment_status_changed", {"id": shipment_id, "status": data.status})
    return shipment_to_response(shipment)


@router.post("/{shipment_id}/suggest-carriers")
async def suggest_carriers(shipment_id: str):
    """Get AI-powered carrier suggestions for a shipment."""
    db = get_database()

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)

    if len(shipment.stops) < 2:
        raise HTTPException(status_code=400, detail="Shipment needs at least pickup and delivery stops")

    pickup = shipment.stops[0]
    delivery = shipment.stops[-1]

    service = CarrierMatchingService()
    matches = await service.find_matching_carriers(
        origin_city=pickup.city,
        origin_state=pickup.state,
        destination_city=delivery.city,
        destination_state=delivery.state,
        equipment_type=shipment.equipment_type,
        pickup_date=shipment.pickup_date.isoformat() if shipment.pickup_date else None,
        weight_lbs=shipment.weight_lbs,
    )

    return {"suggestions": [
        {
            "carrier_id": m.carrier_id,
            "carrier_name": m.carrier_name,
            "score": m.score,
            "reasons": m.reasons,
            "on_time_percentage": m.on_time_percentage,
            "total_loads_on_lane": m.total_loads_on_lane,
            "insurance_status": m.insurance_status,
            "estimated_cost": m.estimated_cost,
        }
        for m in matches
    ]}


class CheckCallRequest(BaseModel):
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    notes: Optional[str] = None
    eta: Optional[datetime] = None


@router.post("/{shipment_id}/tracking")
async def add_tracking_event(shipment_id: str, data: CheckCallRequest):
    """Add a tracking event (check call) to a shipment."""
    db = get_database()

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)

    # Create tracking event
    event = TrackingEvent(
        shipment_id=shipment.id,
        event_type=TrackingEventType.CHECK_CALL,
        event_timestamp=datetime.utcnow(),
        reported_at=datetime.utcnow(),
        location_city=data.location_city,
        location_state=data.location_state,
        description=data.notes,
        source="manual",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    # Update shipment
    update_data = {"last_check_call": datetime.utcnow()}
    if data.location_city and data.location_state:
        update_data["last_known_location"] = f"{data.location_city}, {data.location_state}"
    if data.eta:
        update_data["eta"] = data.eta

    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": update_data}
    )

    await manager.broadcast("tracking_update", {"shipment_id": shipment_id})
    return {"success": True, "event_id": str(event.id)}


@router.get("/{shipment_id}/tracking")
async def get_tracking_events(shipment_id: str):
    """Get tracking events for a shipment."""
    db = get_database()

    events = await db.tracking_events.find(
        {"shipment_id": ObjectId(shipment_id)}
    ).sort("event_timestamp", -1).to_list(100)

    return [
        {
            "id": str(e["_id"]),
            "event_type": e["event_type"],
            "event_timestamp": e["event_timestamp"],
            "location_city": e.get("location_city"),
            "location_state": e.get("location_state"),
            "description": e.get("description"),
            "source": e.get("source"),
        }
        for e in events
    ]
