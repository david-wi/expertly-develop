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


# ============================================================================
# Enhanced POD Capture (with photos, GPS, annotations)
# ============================================================================

class EnhancedPODPhoto(BaseModel):
    url: str
    category: str = "delivery"  # delivery, damage, bol, other
    annotation: Optional[str] = None
    caption: Optional[str] = None


class EnhancedPODCaptureRequest(BaseModel):
    signature_data: Optional[str] = None
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None
    photos: Optional[List[EnhancedPODPhoto]] = None
    received_by: Optional[str] = None
    recipient_name: Optional[str] = None
    delivery_notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy_meters: Optional[float] = None
    damage_reported: bool = False
    damage_description: Optional[str] = None
    pieces_delivered: Optional[int] = None
    pieces_expected: Optional[int] = None


class EnhancedPODResponse(BaseModel):
    id: str
    shipment_id: str
    capture_type: str
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None
    received_by: Optional[str] = None
    recipient_name: Optional[str] = None
    delivery_notes: Optional[str] = None
    photo_count: int
    photos: Optional[List[dict]] = None
    captured_at: datetime
    is_verified: bool
    has_signature: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    damage_reported: bool = False
    damage_description: Optional[str] = None
    pieces_delivered: Optional[int] = None
    pieces_expected: Optional[int] = None
    pdf_available: bool = False


@router.post("/pod-capture/{shipment_id}/enhanced", response_model=EnhancedPODResponse)
async def capture_enhanced_pod(shipment_id: str, data: EnhancedPODCaptureRequest):
    """Enhanced POD capture with photos, signature, GPS, damage reporting."""
    db = get_database()
    shipment_oid = ObjectId(shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    capture_type = "signature"
    if data.signature_data and data.photos:
        capture_type = "both"
    elif data.photos:
        capture_type = "photo"

    photo_data = []
    photo_urls = []
    if data.photos:
        for p in data.photos:
            photo_data.append({"url": p.url, "category": p.category, "annotation": p.annotation, "caption": p.caption})
            photo_urls.append(p.url)

    pod_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "capture_type": capture_type,
        "signature_data": data.signature_data,
        "signer_name": data.signer_name,
        "signer_title": data.signer_title,
        "photo_urls": photo_urls,
        "photo_data": photo_data,
        "photo_count": len(photo_urls),
        "received_by": data.received_by,
        "recipient_name": data.recipient_name,
        "delivery_notes": data.delivery_notes,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "gps_accuracy_meters": data.gps_accuracy_meters,
        "damage_reported": data.damage_reported,
        "damage_description": data.damage_description,
        "pieces_delivered": data.pieces_delivered,
        "pieces_expected": data.pieces_expected,
        "captured_at": datetime.utcnow(),
        "is_verified": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    await db.pod_captures.insert_one(pod_doc)

    event = TrackingEvent(
        shipment_id=shipment_oid, event_type=TrackingEventType.POD_RECEIVED,
        event_timestamp=datetime.utcnow(), reported_at=datetime.utcnow(),
        latitude=data.latitude, longitude=data.longitude,
        description=f"Enhanced POD captured. Received by: {data.received_by or data.recipient_name or 'Unknown'}. Photos: {len(photo_urls)}",
        source="enhanced_pod_capture",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    if shipment.get("status") != "delivered":
        await db.shipments.update_one(
            {"_id": shipment_oid},
            {"$set": {"status": "delivered", "actual_delivery_date": datetime.utcnow(), "updated_at": datetime.utcnow()}}
        )

    if shipment.get("customer_id"):
        await db.portal_notifications.insert_one({
            "_id": ObjectId(), "portal_type": "customer", "entity_id": shipment["customer_id"],
            "title": "Delivery Confirmed",
            "message": f"Shipment {shipment.get('shipment_number')} has been delivered. POD is available.",
            "notification_type": "shipment", "shipment_id": shipment_oid,
            "is_read": False, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow(),
        })

    return EnhancedPODResponse(
        id=str(pod_doc["_id"]), shipment_id=shipment_id, capture_type=capture_type,
        signer_name=data.signer_name, signer_title=data.signer_title,
        received_by=data.received_by, recipient_name=data.recipient_name,
        delivery_notes=data.delivery_notes, photo_count=len(photo_urls), photos=photo_data,
        captured_at=pod_doc["captured_at"], is_verified=False, has_signature=bool(data.signature_data),
        latitude=data.latitude, longitude=data.longitude, damage_reported=data.damage_reported,
        damage_description=data.damage_description, pieces_delivered=data.pieces_delivered,
        pieces_expected=data.pieces_expected, pdf_available=False,
    )


@router.get("/pod/{shipment_id}/pdf")
async def get_pod_pdf(shipment_id: str):
    """Generate POD PDF data for a shipment."""
    db = get_database()
    shipment_oid = ObjectId(shipment_id)

    pod_doc = await db.pod_captures.find_one({"shipment_id": shipment_oid})
    if not pod_doc:
        raise HTTPException(status_code=404, detail="POD not found")

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    stops = shipment.get("stops", [])
    origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
    dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

    return {
        "status": "generated",
        "shipment_id": shipment_id,
        "pod_data": {
            "shipment_number": shipment.get("shipment_number"),
            "origin": f"{origin.get('city', '')}, {origin.get('state', '')}",
            "destination": f"{dest.get('city', '')}, {dest.get('state', '')}",
            "pickup_date": str(shipment.get("pickup_date", "")),
            "delivery_date": str(pod_doc.get("captured_at", "")),
            "received_by": pod_doc.get("received_by") or pod_doc.get("recipient_name"),
            "signer_name": pod_doc.get("signer_name"),
            "delivery_notes": pod_doc.get("delivery_notes"),
            "photo_count": pod_doc.get("photo_count", 0),
            "has_signature": bool(pod_doc.get("signature_data")),
            "damage_reported": pod_doc.get("damage_reported", False),
            "damage_description": pod_doc.get("damage_description"),
            "pieces_delivered": pod_doc.get("pieces_delivered"),
            "commodity": shipment.get("commodity"),
            "weight_lbs": shipment.get("weight_lbs"),
        },
    }


# ============================================================================
# Geofence Enhancements (Dwell Time & Analytics)
# ============================================================================

class GeofenceDwellTimeResponse(BaseModel):
    geofence_id: str
    geofence_name: str
    shipment_id: str
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    dwell_minutes: Optional[float] = None
    is_currently_inside: bool = False


@router.get("/geofences/{geofence_id}/dwell-time", response_model=List[GeofenceDwellTimeResponse])
async def get_geofence_dwell_time(geofence_id: str, shipment_id: Optional[str] = None):
    """Get dwell time data for a geofence."""
    db = get_database()
    gf_oid = ObjectId(geofence_id)

    gf_doc = await db.geofences.find_one({"_id": gf_oid})
    if not gf_doc:
        raise HTTPException(status_code=404, detail="Geofence not found")

    query = {"geofence_id": gf_oid}
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)

    events = await db.geofence_events.find(query).sort("event_timestamp", 1).to_list(500)

    shipment_events: dict = {}
    for e in events:
        sid = str(e["shipment_id"])
        if sid not in shipment_events:
            shipment_events[sid] = []
        shipment_events[sid].append(e)

    results = []
    for sid, evts in shipment_events.items():
        arrival = None
        departure = None
        for evt in evts:
            if evt.get("event_type") == "enter":
                arrival = evt.get("event_timestamp")
            elif evt.get("event_type") == "exit":
                departure = evt.get("event_timestamp")

        dwell = None
        if arrival and departure:
            dwell = (departure - arrival).total_seconds() / 60.0

        results.append(GeofenceDwellTimeResponse(
            geofence_id=geofence_id, geofence_name=gf_doc.get("name", ""),
            shipment_id=sid, arrival_time=arrival, departure_time=departure,
            dwell_minutes=dwell, is_currently_inside=arrival is not None and departure is None,
        ))

    return results


@router.get("/geofence-analytics")
async def get_geofence_analytics(days: int = 30):
    """Get geofence analytics: event counts, dwell time, recent events."""
    from datetime import timedelta
    db = get_database()
    cutoff = datetime.utcnow() - timedelta(days=days)

    total_events = await db.geofence_events.count_documents({"event_timestamp": {"$gte": cutoff}})

    type_pipeline = [
        {"$match": {"event_timestamp": {"$gte": cutoff}}},
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
    ]
    type_results = await db.geofence_events.aggregate(type_pipeline).to_list(10)
    events_by_type = {r["_id"]: r["count"] for r in type_results}

    gf_pipeline = [
        {"$match": {"event_timestamp": {"$gte": cutoff}}},
        {"$group": {"_id": "$geofence_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 20},
    ]
    gf_results = await db.geofence_events.aggregate(gf_pipeline).to_list(20)

    events_by_geofence = []
    for r in gf_results:
        gf = await db.geofences.find_one({"_id": r["_id"]})
        events_by_geofence.append({
            "geofence_id": str(r["_id"]),
            "geofence_name": gf.get("name") if gf else "Unknown",
            "event_count": r["count"],
        })

    recent = await db.geofence_events.find(
        {"event_timestamp": {"$gte": cutoff}}
    ).sort("event_timestamp", -1).limit(20).to_list(20)
    recent_events = []
    for r in recent:
        gf = await db.geofences.find_one({"_id": r.get("geofence_id")})
        recent_events.append({
            "event_id": str(r["_id"]), "geofence_name": gf.get("name") if gf else "Unknown",
            "event_type": r.get("event_type"), "shipment_id": str(r.get("shipment_id")),
            "timestamp": r.get("event_timestamp"),
        })

    total_geofences = await db.geofences.count_documents({"is_active": True})

    return {
        "total_events": total_events, "total_geofences": total_geofences,
        "avg_dwell_minutes": None, "events_by_type": events_by_type,
        "events_by_geofence": events_by_geofence, "recent_events": recent_events,
    }


@router.patch("/geofences/{geofence_id}/alerts")
async def update_geofence_alerts(geofence_id: str, data: dict):
    """Update alert configuration for a geofence."""
    db = get_database()
    gf_doc = await db.geofences.find_one({"_id": ObjectId(geofence_id)})
    if not gf_doc:
        raise HTTPException(status_code=404, detail="Geofence not found")

    allowed = {"alert_dispatcher", "alert_customer", "alert_carrier", "alert_emails", "alert_sms_numbers", "auto_update_status"}
    update = {k: v for k, v in data.items() if k in allowed}
    update["updated_at"] = datetime.utcnow()
    await db.geofences.update_one({"_id": ObjectId(geofence_id)}, {"$set": update})
    return {"status": "updated", "geofence_id": geofence_id}


# ============================================================================
# Automated Tracking Updates
# ============================================================================

class AutoTrackingRequest(BaseModel):
    shipment_id: str
    gps_points: List[dict]


class AutoTrackingResponse(BaseModel):
    shipment_id: str
    events_generated: int
    detected_states: List[str]
    current_state: Optional[str] = None
    next_check_call_at: Optional[datetime] = None
    eta: Optional[datetime] = None
    distance_remaining_miles: Optional[float] = None


@router.post("/auto-update", response_model=AutoTrackingResponse)
async def automated_tracking_update(data: AutoTrackingRequest):
    """Auto-generate tracking events from GPS data. Detects state transitions."""
    from datetime import timedelta
    db = get_database()
    shipment_oid = ObjectId(data.shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    events_generated = 0
    detected_states = []
    current_state = shipment.get("status")
    stops = shipment.get("stops", [])
    pickup_stop = next((s for s in stops if s.get("stop_type") == "pickup"), None)
    delivery_stop = next((s for s in stops if s.get("stop_type") == "delivery"), None)

    for point in data.gps_points:
        lat = point.get("latitude")
        lon = point.get("longitude")
        ts = point.get("timestamp")
        speed = point.get("speed_mph", 0)
        if not lat or not lon:
            continue

        timestamp = datetime.fromisoformat(ts) if isinstance(ts, str) else datetime.utcnow()
        proximity = 0.008

        near_pickup = (pickup_stop and pickup_stop.get("latitude") and
                       abs(lat - pickup_stop["latitude"]) < proximity and abs(lon - pickup_stop["longitude"]) < proximity)
        near_delivery = (delivery_stop and delivery_stop.get("latitude") and
                         abs(lat - delivery_stop["latitude"]) < proximity and abs(lon - delivery_stop["longitude"]) < proximity)

        new_event_type = None
        new_status = None

        if near_pickup and speed < 5 and current_state in ["booked", "pending_pickup"]:
            new_event_type = TrackingEventType.ARRIVED_AT_PICKUP
            new_status = "pending_pickup"
            detected_states.append("arrived_at_pickup")
        elif not near_pickup and current_state == "pending_pickup" and speed > 10:
            new_event_type = TrackingEventType.DEPARTED_PICKUP
            new_status = "in_transit"
            detected_states.append("departed_pickup")
        elif near_delivery and speed < 5 and current_state == "in_transit":
            new_event_type = TrackingEventType.ARRIVED_AT_DELIVERY
            new_status = "out_for_delivery"
            detected_states.append("arrived_at_delivery")
        elif speed > 10 and current_state == "in_transit":
            last_event = await db.tracking_events.find_one(
                {"shipment_id": shipment_oid, "source": "auto_gps"}, sort=[("event_timestamp", -1)]
            )
            if not last_event or (timestamp - last_event["event_timestamp"]).total_seconds() > 7200:
                new_event_type = TrackingEventType.CHECK_CALL
                detected_states.append("in_transit")

        if new_event_type:
            event = TrackingEvent(
                shipment_id=shipment_oid, event_type=new_event_type,
                event_timestamp=timestamp, reported_at=datetime.utcnow(),
                latitude=lat, longitude=lon,
                description=f"Auto-detected: {new_event_type.value}", source="auto_gps",
            )
            await db.tracking_events.insert_one(event.model_dump_mongo())
            events_generated += 1

            if new_status and new_status != current_state:
                await db.shipments.update_one(
                    {"_id": shipment_oid},
                    {"$set": {"status": new_status, "last_check_call": datetime.utcnow(), "updated_at": datetime.utcnow()}}
                )
                current_state = new_status

    eta = None
    distance_remaining = None
    if data.gps_points and delivery_stop and delivery_stop.get("latitude"):
        last_point = data.gps_points[-1]
        if last_point.get("latitude") and last_point.get("longitude"):
            eta, distance_remaining = TrackingService.calculate_eta(
                last_point["latitude"], last_point["longitude"],
                delivery_stop["latitude"], delivery_stop["longitude"],
            )

    next_check = None
    if distance_remaining:
        hours = 4 if distance_remaining > 200 else (2 if distance_remaining > 50 else 1)
        next_check = datetime.utcnow() + timedelta(hours=hours)

    return AutoTrackingResponse(
        shipment_id=data.shipment_id, events_generated=events_generated,
        detected_states=detected_states, current_state=current_state,
        next_check_call_at=next_check, eta=eta, distance_remaining_miles=distance_remaining,
    )


# ============================================================================
# Real-Time Driver Locations (Feature #6)
# ============================================================================

class DriverLocationResponse(BaseModel):
    driver_id: str
    driver_name: str
    carrier_id: Optional[str] = None
    carrier_name: Optional[str] = None
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    heading: Optional[float] = None
    speed_mph: Optional[float] = None
    last_updated: datetime
    current_shipment_id: Optional[str] = None
    current_shipment_number: Optional[str] = None
    shipment_status: Optional[str] = None
    eta: Optional[datetime] = None
    origin: Optional[str] = None
    destination: Optional[str] = None


@router.get("/driver-locations", response_model=List[DriverLocationResponse])
async def get_driver_locations():
    """Get real-time locations for all active drivers with current load info."""
    db = get_database()

    # Get driver checkins from the last 24 hours (recent GPS updates)
    cutoff = datetime.utcnow() - timedelta(hours=24)

    # Aggregate latest position per driver
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}, "latitude": {"$exists": True, "$ne": None}}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$driver_id",
            "latitude": {"$first": "$latitude"},
            "longitude": {"$first": "$longitude"},
            "city": {"$first": "$city"},
            "state": {"$first": "$state"},
            "heading": {"$first": "$heading"},
            "speed_mph": {"$first": "$speed_mph"},
            "last_updated": {"$first": "$created_at"},
            "shipment_id": {"$first": "$shipment_id"},
        }},
    ]

    checkins = await db.driver_checkins.aggregate(pipeline).to_list(500)

    # Also check tracking events with GPS data
    tracking_pipeline = [
        {"$match": {
            "reported_at": {"$gte": cutoff},
            "latitude": {"$exists": True, "$ne": None},
            "source": {"$in": ["gps", "driver_app", "auto_gps"]},
        }},
        {"$sort": {"reported_at": -1}},
        {"$group": {
            "_id": "$shipment_id",
            "latitude": {"$first": "$latitude"},
            "longitude": {"$first": "$longitude"},
            "location_city": {"$first": "$location_city"},
            "location_state": {"$first": "$location_state"},
            "last_updated": {"$first": "$reported_at"},
        }},
    ]

    tracking_positions = await db.tracking_events.aggregate(tracking_pipeline).to_list(500)

    results = []

    # Process driver checkins
    seen_shipments = set()
    for checkin in checkins:
        driver_id = checkin["_id"]
        driver = await db.drivers.find_one({"_id": driver_id})
        if not driver:
            continue

        driver_name = driver.get("name", "Unknown Driver")
        carrier_id = driver.get("carrier_id")
        carrier_name = None
        if carrier_id:
            carrier = await db.carriers.find_one({"_id": carrier_id})
            if carrier:
                carrier_name = carrier.get("name")

        shipment_info = {}
        shipment_id = checkin.get("shipment_id")
        if shipment_id:
            seen_shipments.add(str(shipment_id))
            shipment = await db.shipments.find_one({"_id": shipment_id})
            if shipment:
                stops = shipment.get("stops", [])
                origin = stops[0] if stops else {}
                dest = stops[-1] if len(stops) > 1 else {}
                shipment_info = {
                    "current_shipment_id": str(shipment["_id"]),
                    "current_shipment_number": shipment.get("shipment_number"),
                    "shipment_status": shipment.get("status"),
                    "eta": shipment.get("eta"),
                    "origin": f"{origin.get('city', '')}, {origin.get('state', '')}",
                    "destination": f"{dest.get('city', '')}, {dest.get('state', '')}",
                }

        results.append(DriverLocationResponse(
            driver_id=str(driver_id),
            driver_name=driver_name,
            carrier_id=str(carrier_id) if carrier_id else None,
            carrier_name=carrier_name,
            latitude=checkin["latitude"],
            longitude=checkin["longitude"],
            city=checkin.get("city"),
            state=checkin.get("state"),
            heading=checkin.get("heading"),
            speed_mph=checkin.get("speed_mph"),
            last_updated=checkin["last_updated"],
            **shipment_info,
        ))

    # Process tracking positions for shipments not covered by driver checkins
    for tp in tracking_positions:
        shipment_id = tp["_id"]
        if str(shipment_id) in seen_shipments:
            continue

        shipment = await db.shipments.find_one({"_id": shipment_id})
        if not shipment or shipment.get("status") not in ("in_transit", "pending_pickup", "out_for_delivery"):
            continue

        stops = shipment.get("stops", [])
        origin = stops[0] if stops else {}
        dest = stops[-1] if len(stops) > 1 else {}

        carrier_name = None
        carrier_id = shipment.get("carrier_id")
        if carrier_id:
            carrier = await db.carriers.find_one({"_id": carrier_id})
            if carrier:
                carrier_name = carrier.get("name")

        results.append(DriverLocationResponse(
            driver_id=f"shipment_{shipment_id}",
            driver_name=f"Driver ({shipment.get('shipment_number', '')})",
            carrier_id=str(carrier_id) if carrier_id else None,
            carrier_name=carrier_name,
            latitude=tp["latitude"],
            longitude=tp["longitude"],
            city=tp.get("location_city"),
            state=tp.get("location_state"),
            last_updated=tp["last_updated"],
            current_shipment_id=str(shipment_id),
            current_shipment_number=shipment.get("shipment_number"),
            shipment_status=shipment.get("status"),
            eta=shipment.get("eta"),
            origin=f"{origin.get('city', '')}, {origin.get('state', '')}",
            destination=f"{dest.get('city', '')}, {dest.get('state', '')}",
        ))

    return results
