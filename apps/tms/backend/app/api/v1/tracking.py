from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.tracking import TrackingEvent, TrackingEventType
from app.models.geofence import Geofence, GeofenceType, GeofenceTrigger, TrackingLink, PODCapture
from app.services.tracking_service import TrackingService

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


# ============================================================================
# GPS Location Update
# ============================================================================

class GPSUpdateRequest(BaseModel):
    """Request to update shipment location via GPS."""
    shipment_id: str
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    source: str = "gps"


class GPSUpdateResponse(BaseModel):
    tracking_event_id: str
    location: Optional[str]
    latitude: float
    longitude: float
    triggered_geofences: List[dict]
    eta: Optional[dict] = None


@router.post("/gps-update", response_model=GPSUpdateResponse)
async def update_gps_location(data: GPSUpdateRequest):
    """Update shipment location from GPS and check geofences."""
    try:
        result = await TrackingService.update_shipment_location(
            shipment_id=data.shipment_id,
            latitude=data.latitude,
            longitude=data.longitude,
            city=data.city,
            state=data.state,
            source=data.source,
        )
        return GPSUpdateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Geofences
# ============================================================================

class GeofenceCreate(BaseModel):
    name: str
    geofence_type: GeofenceType = GeofenceType.CUSTOM
    latitude: float
    longitude: float
    radius_meters: int = 500
    trigger: GeofenceTrigger = GeofenceTrigger.BOTH
    shipment_id: Optional[str] = None
    facility_id: Optional[str] = None
    customer_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    alert_email: Optional[str] = None
    alert_webhook_url: Optional[str] = None
    alert_push: bool = True


class GeofenceResponse(BaseModel):
    id: str
    name: str
    geofence_type: GeofenceType
    latitude: float
    longitude: float
    radius_meters: int
    trigger: GeofenceTrigger
    shipment_id: Optional[str] = None
    facility_id: Optional[str] = None
    customer_id: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    is_active: bool
    created_at: datetime


def geofence_to_response(gf: Geofence) -> GeofenceResponse:
    return GeofenceResponse(
        id=str(gf.id),
        name=gf.name,
        geofence_type=gf.geofence_type,
        latitude=gf.latitude,
        longitude=gf.longitude,
        radius_meters=gf.radius_meters,
        trigger=gf.trigger,
        shipment_id=str(gf.shipment_id) if gf.shipment_id else None,
        facility_id=str(gf.facility_id) if gf.facility_id else None,
        customer_id=str(gf.customer_id) if gf.customer_id else None,
        address=gf.address,
        city=gf.city,
        state=gf.state,
        zip_code=gf.zip_code,
        is_active=gf.is_active,
        created_at=gf.created_at,
    )


@router.get("/geofences", response_model=List[GeofenceResponse])
async def list_geofences(
    shipment_id: Optional[str] = None,
    facility_id: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """List geofences with optional filters."""
    db = get_database()

    query = {}
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if facility_id:
        query["facility_id"] = ObjectId(facility_id)
    if is_active is not None:
        query["is_active"] = is_active

    geofences = await db.geofences.find(query).sort("created_at", -1).to_list(100)
    return [geofence_to_response(Geofence(**gf)) for gf in geofences]


@router.post("/geofences", response_model=GeofenceResponse)
async def create_geofence(data: GeofenceCreate):
    """Create a new geofence."""
    db = get_database()

    gf = Geofence(
        name=data.name,
        geofence_type=data.geofence_type,
        latitude=data.latitude,
        longitude=data.longitude,
        radius_meters=data.radius_meters,
        trigger=data.trigger,
        shipment_id=ObjectId(data.shipment_id) if data.shipment_id else None,
        facility_id=ObjectId(data.facility_id) if data.facility_id else None,
        customer_id=ObjectId(data.customer_id) if data.customer_id else None,
        address=data.address,
        city=data.city,
        state=data.state,
        zip_code=data.zip_code,
        alert_email=data.alert_email,
        alert_webhook_url=data.alert_webhook_url,
        alert_push=data.alert_push,
    )

    await db.geofences.insert_one(gf.model_dump_mongo())
    return geofence_to_response(gf)


@router.delete("/geofences/{geofence_id}")
async def delete_geofence(geofence_id: str):
    """Delete a geofence."""
    db = get_database()
    result = await db.geofences.delete_one({"_id": ObjectId(geofence_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return {"status": "deleted"}


@router.patch("/geofences/{geofence_id}/toggle")
async def toggle_geofence(geofence_id: str):
    """Toggle geofence active status."""
    db = get_database()
    gf_doc = await db.geofences.find_one({"_id": ObjectId(geofence_id)})
    if not gf_doc:
        raise HTTPException(status_code=404, detail="Geofence not found")

    new_status = not gf_doc.get("is_active", True)
    await db.geofences.update_one(
        {"_id": ObjectId(geofence_id)},
        {"$set": {"is_active": new_status}}
    )
    return {"is_active": new_status}


# ============================================================================
# Public Tracking Portal
# ============================================================================

class TrackingLinkCreate(BaseModel):
    shipment_id: str
    customer_id: Optional[str] = None
    expires_in_days: int = 30
    allow_pod_view: bool = True
    allow_document_view: bool = False
    show_carrier_info: bool = False
    show_pricing: bool = False


class TrackingLinkResponse(BaseModel):
    id: str
    shipment_id: str
    token: str
    tracking_url: str
    expires_at: Optional[datetime] = None
    is_active: bool
    view_count: int
    created_at: datetime


@router.post("/links", response_model=TrackingLinkResponse)
async def create_tracking_link(data: TrackingLinkCreate):
    """Create a shareable tracking link for customers."""
    link = await TrackingService.create_tracking_link(
        shipment_id=data.shipment_id,
        customer_id=data.customer_id,
        expires_in_days=data.expires_in_days,
        allow_pod_view=data.allow_pod_view,
        allow_document_view=data.allow_document_view,
        show_carrier_info=data.show_carrier_info,
        show_pricing=data.show_pricing,
    )

    # Build tracking URL
    tracking_url = f"/track/{link.token}"

    return TrackingLinkResponse(
        id=str(link.id),
        shipment_id=str(link.shipment_id),
        token=link.token,
        tracking_url=tracking_url,
        expires_at=link.expires_at,
        is_active=link.is_active,
        view_count=link.view_count,
        created_at=link.created_at,
    )


@router.get("/links/shipment/{shipment_id}", response_model=List[TrackingLinkResponse])
async def get_shipment_tracking_links(shipment_id: str):
    """Get all tracking links for a shipment."""
    db = get_database()
    links = await db.tracking_links.find(
        {"shipment_id": ObjectId(shipment_id)}
    ).sort("created_at", -1).to_list(20)

    return [
        TrackingLinkResponse(
            id=str(link["_id"]),
            shipment_id=str(link["shipment_id"]),
            token=link["token"],
            tracking_url=f"/track/{link['token']}",
            expires_at=link.get("expires_at"),
            is_active=link.get("is_active", True),
            view_count=link.get("view_count", 0),
            created_at=link["created_at"],
        )
        for link in links
    ]


@router.get("/public/{token}")
async def get_public_tracking(token: str):
    """Get tracking info by public token (no auth required)."""
    result = await TrackingService.get_tracking_by_token(token)
    if not result:
        raise HTTPException(status_code=404, detail="Tracking link not found or expired")
    return result


@router.delete("/links/{link_id}")
async def deactivate_tracking_link(link_id: str):
    """Deactivate a tracking link."""
    db = get_database()
    result = await db.tracking_links.update_one(
        {"_id": ObjectId(link_id)},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tracking link not found")
    return {"status": "deactivated"}


# ============================================================================
# POD Capture
# ============================================================================

class PODCaptureRequest(BaseModel):
    shipment_id: str
    signature_data: Optional[str] = None  # Base64 encoded
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    received_by: Optional[str] = None
    delivery_notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PODResponse(BaseModel):
    id: str
    shipment_id: str
    capture_type: str
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None
    received_by: Optional[str] = None
    delivery_notes: Optional[str] = None
    photo_count: int
    captured_at: datetime
    is_verified: bool
    has_signature: bool


@router.post("/pod", response_model=PODResponse)
async def capture_pod(data: PODCaptureRequest):
    """Capture proof of delivery (signature and/or photos)."""
    pod = await TrackingService.capture_pod(
        shipment_id=data.shipment_id,
        signature_data=data.signature_data,
        signer_name=data.signer_name,
        signer_title=data.signer_title,
        photo_urls=data.photo_urls,
        received_by=data.received_by,
        delivery_notes=data.delivery_notes,
        latitude=data.latitude,
        longitude=data.longitude,
    )

    return PODResponse(
        id=str(pod.id),
        shipment_id=str(pod.shipment_id),
        capture_type=pod.capture_type,
        signer_name=pod.signer_name,
        signer_title=pod.signer_title,
        received_by=pod.received_by,
        delivery_notes=pod.delivery_notes,
        photo_count=pod.photo_count,
        captured_at=pod.captured_at,
        is_verified=pod.is_verified,
        has_signature=bool(pod.signature_data),
    )


@router.get("/pod/shipment/{shipment_id}", response_model=Optional[PODResponse])
async def get_shipment_pod(shipment_id: str):
    """Get POD for a shipment."""
    db = get_database()
    pod_doc = await db.pod_captures.find_one({"shipment_id": ObjectId(shipment_id)})

    if not pod_doc:
        return None

    pod = PODCapture(**pod_doc)
    return PODResponse(
        id=str(pod.id),
        shipment_id=str(pod.shipment_id),
        capture_type=pod.capture_type,
        signer_name=pod.signer_name,
        signer_title=pod.signer_title,
        received_by=pod.received_by,
        delivery_notes=pod.delivery_notes,
        photo_count=pod.photo_count,
        captured_at=pod.captured_at,
        is_verified=pod.is_verified,
        has_signature=bool(pod.signature_data),
    )


@router.post("/pod/{pod_id}/verify")
async def verify_pod(pod_id: str, verified_by: str = "system"):
    """Verify a POD."""
    db = get_database()
    result = await db.pod_captures.update_one(
        {"_id": ObjectId(pod_id)},
        {
            "$set": {
                "is_verified": True,
                "verified_by": verified_by,
                "verified_at": datetime.utcnow(),
            }
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="POD not found")
    return {"status": "verified"}


# ============================================================================
# Exception Detection
# ============================================================================

class ExceptionResponse(BaseModel):
    type: str
    severity: str
    message: str
    details: Optional[dict] = None


@router.get("/exceptions/shipment/{shipment_id}", response_model=List[ExceptionResponse])
async def detect_shipment_exceptions(shipment_id: str):
    """Detect potential exceptions for a shipment."""
    exceptions = await TrackingService.detect_exceptions(shipment_id)
    return [
        ExceptionResponse(
            type=e["type"],
            severity=e["severity"],
            message=e["message"],
            details={k: v for k, v in e.items() if k not in ["type", "severity", "message"]},
        )
        for e in exceptions
    ]


@router.get("/exceptions/all")
async def detect_all_exceptions():
    """Detect exceptions across all active shipments."""
    db = get_database()

    # Get active shipments
    shipments = await db.shipments.find({
        "status": {"$in": ["booked", "pending_pickup", "in_transit", "out_for_delivery"]}
    }).to_list(500)

    all_exceptions = []
    for shipment in shipments:
        shipment_id = str(shipment["_id"])
        exceptions = await TrackingService.detect_exceptions(shipment_id)
        for exc in exceptions:
            exc["shipment_id"] = shipment_id
            exc["shipment_number"] = shipment.get("shipment_number")
            all_exceptions.append(exc)

    # Sort by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    all_exceptions.sort(key=lambda x: severity_order.get(x["severity"], 3))

    return {
        "total_exceptions": len(all_exceptions),
        "by_severity": {
            "high": len([e for e in all_exceptions if e["severity"] == "high"]),
            "medium": len([e for e in all_exceptions if e["severity"] == "medium"]),
            "low": len([e for e in all_exceptions if e["severity"] == "low"]),
        },
        "exceptions": all_exceptions,
    }


# ============================================================================
# Tracking Timeline
# ============================================================================

class TimelineEvent(BaseModel):
    timestamp: Optional[datetime] = None
    event_type: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_exception: bool = False
    icon: str


class Milestone(BaseModel):
    status: str
    label: str
    completed: bool


class TrackingTimeline(BaseModel):
    shipment_number: str
    status: str
    milestones: List[Milestone]
    timeline: List[TimelineEvent]
    current_location: Optional[str] = None
    eta: Optional[datetime] = None
    pod_captured: bool


@router.get("/timeline/{shipment_id}", response_model=TrackingTimeline)
async def get_tracking_timeline(shipment_id: str):
    """Get comprehensive tracking timeline for a shipment."""
    try:
        result = await TrackingService.get_tracking_timeline(shipment_id)
        return TrackingTimeline(
            shipment_number=result["shipment_number"],
            status=result["status"],
            milestones=[Milestone(**m) for m in result["milestones"]],
            timeline=[TimelineEvent(**t) for t in result["timeline"]],
            current_location=result.get("current_location"),
            eta=result.get("eta"),
            pod_captured=result.get("pod_captured", False),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
