import logging
import secrets
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.tracking import TrackingEvent, TrackingEventType
from app.models.geofence import Geofence, GeofenceType, GeofenceTrigger, TrackingLink, PODCapture
from app.services.tracking_service import TrackingService

logger = logging.getLogger(__name__)

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

    # Auto-generate invoice from POD (Feature: e07899c0)
    try:
        from app.services.invoice_automation_service import InvoiceAutomationService
        await InvoiceAutomationService.trigger_invoice_from_pod(shipment_id)
    except Exception as e:
        # Log but don't fail POD capture if invoice generation fails
        logger.warning(f"Auto-invoice from POD failed for shipment {shipment_id}: {e}")

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


# ============================================================================
# Driver Location Update (GPS from driver's device)
# ============================================================================

class DriverLocationUpdateRequest(BaseModel):
    """GPS location update from a driver's device or tracking link."""
    shipment_id: str
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    heading: Optional[float] = None
    speed_mph: Optional[float] = None
    source: str = "driver_app"


class DriverLocationUpdateResponse(BaseModel):
    tracking_event_id: str
    location: Optional[str] = None
    latitude: float
    longitude: float
    eta: Optional[datetime] = None
    distance_remaining_miles: Optional[float] = None
    triggered_geofences: List[dict] = []


@router.post("/location-update", response_model=DriverLocationUpdateResponse)
async def driver_location_update(data: DriverLocationUpdateRequest):
    """Receive GPS update from a driver's device. Updates shipment location,
    calculates ETA to delivery, and checks geofences."""
    db = get_database()
    shipment_oid = ObjectId(data.shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Record location in driver_checkins collection for live map
    checkin_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "driver_id": f"driver_{data.shipment_id}",
        "latitude": data.latitude,
        "longitude": data.longitude,
        "city": data.city,
        "state": data.state,
        "heading": data.heading,
        "speed_mph": data.speed_mph,
        "source": data.source,
        "created_at": datetime.utcnow(),
    }
    await db.driver_checkins.insert_one(checkin_doc)

    # Use TrackingService to update shipment location and check geofences
    result = await TrackingService.update_shipment_location(
        shipment_id=data.shipment_id,
        latitude=data.latitude,
        longitude=data.longitude,
        city=data.city,
        state=data.state,
        source=data.source,
    )

    # Calculate ETA to delivery stop
    eta = None
    distance_remaining = None
    stops = shipment.get("stops", [])
    delivery_stop = next(
        (s for s in stops if s.get("stop_type") == "delivery"),
        None,
    )
    if delivery_stop and delivery_stop.get("latitude") and delivery_stop.get("longitude"):
        eta_dt, dist = TrackingService.calculate_eta(
            data.latitude, data.longitude,
            delivery_stop["latitude"], delivery_stop["longitude"],
        )
        eta = eta_dt
        distance_remaining = round(dist, 1)

        # Update ETA on shipment
        await db.shipments.update_one(
            {"_id": shipment_oid},
            {"$set": {"eta": eta, "updated_at": datetime.utcnow()}}
        )

    location_str = f"{data.city}, {data.state}" if data.city and data.state else None

    return DriverLocationUpdateResponse(
        tracking_event_id=result["tracking_event_id"],
        location=location_str,
        latitude=data.latitude,
        longitude=data.longitude,
        eta=eta,
        distance_remaining_miles=distance_remaining,
        triggered_geofences=result.get("triggered_geofences", []),
    )


class LiveMapResponse(BaseModel):
    """Response for live map with all in-transit shipment locations."""
    total_active: int
    in_transit_count: int
    pending_pickup_count: int
    locations: List[DriverLocationResponse]


@router.get("/live-map", response_model=LiveMapResponse)
async def get_live_map():
    """Get all in-transit shipment locations with ETA info for the live map.
    Aggregates data from driver checkins and tracking events."""
    db = get_database()

    # Get driver locations (reuses existing logic)
    locations = await get_driver_locations()

    in_transit = len([d for d in locations if d.shipment_status == "in_transit"])
    pending = len([d for d in locations if d.shipment_status == "pending_pickup"])

    return LiveMapResponse(
        total_active=len(locations),
        in_transit_count=in_transit,
        pending_pickup_count=pending,
        locations=locations,
    )


class RequestLocationRequest(BaseModel):
    """Request to send a tracking/location-sharing link to a driver."""
    driver_phone: Optional[str] = None
    driver_email: Optional[str] = None
    message: Optional[str] = None


class RequestLocationResponse(BaseModel):
    tracking_link_token: str
    tracking_url: str
    sent_to: Optional[str] = None
    message: str


@router.post("/request-location/{shipment_id}", response_model=RequestLocationResponse)
async def request_driver_location(shipment_id: str, data: RequestLocationRequest):
    """Generate and send a location-sharing link to the driver for a shipment.
    The driver can use this link to share their GPS location in real-time."""
    db = get_database()
    shipment_oid = ObjectId(shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Create a tracking link specifically for driver location sharing
    import secrets
    token = secrets.token_urlsafe(32)

    link_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "token": token,
        "link_type": "driver_location",
        "driver_phone": data.driver_phone,
        "driver_email": data.driver_email,
        "is_active": True,
        "expires_at": datetime.utcnow() + timedelta(days=7),
        "view_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.tracking_links.insert_one(link_doc)

    tracking_url = f"/driver-track/{token}"
    sent_to = data.driver_phone or data.driver_email or "link generated"

    # Log the request as a tracking event
    event = TrackingEvent(
        shipment_id=shipment_oid,
        event_type=TrackingEventType.NOTE,
        event_timestamp=datetime.utcnow(),
        reported_at=datetime.utcnow(),
        description=f"Location sharing link sent to {sent_to}",
        source="system",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    return RequestLocationResponse(
        tracking_link_token=token,
        tracking_url=tracking_url,
        sent_to=sent_to,
        message=f"Location sharing link generated for shipment {shipment.get('shipment_number', shipment_id)}",
    )


@router.get("/geofence-analytics")
async def get_geofence_analytics(days: int = 30):
    """Get geofence analytics: event counts, dwell time, recent events."""
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
# Mobile POD Capture Link (Feature: 01f966a4 - Proof of Delivery Capture)
# No-install mobile POD via shareable web link with signature pad and photo capture
# ============================================================================

class MobilePODLinkCreate(BaseModel):
    """Create a mobile POD capture link for a shipment."""
    shipment_id: str
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_email: Optional[str] = None
    expires_in_hours: int = 72


class MobilePODLinkResponse(BaseModel):
    id: str
    shipment_id: str
    token: str
    pod_capture_url: str
    driver_name: Optional[str] = None
    expires_at: datetime
    is_active: bool
    created_at: datetime


class MobilePODLinkInfo(BaseModel):
    """Info returned when driver opens the POD link (no auth)."""
    shipment_number: str
    status: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    commodity: Optional[str] = None
    weight_lbs: Optional[float] = None
    piece_count: Optional[int] = None
    customer_name: Optional[str] = None
    driver_name: Optional[str] = None
    special_instructions: Optional[str] = None
    already_captured: bool = False


class MobilePODSubmission(BaseModel):
    """POD submission from mobile web link."""
    signature_data: Optional[str] = None  # Base64 PNG from canvas signature pad
    signer_name: Optional[str] = None
    signer_title: Optional[str] = None
    photos: Optional[List[dict]] = None  # [{url, category, caption}]
    received_by: Optional[str] = None
    delivery_notes: Optional[str] = None
    damage_reported: bool = False
    damage_description: Optional[str] = None
    pieces_delivered: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy_meters: Optional[float] = None
    captured_at_device: Optional[str] = None  # ISO timestamp from device


class MobilePODSubmissionResponse(BaseModel):
    pod_id: str
    shipment_id: str
    status: str
    message: str
    has_signature: bool
    photo_count: int
    captured_at: datetime


@router.post("/pod-link", response_model=MobilePODLinkResponse)
async def create_mobile_pod_link(data: MobilePODLinkCreate):
    """Create a shareable link for mobile POD capture. Drivers can open this in any
    mobile browser to capture signature, photos, and delivery details without installing an app."""
    db = get_database()
    shipment_oid = ObjectId(data.shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=data.expires_in_hours)

    link_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "token": token,
        "link_type": "pod_capture",
        "driver_name": data.driver_name,
        "driver_phone": data.driver_phone,
        "driver_email": data.driver_email,
        "is_active": True,
        "expires_at": expires_at,
        "view_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.tracking_links.insert_one(link_doc)

    # Log as tracking event
    event = TrackingEvent(
        shipment_id=shipment_oid,
        event_type=TrackingEventType.NOTE,
        event_timestamp=datetime.utcnow(),
        reported_at=datetime.utcnow(),
        description=f"Mobile POD capture link created for {data.driver_name or 'driver'}",
        source="system",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    return MobilePODLinkResponse(
        id=str(link_doc["_id"]),
        shipment_id=data.shipment_id,
        token=token,
        pod_capture_url=f"/pod-capture/{token}",
        driver_name=data.driver_name,
        expires_at=expires_at,
        is_active=True,
        created_at=link_doc["created_at"],
    )


@router.get("/pod-link/{token}/info", response_model=MobilePODLinkInfo)
async def get_pod_link_info(token: str):
    """Get shipment info for a mobile POD capture link (no auth required).
    This is what the driver sees when opening the link."""
    db = get_database()

    link = await db.tracking_links.find_one({
        "token": token,
        "link_type": "pod_capture",
        "is_active": True,
    })
    if not link:
        raise HTTPException(status_code=404, detail="POD link not found or expired")

    if link.get("expires_at") and link["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="POD link has expired")

    # Increment view count
    await db.tracking_links.update_one(
        {"_id": link["_id"]},
        {"$inc": {"view_count": 1}, "$set": {"last_viewed_at": datetime.utcnow()}}
    )

    shipment = await db.shipments.find_one({"_id": link["shipment_id"]})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    stops = shipment.get("stops", [])
    pickup = next((s for s in stops if s.get("stop_type") == "pickup"), {})
    delivery = next((s for s in stops if s.get("stop_type") == "delivery"), {})

    # Check if POD already captured
    existing_pod = await db.pod_captures.find_one({"shipment_id": link["shipment_id"]})

    # Get customer name
    customer_name = None
    if shipment.get("customer_id"):
        customer = await db.customers.find_one({"_id": shipment["customer_id"]})
        if customer:
            customer_name = customer.get("name")

    return MobilePODLinkInfo(
        shipment_number=shipment.get("shipment_number", ""),
        status=shipment.get("status", "unknown"),
        origin=f"{pickup.get('city', '')}, {pickup.get('state', '')}".strip(", ") or None,
        destination=f"{delivery.get('city', '')}, {delivery.get('state', '')}".strip(", ") or None,
        pickup_date=str(shipment.get("pickup_date", "")) if shipment.get("pickup_date") else None,
        delivery_date=str(shipment.get("delivery_date", "")) if shipment.get("delivery_date") else None,
        commodity=shipment.get("commodity"),
        weight_lbs=shipment.get("weight_lbs"),
        piece_count=shipment.get("piece_count"),
        customer_name=customer_name,
        driver_name=link.get("driver_name"),
        special_instructions=shipment.get("special_requirements"),
        already_captured=existing_pod is not None,
    )


@router.post("/pod-link/{token}/submit", response_model=MobilePODSubmissionResponse)
async def submit_mobile_pod(token: str, data: MobilePODSubmission):
    """Submit POD via mobile web link (no auth required). Accepts signature,
    photos, delivery notes, and GPS data from the driver's mobile browser."""
    db = get_database()

    link = await db.tracking_links.find_one({
        "token": token,
        "link_type": "pod_capture",
        "is_active": True,
    })
    if not link:
        raise HTTPException(status_code=404, detail="POD link not found or expired")

    if link.get("expires_at") and link["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="POD link has expired")

    shipment_oid = link["shipment_id"]
    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Determine capture type
    capture_type = "signature"
    if data.signature_data and data.photos:
        capture_type = "both"
    elif data.photos:
        capture_type = "photo"

    photo_urls = []
    photo_data = []
    if data.photos:
        for p in data.photos:
            photo_urls.append(p.get("url", ""))
            photo_data.append({
                "url": p.get("url", ""),
                "category": p.get("category", "delivery"),
                "caption": p.get("caption"),
                "gps_latitude": data.latitude,
                "gps_longitude": data.longitude,
                "timestamp": data.captured_at_device or datetime.utcnow().isoformat(),
            })

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
        "delivery_notes": data.delivery_notes,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "gps_accuracy_meters": data.gps_accuracy_meters,
        "damage_reported": data.damage_reported,
        "damage_description": data.damage_description,
        "pieces_delivered": data.pieces_delivered,
        "pieces_expected": shipment.get("piece_count"),
        "captured_at": datetime.utcnow(),
        "captured_via": "mobile_pod_link",
        "pod_link_token": token,
        "is_verified": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await db.pod_captures.insert_one(pod_doc)

    # Create tracking event
    event = TrackingEvent(
        shipment_id=shipment_oid,
        event_type=TrackingEventType.POD_RECEIVED,
        event_timestamp=datetime.utcnow(),
        reported_at=datetime.utcnow(),
        latitude=data.latitude,
        longitude=data.longitude,
        description=f"POD captured via mobile link. Signed by: {data.signer_name or data.received_by or 'Unknown'}. Photos: {len(photo_urls)}",
        source="mobile_pod_link",
    )
    await db.tracking_events.insert_one(event.model_dump_mongo())

    # Update shipment status to delivered if not already
    if shipment.get("status") != "delivered":
        await db.shipments.update_one(
            {"_id": shipment_oid},
            {"$set": {
                "status": "delivered",
                "actual_delivery_date": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }}
        )

    # Deactivate the POD link after use
    await db.tracking_links.update_one(
        {"_id": link["_id"]},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )

    # Notify customer
    if shipment.get("customer_id"):
        await db.portal_notifications.insert_one({
            "_id": ObjectId(),
            "portal_type": "customer",
            "entity_id": shipment["customer_id"],
            "title": "Delivery Confirmed",
            "message": f"Shipment {shipment.get('shipment_number')} has been delivered. POD is available.",
            "notification_type": "shipment",
            "shipment_id": shipment_oid,
            "is_read": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })

    # Auto-generate invoice from POD
    try:
        from app.services.invoice_automation_service import InvoiceAutomationService
        await InvoiceAutomationService.trigger_invoice_from_pod(str(shipment_oid))
    except Exception as e:
        logger.warning(f"Auto-invoice from mobile POD failed for shipment {shipment_oid}: {e}")

    return MobilePODSubmissionResponse(
        pod_id=str(pod_doc["_id"]),
        shipment_id=str(shipment_oid),
        status="captured",
        message="Proof of delivery captured successfully",
        has_signature=bool(data.signature_data),
        photo_count=len(photo_urls),
        captured_at=pod_doc["captured_at"],
    )


# ============================================================================
# Auto-Create Geofences from Shipment Stops (Feature: fb2a56eb - Geofence Alerts)
# Automatically creates pickup and delivery geofences for a shipment
# ============================================================================

class AutoGeofenceRequest(BaseModel):
    """Request to auto-create geofences from shipment stops."""
    radius_meters: int = 500
    alert_dispatcher: bool = True
    alert_customer: bool = False
    auto_update_status: bool = True


class AutoGeofenceResponse(BaseModel):
    shipment_id: str
    geofences_created: int
    geofences: List[GeofenceResponse]


@router.post("/geofences/auto-create/{shipment_id}", response_model=AutoGeofenceResponse)
async def auto_create_geofences(shipment_id: str, data: AutoGeofenceRequest):
    """Automatically create geofences for all stops in a shipment.
    Pickup stops get ENTER triggers, delivery stops get ENTER triggers,
    and auto_update_status will auto-transition shipment status on geofence triggers."""
    db = get_database()
    shipment_oid = ObjectId(shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    stops = shipment.get("stops", [])
    if not stops:
        raise HTTPException(status_code=400, detail="Shipment has no stops")

    # Remove existing auto-created geofences for this shipment
    await db.geofences.delete_many({
        "shipment_id": shipment_oid,
        "geofence_type": {"$in": ["pickup", "delivery"]},
    })

    created_geofences = []
    for stop in stops:
        lat = stop.get("latitude")
        lng = stop.get("longitude")
        if not lat or not lng:
            continue

        stop_type = stop.get("stop_type", "stop")
        gf_type = GeofenceType.PICKUP if stop_type == "pickup" else GeofenceType.DELIVERY
        trigger = GeofenceTrigger.ENTER if stop_type in ("pickup", "delivery") else GeofenceTrigger.BOTH

        gf_name = f"{stop_type.capitalize()} - {stop.get('city', '')}, {stop.get('state', '')}"
        gf = Geofence(
            name=gf_name,
            geofence_type=gf_type,
            latitude=lat,
            longitude=lng,
            radius_meters=data.radius_meters,
            trigger=trigger,
            shipment_id=shipment_oid,
            facility_id=ObjectId(stop["facility_id"]) if stop.get("facility_id") else None,
            customer_id=shipment.get("customer_id"),
            address=stop.get("address"),
            city=stop.get("city"),
            state=stop.get("state"),
            zip_code=stop.get("zip_code"),
            alert_push=data.alert_dispatcher,
        )
        await db.geofences.insert_one(gf.model_dump_mongo())
        created_geofences.append(geofence_to_response(gf))

    # Store auto-update-status preference on the shipment
    if data.auto_update_status:
        await db.shipments.update_one(
            {"_id": shipment_oid},
            {"$set": {"geofence_auto_status": True, "updated_at": datetime.utcnow()}}
        )

    return AutoGeofenceResponse(
        shipment_id=shipment_id,
        geofences_created=len(created_geofences),
        geofences=created_geofences,
    )


# ============================================================================
# Location Sharing via Token (Feature: f00e8a95 - Automated Tracking Updates)
# Public endpoint for drivers to share GPS location via tracking link
# ============================================================================

class LocationShareUpdate(BaseModel):
    """GPS location update submitted via location-sharing link (no auth)."""
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    heading: Optional[float] = None
    speed_mph: Optional[float] = None
    accuracy_meters: Optional[float] = None


class LocationShareResponse(BaseModel):
    status: str
    shipment_number: Optional[str] = None
    eta: Optional[datetime] = None
    distance_remaining_miles: Optional[float] = None
    message: str


@router.get("/location-share/{token}/info")
async def get_location_share_info(token: str):
    """Get info for a location-sharing link (no auth). Shows the driver
    what shipment they are sharing location for."""
    db = get_database()

    link = await db.tracking_links.find_one({
        "token": token,
        "link_type": "driver_location",
        "is_active": True,
    })
    if not link:
        raise HTTPException(status_code=404, detail="Location sharing link not found or expired")

    if link.get("expires_at") and link["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Location sharing link has expired")

    shipment = await db.shipments.find_one({"_id": link["shipment_id"]})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    stops = shipment.get("stops", [])
    pickup = next((s for s in stops if s.get("stop_type") == "pickup"), {})
    delivery = next((s for s in stops if s.get("stop_type") == "delivery"), {})

    return {
        "shipment_number": shipment.get("shipment_number"),
        "status": shipment.get("status"),
        "origin": f"{pickup.get('city', '')}, {pickup.get('state', '')}".strip(", ") or None,
        "destination": f"{delivery.get('city', '')}, {delivery.get('state', '')}".strip(", ") or None,
        "driver_name": link.get("driver_name"),
        "is_sharing_active": True,
    }


@router.post("/location-share/{token}", response_model=LocationShareResponse)
async def submit_location_share(token: str, data: LocationShareUpdate):
    """Submit a GPS location update via a location-sharing link (no auth required).
    Used by drivers who received a tracking link via SMS/email to share their location."""
    db = get_database()

    link = await db.tracking_links.find_one({
        "token": token,
        "link_type": "driver_location",
        "is_active": True,
    })
    if not link:
        raise HTTPException(status_code=404, detail="Location sharing link not found or expired")

    if link.get("expires_at") and link["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Location sharing link has expired")

    shipment_oid = link["shipment_id"]
    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Record in driver_checkins for live map
    checkin_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "driver_id": f"link_{token[:8]}",
        "latitude": data.latitude,
        "longitude": data.longitude,
        "city": data.city,
        "state": data.state,
        "heading": data.heading,
        "speed_mph": data.speed_mph,
        "accuracy_meters": data.accuracy_meters,
        "source": "location_share_link",
        "created_at": datetime.utcnow(),
    }
    await db.driver_checkins.insert_one(checkin_doc)

    # Use TrackingService for location update + geofence check
    result = await TrackingService.update_shipment_location(
        shipment_id=str(shipment_oid),
        latitude=data.latitude,
        longitude=data.longitude,
        city=data.city,
        state=data.state,
        source="location_share_link",
    )

    # Update link usage
    await db.tracking_links.update_one(
        {"_id": link["_id"]},
        {"$inc": {"view_count": 1}, "$set": {"last_viewed_at": datetime.utcnow()}}
    )

    # Calculate ETA
    eta = None
    distance_remaining = None
    stops = shipment.get("stops", [])
    delivery_stop = next((s for s in stops if s.get("stop_type") == "delivery"), None)
    if delivery_stop and delivery_stop.get("latitude") and delivery_stop.get("longitude"):
        eta, dist = TrackingService.calculate_eta(
            data.latitude, data.longitude,
            delivery_stop["latitude"], delivery_stop["longitude"],
        )
        distance_remaining = round(dist, 1)
        await db.shipments.update_one(
            {"_id": shipment_oid},
            {"$set": {"eta": eta, "updated_at": datetime.utcnow()}}
        )

    return LocationShareResponse(
        status="received",
        shipment_number=shipment.get("shipment_number"),
        eta=eta,
        distance_remaining_miles=distance_remaining,
        message="Location updated successfully",
    )


# ============================================================================
# Photo Capture with GPS/Timestamp Auto-Tagging (Feature: b62dffac)
# Enhanced photo capture endpoint with metadata
# ============================================================================

class PhotoCaptureRequest(BaseModel):
    """Photo capture with automatic GPS and timestamp tagging."""
    shipment_id: str
    photo_url: str
    category: str = "delivery"  # delivery, damage, bol, cargo, seal, other
    caption: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy_meters: Optional[float] = None
    device_timestamp: Optional[str] = None  # ISO timestamp from device


class PhotoCaptureResponse(BaseModel):
    id: str
    shipment_id: str
    photo_url: str
    category: str
    caption: Optional[str] = None
    gps_tagged: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp_tagged: bool
    captured_at: datetime
    device_timestamp: Optional[str] = None


@router.post("/photos/capture", response_model=PhotoCaptureResponse)
async def capture_photo_with_metadata(data: PhotoCaptureRequest):
    """Capture a photo with automatic GPS coordinates and timestamp tagging.
    Photos are categorized and associated with the shipment for POD documentation."""
    db = get_database()
    shipment_oid = ObjectId(data.shipment_id)

    shipment = await db.shipments.find_one({"_id": shipment_oid})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    photo_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_oid,
        "photo_url": data.photo_url,
        "category": data.category,
        "caption": data.caption,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "gps_accuracy_meters": data.gps_accuracy_meters,
        "gps_tagged": data.latitude is not None and data.longitude is not None,
        "device_timestamp": data.device_timestamp,
        "timestamp_tagged": True,
        "captured_at": datetime.utcnow(),
        "created_at": datetime.utcnow(),
    }
    await db.shipment_photos.insert_one(photo_doc)

    # Log as tracking event for damage photos
    if data.category == "damage":
        event = TrackingEvent(
            shipment_id=shipment_oid,
            event_type=TrackingEventType.NOTE,
            event_timestamp=datetime.utcnow(),
            reported_at=datetime.utcnow(),
            latitude=data.latitude,
            longitude=data.longitude,
            description=f"Damage photo captured: {data.caption or 'No description'}",
            source="photo_capture",
            is_exception=True,
        )
        await db.tracking_events.insert_one(event.model_dump_mongo())

    return PhotoCaptureResponse(
        id=str(photo_doc["_id"]),
        shipment_id=data.shipment_id,
        photo_url=data.photo_url,
        category=data.category,
        caption=data.caption,
        gps_tagged=photo_doc["gps_tagged"],
        latitude=data.latitude,
        longitude=data.longitude,
        timestamp_tagged=True,
        captured_at=photo_doc["captured_at"],
        device_timestamp=data.device_timestamp,
    )


@router.get("/photos/{shipment_id}", response_model=List[PhotoCaptureResponse])
async def get_shipment_photos_tagged(shipment_id: str, category: Optional[str] = None):
    """Get all GPS/timestamp-tagged photos for a shipment, optionally filtered by category."""
    db = get_database()
    query: dict = {"shipment_id": ObjectId(shipment_id)}
    if category:
        query["category"] = category

    photos = await db.shipment_photos.find(query).sort("captured_at", -1).to_list(100)
    return [
        PhotoCaptureResponse(
            id=str(p["_id"]),
            shipment_id=shipment_id,
            photo_url=p.get("photo_url", ""),
            category=p.get("category", "other"),
            caption=p.get("caption"),
            gps_tagged=p.get("gps_tagged", False),
            latitude=p.get("latitude"),
            longitude=p.get("longitude"),
            timestamp_tagged=p.get("timestamp_tagged", False),
            captured_at=p.get("captured_at", datetime.utcnow()),
            device_timestamp=p.get("device_timestamp"),
        )
        for p in photos
    ]


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
