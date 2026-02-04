from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.tracking import TrackingEvent, TrackingEventType

router = APIRouter()


class TrackingEventCreate(BaseModel):
    shipment_id: str
    event_type: TrackingEventType
    event_timestamp: datetime
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_zip: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    stop_number: Optional[int] = None
    is_exception: bool = False


class TrackingEventResponse(BaseModel):
    id: str
    shipment_id: str
    event_type: TrackingEventType
    event_timestamp: datetime
    reported_at: datetime
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_zip: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    reported_by: Optional[str] = None
    source: str
    stop_number: Optional[int] = None
    is_exception: bool
    exception_resolved: bool
    exception_resolution: Optional[str] = None


def event_to_response(event: TrackingEvent) -> TrackingEventResponse:
    return TrackingEventResponse(
        id=str(event.id),
        shipment_id=str(event.shipment_id),
        event_type=event.event_type,
        event_timestamp=event.event_timestamp,
        reported_at=event.reported_at,
        location_city=event.location_city,
        location_state=event.location_state,
        location_zip=event.location_zip,
        latitude=event.latitude,
        longitude=event.longitude,
        description=event.description,
        notes=event.notes,
        reported_by=event.reported_by,
        source=event.source,
        stop_number=event.stop_number,
        is_exception=event.is_exception,
        exception_resolved=event.exception_resolved,
        exception_resolution=event.exception_resolution,
    )


@router.get("/shipment/{shipment_id}", response_model=List[TrackingEventResponse])
async def get_shipment_tracking(shipment_id: str):
    """Get all tracking events for a shipment."""
    db = get_database()

    events = await db.tracking_events.find(
        {"shipment_id": ObjectId(shipment_id)}
    ).sort("event_timestamp", -1).to_list(100)

    return [event_to_response(TrackingEvent(**e)) for e in events]


@router.post("", response_model=TrackingEventResponse)
async def create_tracking_event(data: TrackingEventCreate):
    """Create a new tracking event."""
    db = get_database()

    event = TrackingEvent(
        shipment_id=ObjectId(data.shipment_id),
        event_type=data.event_type,
        event_timestamp=data.event_timestamp,
        reported_at=datetime.utcnow(),
        location_city=data.location_city,
        location_state=data.location_state,
        location_zip=data.location_zip,
        latitude=data.latitude,
        longitude=data.longitude,
        description=data.description,
        notes=data.notes,
        stop_number=data.stop_number,
        is_exception=data.is_exception,
        source="manual",
    )

    await db.tracking_events.insert_one(event.model_dump_mongo())

    # Update shipment location if provided
    if data.location_city and data.location_state:
        await db.shipments.update_one(
            {"_id": ObjectId(data.shipment_id)},
            {
                "$set": {
                    "last_known_location": f"{data.location_city}, {data.location_state}",
                    "last_check_call": datetime.utcnow(),
                }
            }
        )

    return event_to_response(event)


class ResolveExceptionRequest(BaseModel):
    resolution: str


@router.post("/{event_id}/resolve", response_model=TrackingEventResponse)
async def resolve_exception(event_id: str, data: ResolveExceptionRequest):
    """Resolve an exception tracking event."""
    db = get_database()

    event_doc = await db.tracking_events.find_one({"_id": ObjectId(event_id)})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Event not found")

    event = TrackingEvent(**event_doc)

    if not event.is_exception:
        raise HTTPException(status_code=400, detail="Event is not an exception")

    event.exception_resolved = True
    event.exception_resolution = data.resolution

    await db.tracking_events.update_one(
        {"_id": ObjectId(event_id)},
        {"$set": event.model_dump_mongo()}
    )

    return event_to_response(event)
