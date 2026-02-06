"""Driver-facing mobile API endpoints.

All endpoints are prefixed with /driver-app in the router registration.
These are designed for the driver mobile PWA and use simplified
request/response patterns optimized for mobile usage.
"""

from typing import List, Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.shipment import Shipment, ShipmentStatus
from app.models.tracking import TrackingEvent, TrackingEventType
from app.models.driver import Driver
from app.models.driver_checkin import DriverCheckin, CheckinEventType
from app.models.base import utc_now

router = APIRouter()


# ---- Request/Response Schemas ----

class DriverLoginRequest(BaseModel):
    phone: str
    pin: str


class DriverLoginResponse(BaseModel):
    driver_id: str
    name: str
    phone: str
    carrier_id: Optional[str] = None
    token: str  # Simple session token


class StopResponse(BaseModel):
    stop_number: int
    stop_type: str
    name: Optional[str] = None
    address: str
    city: str
    state: str
    zip_code: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    scheduled_time_start: Optional[str] = None
    scheduled_time_end: Optional[str] = None
    appointment_number: Optional[str] = None
    actual_arrival: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    special_instructions: Optional[str] = None


class DriverLoadResponse(BaseModel):
    id: str
    shipment_number: str
    bol_number: Optional[str] = None
    pro_number: Optional[str] = None
    status: str
    equipment_type: str
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    piece_count: Optional[int] = None
    pallet_count: Optional[int] = None
    special_requirements: Optional[str] = None
    customer_notes: Optional[str] = None
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    actual_pickup_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    stops: List[StopResponse]
    last_known_location: Optional[str] = None
    eta: Optional[datetime] = None


class StatusUpdateRequest(BaseModel):
    status: str  # "picked_up", "in_transit", "out_for_delivery", "delivered"
    notes: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class CheckinRequest(BaseModel):
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    notes: Optional[str] = None
    eta_minutes: Optional[int] = None


class PODUploadRequest(BaseModel):
    photo_urls: List[str]
    notes: Optional[str] = None
    signer_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class ExceptionRequest(BaseModel):
    reason: str  # "delay", "damage", "refusal", "wrong_address", "closed", "other"
    details: str
    photo_urls: List[str] = []
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class LocationUpdateRequest(BaseModel):
    lat: float
    lng: float


# ---- Helper Functions ----

def shipment_to_driver_response(shipment: Shipment) -> DriverLoadResponse:
    """Convert a Shipment model to a driver-friendly response."""
    stops = [
        StopResponse(
            stop_number=s.stop_number,
            stop_type=s.stop_type.value if hasattr(s.stop_type, 'value') else str(s.stop_type),
            name=s.name,
            address=s.address,
            city=s.city,
            state=s.state,
            zip_code=s.zip_code,
            contact_name=s.contact_name,
            contact_phone=s.contact_phone,
            scheduled_date=s.scheduled_date,
            scheduled_time_start=s.scheduled_time_start,
            scheduled_time_end=s.scheduled_time_end,
            appointment_number=s.appointment_number,
            actual_arrival=s.actual_arrival,
            actual_departure=s.actual_departure,
            special_instructions=s.special_instructions,
        )
        for s in shipment.stops
    ]
    return DriverLoadResponse(
        id=str(shipment.id),
        shipment_number=shipment.shipment_number,
        bol_number=shipment.bol_number,
        pro_number=shipment.pro_number,
        status=shipment.status.value if hasattr(shipment.status, 'value') else str(shipment.status),
        equipment_type=shipment.equipment_type,
        weight_lbs=shipment.weight_lbs,
        commodity=shipment.commodity,
        piece_count=shipment.piece_count,
        pallet_count=shipment.pallet_count,
        special_requirements=shipment.special_requirements,
        customer_notes=shipment.customer_notes,
        pickup_date=shipment.pickup_date,
        delivery_date=shipment.delivery_date,
        actual_pickup_date=shipment.actual_pickup_date,
        actual_delivery_date=shipment.actual_delivery_date,
        stops=stops,
        last_known_location=shipment.last_known_location,
        eta=shipment.eta,
    )


async def get_driver_by_id(driver_id: str) -> Driver:
    """Fetch a driver by ID or raise 404."""
    db = get_database()
    doc = await db.drivers.find_one({"_id": ObjectId(driver_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Driver not found")
    return Driver(**doc)


# ---- Endpoints ----

@router.post("/login", response_model=DriverLoginResponse)
async def driver_login(data: DriverLoginRequest):
    """Authenticate a driver via phone + PIN."""
    db = get_database()

    driver_doc = await db.drivers.find_one({"phone": data.phone, "pin": data.pin})
    if not driver_doc:
        raise HTTPException(status_code=401, detail="Invalid phone or PIN")

    driver = Driver(**driver_doc)

    if driver.status != "active":
        raise HTTPException(status_code=403, detail="Driver account is not active")

    # Simple token (in production, use JWT)
    token = f"driver_{driver.id}_{int(utc_now().timestamp())}"

    return DriverLoginResponse(
        driver_id=str(driver.id),
        name=driver.name,
        phone=driver.phone,
        carrier_id=str(driver.carrier_id) if driver.carrier_id else None,
        token=token,
    )


@router.get("/my-loads", response_model=List[DriverLoadResponse])
async def get_my_loads(
    driver_id: str,
    status: Optional[str] = None,
):
    """Get loads assigned to this driver's carrier.

    Filters shipments by the driver's carrier_id and optionally by status.
    Returns active loads (not cancelled/delivered by default).
    """
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    if not driver.carrier_id:
        return []

    query: dict = {"carrier_id": driver.carrier_id}

    if status:
        query["status"] = status
    else:
        # Default: show active loads
        query["status"] = {
            "$in": [
                ShipmentStatus.BOOKED.value,
                ShipmentStatus.PENDING_PICKUP.value,
                ShipmentStatus.IN_TRANSIT.value,
                ShipmentStatus.OUT_FOR_DELIVERY.value,
            ]
        }

    cursor = db.shipments.find(query).sort("pickup_date", 1)
    shipments = await cursor.to_list(100)

    return [shipment_to_driver_response(Shipment(**s)) for s in shipments]


@router.get("/my-loads/{shipment_id}", response_model=DriverLoadResponse)
async def get_my_load_detail(shipment_id: str, driver_id: str):
    """Get a single load detail for the driver."""
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)

    # Verify driver's carrier owns this shipment
    if driver.carrier_id and shipment.carrier_id != driver.carrier_id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")

    return shipment_to_driver_response(shipment)


@router.post("/my-loads/{shipment_id}/status")
async def update_load_status(shipment_id: str, driver_id: str, data: StatusUpdateRequest):
    """Update load status from driver app.

    Maps driver-friendly status names to shipment state machine transitions.
    """
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)

    if driver.carrier_id and shipment.carrier_id != driver.carrier_id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")

    # Map driver-friendly statuses to ShipmentStatus
    status_map = {
        "picked_up": ShipmentStatus.IN_TRANSIT,
        "in_transit": ShipmentStatus.IN_TRANSIT,
        "out_for_delivery": ShipmentStatus.OUT_FOR_DELIVERY,
        "delivered": ShipmentStatus.DELIVERED,
        "pending_pickup": ShipmentStatus.PENDING_PICKUP,
    }

    new_status = status_map.get(data.status)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")

    try:
        shipment.transition_to(new_status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": shipment.model_dump_mongo()}
    )

    # Map to tracking event type
    event_type_map = {
        ShipmentStatus.PENDING_PICKUP: TrackingEventType.EN_ROUTE_TO_PICKUP,
        ShipmentStatus.IN_TRANSIT: TrackingEventType.DEPARTED_PICKUP,
        ShipmentStatus.OUT_FOR_DELIVERY: TrackingEventType.ARRIVED_AT_DELIVERY,
        ShipmentStatus.DELIVERED: TrackingEventType.DELIVERED,
    }

    event_type = event_type_map.get(new_status, TrackingEventType.NOTE)
    now = utc_now()

    event = TrackingEvent(
        shipment_id=shipment.id,
        event_type=event_type,
        event_timestamp=now,
        reported_at=now,
        latitude=data.location_lat,
        longitude=data.location_lng,
        description=data.notes or f"Status updated to {data.status} by driver",
        reported_by=driver_id,
        source="driver_app",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    return {"success": True, "new_status": new_status.value}


@router.post("/my-loads/{shipment_id}/checkin")
async def submit_checkin(shipment_id: str, driver_id: str, data: CheckinRequest):
    """Submit a check call with location and notes."""
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)
    if driver.carrier_id and shipment.carrier_id != driver.carrier_id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")

    location = None
    if data.location_lat is not None and data.location_lng is not None:
        location = {"lat": data.location_lat, "lng": data.location_lng}

    # Create check-in record
    checkin = DriverCheckin(
        driver_id=ObjectId(driver_id),
        shipment_id=ObjectId(shipment_id),
        location=location,
        event_type=CheckinEventType.CHECK_CALL,
        notes=data.notes,
    )
    await db.driver_checkins.insert_one(checkin.model_dump_mongo())

    # Create tracking event
    now = utc_now()
    event = TrackingEvent(
        shipment_id=shipment.id,
        event_type=TrackingEventType.CHECK_CALL,
        event_timestamp=now,
        reported_at=now,
        latitude=data.location_lat,
        longitude=data.location_lng,
        description=data.notes,
        reported_by=driver_id,
        source="driver_app",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    # Update shipment tracking info
    update_data: dict = {"last_check_call": now}
    if data.eta_minutes is not None:
        update_data["eta"] = now + timedelta(minutes=data.eta_minutes)

    await db.shipments.update_one(
        {"_id": ObjectId(shipment_id)},
        {"$set": update_data}
    )

    return {"success": True, "checkin_id": str(checkin.id)}


@router.post("/my-loads/{shipment_id}/pod")
async def upload_pod(shipment_id: str, driver_id: str, data: PODUploadRequest):
    """Upload proof of delivery metadata."""
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)
    if driver.carrier_id and shipment.carrier_id != driver.carrier_id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")

    location = None
    if data.location_lat is not None and data.location_lng is not None:
        location = {"lat": data.location_lat, "lng": data.location_lng}

    checkin = DriverCheckin(
        driver_id=ObjectId(driver_id),
        shipment_id=ObjectId(shipment_id),
        location=location,
        event_type=CheckinEventType.POD_UPLOAD,
        notes=data.notes or f"POD signed by {data.signer_name}" if data.signer_name else data.notes,
        photos=data.photo_urls,
    )
    await db.driver_checkins.insert_one(checkin.model_dump_mongo())

    # Create tracking event
    now = utc_now()
    event = TrackingEvent(
        shipment_id=shipment.id,
        event_type=TrackingEventType.POD_RECEIVED,
        event_timestamp=now,
        reported_at=now,
        latitude=data.location_lat,
        longitude=data.location_lng,
        description=f"POD uploaded with {len(data.photo_urls)} photo(s)",
        reported_by=driver_id,
        source="driver_app",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    return {"success": True, "checkin_id": str(checkin.id)}


@router.post("/my-loads/{shipment_id}/exception")
async def report_exception(shipment_id: str, driver_id: str, data: ExceptionRequest):
    """Report an exception (delay, damage, refusal, etc.)."""
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    shipment_doc = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment_doc:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment = Shipment(**shipment_doc)
    if driver.carrier_id and shipment.carrier_id != driver.carrier_id:
        raise HTTPException(status_code=403, detail="Not authorized for this shipment")

    location = None
    if data.location_lat is not None and data.location_lng is not None:
        location = {"lat": data.location_lat, "lng": data.location_lng}

    checkin = DriverCheckin(
        driver_id=ObjectId(driver_id),
        shipment_id=ObjectId(shipment_id),
        location=location,
        event_type=CheckinEventType.EXCEPTION,
        notes=data.details,
        photos=data.photo_urls,
        exception_reason=data.reason,
        exception_details=data.details,
    )
    await db.driver_checkins.insert_one(checkin.model_dump_mongo())

    # Create tracking event
    now = utc_now()
    event = TrackingEvent(
        shipment_id=shipment.id,
        event_type=TrackingEventType.EXCEPTION,
        event_timestamp=now,
        reported_at=now,
        latitude=data.location_lat,
        longitude=data.location_lng,
        description=f"Exception: {data.reason} - {data.details}",
        reported_by=driver_id,
        source="driver_app",
        is_exception=True,
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    return {"success": True, "checkin_id": str(checkin.id)}


@router.put("/my-location")
async def update_location(driver_id: str, data: LocationUpdateRequest):
    """Update driver's current GPS location."""
    db = get_database()

    now = utc_now()
    result = await db.drivers.update_one(
        {"_id": ObjectId(driver_id)},
        {
            "$set": {
                "current_location": {"lat": data.lat, "lng": data.lng},
                "last_location_update": now,
                "updated_at": now,
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")

    return {"success": True}


@router.get("/my-schedule", response_model=List[DriverLoadResponse])
async def get_schedule(driver_id: str):
    """Get upcoming loads for the next 7 days."""
    db = get_database()
    driver = await get_driver_by_id(driver_id)

    if not driver.carrier_id:
        return []

    now = utc_now()
    seven_days = now + timedelta(days=7)

    query = {
        "carrier_id": driver.carrier_id,
        "status": {
            "$in": [
                ShipmentStatus.BOOKED.value,
                ShipmentStatus.PENDING_PICKUP.value,
                ShipmentStatus.IN_TRANSIT.value,
                ShipmentStatus.OUT_FOR_DELIVERY.value,
            ]
        },
        "$or": [
            {"pickup_date": {"$gte": now, "$lte": seven_days}},
            {"delivery_date": {"$gte": now, "$lte": seven_days}},
            # Also include loads already in transit (no date filter needed)
            {"status": {"$in": [ShipmentStatus.IN_TRANSIT.value, ShipmentStatus.OUT_FOR_DELIVERY.value]}},
        ]
    }

    cursor = db.shipments.find(query).sort("pickup_date", 1)
    shipments = await cursor.to_list(100)

    return [shipment_to_driver_response(Shipment(**s)) for s in shipments]
