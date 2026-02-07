"""Carrier portal API for self-service access to loads and tenders."""
import secrets
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.models.portal import (
    CarrierOnboarding, OnboardingStatus, OnboardingDocumentType,
    CarrierPortalSession, PortalNotification
)
from app.models.tender import TenderStatus

router = APIRouter()


# ============================================================================
# Authentication
# ============================================================================

class CarrierLoginRequest(BaseModel):
    email: str
    carrier_id: Optional[str] = None


class CarrierLoginResponse(BaseModel):
    message: str
    email: str


class CarrierVerifyRequest(BaseModel):
    email: str
    code: str


class CarrierSessionResponse(BaseModel):
    token: str
    carrier_id: str
    carrier_name: str
    expires_at: datetime


async def get_current_carrier(authorization: str = Header(None)):
    """Validate carrier portal session and return carrier."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization[7:]
    db = get_database()

    session = await db.carrier_portal_sessions.find_one({
        "token": token,
        "is_active": True,
        "token_expires_at": {"$gt": utc_now()}
    })

    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    carrier = await db.carriers.find_one({"_id": session["carrier_id"]})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Update last active
    await db.carrier_portal_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"last_active_at": utc_now()}}
    )

    return carrier


@router.post("/auth/request-access")
async def request_carrier_access(data: CarrierLoginRequest):
    """Request access code via email (magic link style)."""
    db = get_database()

    # Find carrier by email
    carrier = await db.carriers.find_one({
        "$or": [
            {"contact_email": data.email},
            {"dispatch_email": data.email},
            {"contacts.email": data.email}
        ]
    })

    if not carrier:
        # Don't reveal if email exists
        return CarrierLoginResponse(
            message="If this email is associated with a carrier, you will receive an access code.",
            email=data.email
        )

    # Generate 6-digit code
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    # Store code (expires in 15 minutes)
    await db.carrier_access_codes.insert_one({
        "carrier_id": carrier["_id"],
        "email": data.email,
        "code": code,
        "expires_at": utc_now() + timedelta(minutes=15),
        "used": False,
        "created_at": utc_now()
    })

    # TODO: Send email with code
    # For now, we'll include it in response for testing
    return CarrierLoginResponse(
        message=f"Access code sent to {data.email}. Code: {code}",  # Remove code in production
        email=data.email
    )


@router.post("/auth/verify", response_model=CarrierSessionResponse)
async def verify_carrier_code(data: CarrierVerifyRequest):
    """Verify access code and create session."""
    db = get_database()

    # Find valid code
    access = await db.carrier_access_codes.find_one({
        "email": data.email,
        "code": data.code,
        "used": False,
        "expires_at": {"$gt": utc_now()}
    })

    if not access:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    # Mark code as used
    await db.carrier_access_codes.update_one(
        {"_id": access["_id"]},
        {"$set": {"used": True}}
    )

    # Get carrier
    carrier = await db.carriers.find_one({"_id": access["carrier_id"]})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Create session
    token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=7)

    session = CarrierPortalSession(
        carrier_id=carrier["_id"],
        email=data.email,
        token=token,
        token_expires_at=expires_at,
    )
    await db.carrier_portal_sessions.insert_one(session.model_dump_mongo())

    return CarrierSessionResponse(
        token=token,
        carrier_id=str(carrier["_id"]),
        carrier_name=carrier.get("name", ""),
        expires_at=expires_at
    )


@router.post("/auth/logout")
async def carrier_logout(authorization: str = Header(None)):
    """Logout and invalidate session."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"status": "ok"}

    token = authorization[7:]
    db = get_database()

    await db.carrier_portal_sessions.update_one(
        {"token": token},
        {"$set": {"is_active": False}}
    )

    return {"status": "logged_out"}


# ============================================================================
# Available Loads
# ============================================================================

class AvailableLoadResponse(BaseModel):
    id: str
    shipment_number: str
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    equipment_type: str
    weight_lbs: Optional[int] = None
    offered_rate: int  # in cents
    tender_id: str
    tender_status: str
    posted_at: datetime
    expires_at: Optional[datetime] = None


@router.get("/loads/available", response_model=List[AvailableLoadResponse])
async def get_available_loads(authorization: str = Header(None)):
    """Get loads available to this carrier (pending tenders)."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    # Get pending tenders for this carrier
    tenders = await db.tenders.find({
        "carrier_id": carrier["_id"],
        "status": TenderStatus.SENT.value
    }).sort("created_at", -1).to_list(100)

    loads = []
    for tender in tenders:
        shipment = await db.shipments.find_one({"_id": tender["shipment_id"]})
        if not shipment:
            continue

        # Get origin/destination from stops
        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        loads.append(AvailableLoadResponse(
            id=str(shipment["_id"]),
            shipment_number=shipment.get("shipment_number", ""),
            origin_city=origin.get("city", ""),
            origin_state=origin.get("state", ""),
            destination_city=dest.get("city", ""),
            destination_state=dest.get("state", ""),
            pickup_date=shipment.get("pickup_date"),
            delivery_date=shipment.get("delivery_date"),
            equipment_type=shipment.get("equipment_type", "van"),
            weight_lbs=shipment.get("weight_lbs"),
            offered_rate=tender.get("offered_rate", 0),
            tender_id=str(tender["_id"]),
            tender_status=tender.get("status", "sent"),
            posted_at=tender.get("created_at", utc_now()),
            expires_at=tender.get("expires_at"),
        ))

    return loads


# ============================================================================
# Tender Response
# ============================================================================

class TenderResponseRequest(BaseModel):
    tender_id: str
    accept: bool
    counter_rate: Optional[int] = None  # in cents, if declining with counter
    decline_reason: Optional[str] = None


@router.post("/tenders/respond")
async def respond_to_tender(data: TenderResponseRequest, authorization: str = Header(None)):
    """Accept or decline a tender."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    tender = await db.tenders.find_one({
        "_id": ObjectId(data.tender_id),
        "carrier_id": carrier["_id"]
    })

    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender.get("status") not in [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]:
        raise HTTPException(status_code=400, detail="Tender already responded to")

    now = utc_now()

    if data.accept:
        # Accept tender
        negotiation_event = {
            "timestamp": now,
            "action": "accepted",
            "amount": tender.get("offered_rate", 0),
            "party": "carrier",
            "notes": None,
            "auto_action": False,
        }

        await db.tenders.update_one(
            {"_id": ObjectId(data.tender_id)},
            {
                "$set": {
                    "status": TenderStatus.ACCEPTED.value,
                    "responded_at": now,
                    "updated_at": now,
                },
                "$push": {"negotiation_history": negotiation_event},
            }
        )

        # Update shipment with carrier
        await db.shipments.update_one(
            {"_id": tender["shipment_id"]},
            {
                "$set": {
                    "carrier_id": carrier["_id"],
                    "carrier_cost": tender.get("offered_rate", 0),
                    "updated_at": now,
                }
            }
        )

        # Decline other tenders for this shipment
        await db.tenders.update_many(
            {
                "shipment_id": tender["shipment_id"],
                "_id": {"$ne": ObjectId(data.tender_id)},
                "status": {"$in": [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]},
            },
            {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": now}}
        )

        # Auto-remove load board postings for this shipment
        await db.loadboard_postings.update_many(
            {
                "shipment_id": tender["shipment_id"],
                "status": {"$in": ["draft", "posted"]},
            },
            {"$set": {"status": "cancelled", "updated_at": now}}
        )

        return {"status": "accepted", "message": "Tender accepted successfully"}
    else:
        # Decline tender
        negotiation_event = {
            "timestamp": now,
            "action": "declined",
            "amount": tender.get("offered_rate", 0),
            "party": "carrier",
            "notes": data.decline_reason,
            "auto_action": False,
        }

        update = {
            "status": TenderStatus.DECLINED.value,
            "responded_at": now,
            "response_notes": data.decline_reason,
            "updated_at": now,
        }
        if data.counter_rate:
            update["counter_offer_rate"] = data.counter_rate

        await db.tenders.update_one(
            {"_id": ObjectId(data.tender_id)},
            {
                "$set": update,
                "$push": {"negotiation_history": negotiation_event},
            }
        )

        return {"status": "declined", "message": "Tender declined"}


# ============================================================================
# Carrier Portal - Tender-Specific Endpoints
# ============================================================================

@router.get("/tenders")
async def get_carrier_tenders(
    status: Optional[str] = None,
    authorization: str = Header(None),
):
    """List all tenders for this carrier (available, pending, history)."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    query = {"carrier_id": carrier["_id"]}
    if status:
        query["status"] = status
    else:
        # Show active tenders by default (sent, counter_offered)
        query["status"] = {"$in": [
            TenderStatus.SENT.value,
            TenderStatus.COUNTER_OFFERED.value,
        ]}

    tenders = await db.tenders.find(query).sort("created_at", -1).to_list(100)

    results = []
    for tender in tenders:
        shipment = await db.shipments.find_one({"_id": tender["shipment_id"]})
        stops = shipment.get("stops", []) if shipment else []
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        results.append({
            "id": str(tender["_id"]),
            "shipment_id": str(tender["shipment_id"]),
            "shipment_number": shipment.get("shipment_number", "") if shipment else "",
            "status": tender.get("status"),
            "offered_rate": tender.get("offered_rate", 0),
            "counter_offer_rate": tender.get("counter_offer_rate"),
            "origin_city": origin.get("city", ""),
            "origin_state": origin.get("state", ""),
            "destination_city": dest.get("city", ""),
            "destination_state": dest.get("state", ""),
            "equipment_type": shipment.get("equipment_type", "van") if shipment else "van",
            "weight_lbs": shipment.get("weight_lbs") if shipment else None,
            "pickup_date": shipment.get("pickup_date") if shipment else None,
            "delivery_date": shipment.get("delivery_date") if shipment else None,
            "expires_at": tender.get("expires_at"),
            "negotiation_history": tender.get("negotiation_history", []),
            "created_at": tender.get("created_at"),
        })

    return results


class CarrierAcceptTenderRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/tenders/{tender_id}/accept")
async def carrier_accept_tender(tender_id: str, data: CarrierAcceptTenderRequest, authorization: str = Header(None)):
    """Carrier accepts a specific tender."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    tender = await db.tenders.find_one({
        "_id": ObjectId(tender_id),
        "carrier_id": carrier["_id"],
    })
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender.get("status") not in [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]:
        raise HTTPException(status_code=400, detail="Tender cannot be accepted in current state")

    now = utc_now()
    negotiation_event = {
        "timestamp": now,
        "action": "accepted",
        "amount": tender.get("offered_rate", 0),
        "party": "carrier",
        "notes": data.notes,
        "auto_action": False,
    }

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {
            "$set": {
                "status": TenderStatus.ACCEPTED.value,
                "responded_at": now,
                "response_notes": data.notes,
                "updated_at": now,
            },
            "$push": {"negotiation_history": negotiation_event},
        }
    )

    # Update shipment
    await db.shipments.update_one(
        {"_id": tender["shipment_id"]},
        {"$set": {
            "carrier_id": carrier["_id"],
            "carrier_cost": tender.get("offered_rate", 0),
            "updated_at": now,
        }}
    )

    # Cancel other tenders
    await db.tenders.update_many(
        {
            "shipment_id": tender["shipment_id"],
            "_id": {"$ne": ObjectId(tender_id)},
            "status": {"$in": [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]},
        },
        {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": now}}
    )

    # Auto-remove load board postings
    await db.loadboard_postings.update_many(
        {"shipment_id": tender["shipment_id"], "status": {"$in": ["draft", "posted"]}},
        {"$set": {"status": "cancelled", "updated_at": now}}
    )

    return {"status": "accepted", "message": "Tender accepted"}


class CarrierDeclineTenderRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/tenders/{tender_id}/decline")
async def carrier_decline_tender(tender_id: str, data: CarrierDeclineTenderRequest, authorization: str = Header(None)):
    """Carrier declines a specific tender."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    tender = await db.tenders.find_one({
        "_id": ObjectId(tender_id),
        "carrier_id": carrier["_id"],
    })
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender.get("status") not in [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]:
        raise HTTPException(status_code=400, detail="Tender cannot be declined in current state")

    now = utc_now()
    negotiation_event = {
        "timestamp": now,
        "action": "declined",
        "amount": tender.get("offered_rate", 0),
        "party": "carrier",
        "notes": data.reason,
        "auto_action": False,
    }

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {
            "$set": {
                "status": TenderStatus.DECLINED.value,
                "responded_at": now,
                "response_notes": data.reason,
                "updated_at": now,
            },
            "$push": {"negotiation_history": negotiation_event},
        }
    )

    return {"status": "declined", "message": "Tender declined"}


class CarrierCounterOfferRequest(BaseModel):
    counter_rate: int  # in cents
    notes: Optional[str] = None


@router.post("/tenders/{tender_id}/counter-offer")
async def carrier_counter_offer(tender_id: str, data: CarrierCounterOfferRequest, authorization: str = Header(None)):
    """Carrier submits a counter-offer on a tender."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    tender = await db.tenders.find_one({
        "_id": ObjectId(tender_id),
        "carrier_id": carrier["_id"],
    })
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender.get("status") not in [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]:
        raise HTTPException(status_code=400, detail="Cannot counter-offer on this tender")

    now = utc_now()
    original_rate = tender.get("offered_rate", 0)

    # Check auto-accept threshold
    config = await db.tender_waterfall_config.find_one({"is_default": True})
    auto_accept_range = 5
    if config:
        auto_accept_range = config.get("auto_accept_counter_range_percent", 5)

    diff_percent = ((data.counter_rate - original_rate) / original_rate * 100) if original_rate > 0 else 100
    auto_accepted = diff_percent <= auto_accept_range

    negotiation_event = {
        "timestamp": now,
        "action": "counter_offer",
        "amount": data.counter_rate,
        "party": "carrier",
        "notes": data.notes,
        "auto_action": False,
    }

    if auto_accepted:
        # Auto-accept: within threshold
        accept_event = {
            "timestamp": now,
            "action": "counter_accepted",
            "amount": data.counter_rate,
            "party": "broker",
            "notes": f"Auto-accepted (within {auto_accept_range}% threshold)",
            "auto_action": True,
        }

        await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {
                "$set": {
                    "status": TenderStatus.ACCEPTED.value,
                    "offered_rate": data.counter_rate,
                    "counter_offer_rate": data.counter_rate,
                    "counter_offer_notes": data.notes,
                    "responded_at": now,
                    "response_notes": f"Auto-accepted counter-offer (within {auto_accept_range}% range)",
                    "updated_at": now,
                },
                "$push": {"negotiation_history": {"$each": [negotiation_event, accept_event]}},
            }
        )

        # Update shipment
        await db.shipments.update_one(
            {"_id": tender["shipment_id"]},
            {"$set": {
                "carrier_id": carrier["_id"],
                "carrier_cost": data.counter_rate,
                "updated_at": now,
            }}
        )

        # Cancel other tenders
        await db.tenders.update_many(
            {
                "shipment_id": tender["shipment_id"],
                "_id": {"$ne": ObjectId(tender_id)},
                "status": {"$in": [TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]},
            },
            {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": now}}
        )

        # Auto-remove load board postings
        await db.loadboard_postings.update_many(
            {"shipment_id": tender["shipment_id"], "status": {"$in": ["draft", "posted"]}},
            {"$set": {"status": "cancelled", "updated_at": now}}
        )

        return {
            "status": "auto_accepted",
            "message": f"Counter-offer auto-accepted (within {auto_accept_range}% of offered rate)",
            "new_rate": data.counter_rate,
        }
    else:
        # Pending broker review
        await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {
                "$set": {
                    "status": TenderStatus.COUNTER_OFFERED.value,
                    "counter_offer_rate": data.counter_rate,
                    "counter_offer_notes": data.notes,
                    "updated_at": now,
                },
                "$push": {"negotiation_history": negotiation_event},
            }
        )

        # Also save to counter_offers collection for tracking
        await db.counter_offers.insert_one({
            "_id": ObjectId(),
            "tender_id": ObjectId(tender_id),
            "round_number": len(tender.get("negotiation_history", [])) + 1,
            "offered_by": "carrier",
            "original_rate": original_rate,
            "counter_rate": data.counter_rate,
            "notes": data.notes,
            "status": "pending",
            "auto_accepted": False,
            "created_at": now,
            "updated_at": now,
        })

        return {
            "status": "counter_offered",
            "message": "Counter-offer submitted for broker review",
            "counter_rate": data.counter_rate,
        }


class DocumentUploadRequest(BaseModel):
    shipment_id: str
    document_type: str  # "bol", "pod", "rate_confirmation", "insurance", "w9", "other"
    filename: str
    notes: Optional[str] = None


@router.post("/documents/upload")
async def upload_carrier_document(data: DocumentUploadRequest, authorization: str = Header(None)):
    """Upload paperwork for a load (BOL, POD, rate confirmation, etc.)."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    # Verify carrier owns this shipment
    shipment = await db.shipments.find_one({
        "_id": ObjectId(data.shipment_id),
        "carrier_id": carrier["_id"],
    })
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found or not assigned to you")

    now = utc_now()
    doc = {
        "_id": ObjectId(),
        "shipment_id": ObjectId(data.shipment_id),
        "carrier_id": carrier["_id"],
        "document_type": data.document_type,
        "original_filename": data.filename,
        "uploaded_by": f"carrier_portal:{carrier['_id']}",
        "status": "uploaded",
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
    }

    await db.documents.insert_one(doc)

    # Create notification for broker
    await db.portal_notifications.insert_one({
        "portal_type": "broker",
        "entity_id": None,
        "title": f"Document uploaded by {carrier.get('name', 'carrier')}",
        "message": f"{data.document_type.upper()} uploaded for shipment {shipment.get('shipment_number', '')}",
        "notification_type": "document",
        "shipment_id": ObjectId(data.shipment_id),
        "is_read": False,
        "created_at": now,
        "updated_at": now,
    })

    return {
        "status": "uploaded",
        "document_id": str(doc["_id"]),
        "document_type": data.document_type,
        "filename": data.filename,
    }


# ============================================================================
# My Loads (Booked)
# ============================================================================

class MyLoadResponse(BaseModel):
    id: str
    shipment_number: str
    status: str
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    pickup_date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    equipment_type: str
    weight_lbs: Optional[int] = None
    rate: int
    booked_at: datetime


@router.get("/loads/my-loads", response_model=List[MyLoadResponse])
async def get_my_loads(
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get loads assigned to this carrier."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    query = {"carrier_id": carrier["_id"]}
    if status:
        query["status"] = status

    shipments = await db.shipments.find(query).sort("pickup_date", 1).to_list(100)

    loads = []
    for shipment in shipments:
        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

        loads.append(MyLoadResponse(
            id=str(shipment["_id"]),
            shipment_number=shipment.get("shipment_number", ""),
            status=shipment.get("status", "booked"),
            origin_city=origin.get("city", ""),
            origin_state=origin.get("state", ""),
            destination_city=dest.get("city", ""),
            destination_state=dest.get("state", ""),
            pickup_date=shipment.get("pickup_date"),
            delivery_date=shipment.get("delivery_date"),
            equipment_type=shipment.get("equipment_type", "van"),
            weight_lbs=shipment.get("weight_lbs"),
            rate=shipment.get("carrier_cost", 0),
            booked_at=shipment.get("created_at", utc_now()),
        ))

    return loads


@router.get("/loads/{shipment_id}")
async def get_load_detail(shipment_id: str, authorization: str = Header(None)):
    """Get detailed load information."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    shipment = await db.shipments.find_one({
        "_id": ObjectId(shipment_id),
        "carrier_id": carrier["_id"]
    })

    if not shipment:
        raise HTTPException(status_code=404, detail="Load not found")

    # Get customer info (limited)
    customer = await db.customers.find_one({"_id": shipment.get("customer_id")})
    customer_name = customer.get("name") if customer else None

    return {
        "id": str(shipment["_id"]),
        "shipment_number": shipment.get("shipment_number"),
        "status": shipment.get("status"),
        "customer_name": customer_name,
        "stops": shipment.get("stops", []),
        "equipment_type": shipment.get("equipment_type"),
        "weight_lbs": shipment.get("weight_lbs"),
        "commodity": shipment.get("commodity"),
        "special_requirements": shipment.get("special_requirements"),
        "rate": shipment.get("carrier_cost", 0),
        "pickup_date": shipment.get("pickup_date"),
        "delivery_date": shipment.get("delivery_date"),
        "bol_number": shipment.get("bol_number"),
    }


# ============================================================================
# Update Tracking
# ============================================================================

class TrackingUpdateRequest(BaseModel):
    shipment_id: str
    event_type: str  # "check_call", "arrived", "departed", "delivered"
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/tracking/update")
async def update_tracking(data: TrackingUpdateRequest, authorization: str = Header(None)):
    """Update tracking for a load."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    # Verify carrier owns this shipment
    shipment = await db.shipments.find_one({
        "_id": ObjectId(data.shipment_id),
        "carrier_id": carrier["_id"]
    })

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Create tracking event
    from app.models.tracking import TrackingEvent, TrackingEventType

    event_type_map = {
        "check_call": TrackingEventType.CHECK_CALL,
        "arrived": TrackingEventType.ARRIVED_AT_PICKUP,
        "departed": TrackingEventType.DEPARTED_PICKUP,
        "in_transit": TrackingEventType.IN_TRANSIT,
        "delivered": TrackingEventType.DELIVERED,
    }

    event = {
        "shipment_id": ObjectId(data.shipment_id),
        "event_type": event_type_map.get(data.event_type, TrackingEventType.CHECK_CALL).value,
        "event_timestamp": utc_now(),
        "reported_at": utc_now(),
        "location_city": data.location_city,
        "location_state": data.location_state,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "notes": data.notes,
        "source": "carrier_portal",
        "reported_by": f"carrier:{carrier['_id']}",
        "is_exception": False,
        "exception_resolved": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.tracking_events.insert_one(event)

    # Update shipment location
    update = {"last_check_call": utc_now(), "updated_at": utc_now()}
    if data.location_city and data.location_state:
        update["last_known_location"] = f"{data.location_city}, {data.location_state}"

    # Update status if delivered
    if data.event_type == "delivered":
        update["status"] = "delivered"
        update["actual_delivery_date"] = utc_now()

    await db.shipments.update_one(
        {"_id": ObjectId(data.shipment_id)},
        {"$set": update}
    )

    return {"status": "updated", "event_type": data.event_type}


# ============================================================================
# Documents
# ============================================================================

@router.get("/loads/{shipment_id}/documents")
async def get_load_documents(shipment_id: str, authorization: str = Header(None)):
    """Get documents for a load."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    # Verify carrier owns this shipment
    shipment = await db.shipments.find_one({
        "_id": ObjectId(shipment_id),
        "carrier_id": carrier["_id"]
    })

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    documents = await db.documents.find({
        "shipment_id": ObjectId(shipment_id),
        "document_type": {"$in": ["bol", "rate_confirmation"]}
    }).to_list(20)

    return [
        {
            "id": str(doc["_id"]),
            "document_type": doc.get("document_type"),
            "filename": doc.get("original_filename"),
            "created_at": doc.get("created_at"),
        }
        for doc in documents
    ]


# ============================================================================
# Notifications
# ============================================================================

@router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    authorization: str = Header(None)
):
    """Get portal notifications."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    query = {
        "portal_type": "carrier",
        "entity_id": carrier["_id"]
    }
    if unread_only:
        query["is_read"] = False

    notifications = await db.portal_notifications.find(query).sort("created_at", -1).to_list(50)

    return [
        {
            "id": str(n["_id"]),
            "title": n.get("title"),
            "message": n.get("message"),
            "notification_type": n.get("notification_type"),
            "is_read": n.get("is_read", False),
            "created_at": n.get("created_at"),
            "shipment_id": str(n["shipment_id"]) if n.get("shipment_id") else None,
            "tender_id": str(n["tender_id"]) if n.get("tender_id") else None,
        }
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, authorization: str = Header(None)):
    """Mark notification as read."""
    carrier = await get_current_carrier(authorization)
    db = get_database()

    await db.portal_notifications.update_one(
        {
            "_id": ObjectId(notification_id),
            "entity_id": carrier["_id"]
        },
        {"$set": {"is_read": True, "read_at": utc_now()}}
    )

    return {"status": "read"}


# ============================================================================
# Carrier Onboarding
# ============================================================================

class OnboardingStartRequest(BaseModel):
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: Optional[str] = None
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None


class OnboardingResponse(BaseModel):
    id: str
    access_token: str
    onboarding_url: str
    status: str
    current_step: int
    progress_percent: int


@router.post("/onboarding/start", response_model=OnboardingResponse)
async def start_onboarding(data: OnboardingStartRequest):
    """Start carrier onboarding process."""
    db = get_database()

    # Check if company already exists
    existing = await db.carriers.find_one({
        "$or": [
            {"name": data.company_name},
            {"mc_number": data.mc_number} if data.mc_number else {"_id": None},
            {"dot_number": data.dot_number} if data.dot_number else {"_id": None}
        ]
    })

    if existing:
        raise HTTPException(
            status_code=400,
            detail="A carrier with this company name, MC#, or DOT# already exists"
        )

    # Create onboarding record
    token = secrets.token_urlsafe(32)
    onboarding = CarrierOnboarding(
        company_name=data.company_name,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        mc_number=data.mc_number,
        dot_number=data.dot_number,
        status=OnboardingStatus.IN_PROGRESS,
        current_step=1,
        access_token=token,
        token_expires_at=utc_now() + timedelta(days=30),
    )

    await db.carrier_onboardings.insert_one(onboarding.model_dump_mongo())

    return OnboardingResponse(
        id=str(onboarding.id),
        access_token=token,
        onboarding_url=f"/carrier-onboarding/{token}",
        status=onboarding.status.value,
        current_step=onboarding.current_step,
        progress_percent=onboarding.progress_percent,
    )


@router.get("/onboarding/{token}", response_model=dict)
async def get_onboarding_status(token: str):
    """Get onboarding status and data."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({
        "access_token": token,
        "token_expires_at": {"$gt": utc_now()}
    })

    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found or expired")

    return {
        "id": str(onboarding["_id"]),
        "company_name": onboarding.get("company_name"),
        "mc_number": onboarding.get("mc_number"),
        "dot_number": onboarding.get("dot_number"),
        "contact_name": onboarding.get("contact_name"),
        "contact_email": onboarding.get("contact_email"),
        "contact_phone": onboarding.get("contact_phone"),
        "dispatch_email": onboarding.get("dispatch_email"),
        "dispatch_phone": onboarding.get("dispatch_phone"),
        "equipment_types": onboarding.get("equipment_types", []),
        "truck_count": onboarding.get("truck_count"),
        "status": onboarding.get("status"),
        "current_step": onboarding.get("current_step", 1),
        "total_steps": onboarding.get("total_steps", 6),
        "progress_percent": int((onboarding.get("current_step", 1) / 6) * 100),
        "required_documents": onboarding.get("required_documents", []),
        "uploaded_document_ids": [str(d) for d in onboarding.get("uploaded_document_ids", [])],
        "agreement_accepted": onboarding.get("agreement_accepted", False),
    }


class OnboardingUpdateRequest(BaseModel):
    step: int
    data: dict


@router.patch("/onboarding/{token}")
async def update_onboarding(token: str, data: OnboardingUpdateRequest):
    """Update onboarding data for a step."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({
        "access_token": token,
        "token_expires_at": {"$gt": utc_now()}
    })

    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found or expired")

    if onboarding.get("status") == OnboardingStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Onboarding already completed")

    # Update fields based on step
    update = {"updated_at": utc_now()}
    update.update(data.data)

    # Progress to next step
    if data.step >= onboarding.get("current_step", 1):
        update["current_step"] = data.step + 1

    await db.carrier_onboardings.update_one(
        {"_id": onboarding["_id"]},
        {"$set": update}
    )

    return {"status": "updated", "next_step": update.get("current_step", data.step + 1)}


class OnboardingStepUpdate(BaseModel):
    """Update a specific named step of the onboarding wizard."""
    data: dict


ONBOARDING_STEP_MAP = {
    "company_info": 1,
    "insurance": 2,
    "w9": 3,
    "agreement": 4,
    "equipment": 5,
    "compliance": 6,
}


@router.patch("/onboarding/{onboarding_id}/step/{step_name}")
async def update_onboarding_step(onboarding_id: str, step_name: str, body: OnboardingStepUpdate):
    """Update a specific step of the onboarding wizard by step name."""
    db = get_database()

    if step_name not in ONBOARDING_STEP_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid step name. Valid steps: {', '.join(ONBOARDING_STEP_MAP.keys())}")

    step_number = ONBOARDING_STEP_MAP[step_name]

    onboarding = await db.carrier_onboardings.find_one({"_id": ObjectId(onboarding_id)})
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    if onboarding.get("status") == OnboardingStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Onboarding already completed")

    update = {"updated_at": utc_now()}
    update.update(body.data)

    # Auto-verify MC/DOT numbers via FMCSA lookup (simulated)
    if step_name == "company_info":
        mc_number = body.data.get("mc_number")
        dot_number = body.data.get("dot_number")
        if mc_number or dot_number:
            # Simulated FMCSA verification
            update["fmcsa_verified"] = True
            update["fmcsa_verification_date"] = utc_now()
            update["fmcsa_status"] = "AUTHORIZED"

    # Auto-validate insurance certificates (simulated AI)
    if step_name == "insurance":
        update["insurance_verified"] = True
        update["insurance_verification_date"] = utc_now()

    # Track completed steps
    completed_steps = onboarding.get("completed_steps", [])
    if step_name not in completed_steps:
        completed_steps.append(step_name)
    update["completed_steps"] = completed_steps

    # Advance current step
    if step_number >= onboarding.get("current_step", 1):
        update["current_step"] = step_number + 1

    await db.carrier_onboardings.update_one(
        {"_id": ObjectId(onboarding_id)},
        {"$set": update}
    )

    return {
        "status": "updated",
        "step_name": step_name,
        "step_number": step_number,
        "next_step": update.get("current_step", step_number + 1),
        "completed_steps": completed_steps,
        "fmcsa_verified": update.get("fmcsa_verified", False),
        "insurance_verified": update.get("insurance_verified", False),
    }


@router.post("/onboarding/{token}/submit")
async def submit_onboarding(token: str):
    """Submit onboarding for review."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({
        "access_token": token,
        "token_expires_at": {"$gt": utc_now()}
    })

    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found or expired")

    # Validate required fields
    required = ["company_name", "contact_email", "agreement_accepted"]
    missing = [f for f in required if not onboarding.get(f)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

    if not onboarding.get("agreement_accepted"):
        raise HTTPException(status_code=400, detail="Agreement must be accepted")

    await db.carrier_onboardings.update_one(
        {"_id": onboarding["_id"]},
        {
            "$set": {
                "status": OnboardingStatus.PENDING_REVIEW.value,
                "updated_at": utc_now()
            }
        }
    )

    return {"status": "submitted", "message": "Onboarding submitted for review"}


# ============================================================================
# FMCSA Lookup
# ============================================================================

class FMCSALookupResponse(BaseModel):
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    legal_name: Optional[str] = None
    dba_name: Optional[str] = None
    entity_type: Optional[str] = None
    operating_status: Optional[str] = None
    out_of_service: bool = False
    phone: Optional[str] = None
    physical_address: Optional[str] = None
    physical_city: Optional[str] = None
    physical_state: Optional[str] = None
    physical_zip: Optional[str] = None
    power_units: int = 0
    drivers: int = 0
    safety_rating: Optional[str] = None
    cargo_carried: List[str] = []
    insurance_bipd_on_file: Optional[int] = None
    insurance_cargo_on_file: Optional[int] = None
    authority_status: Optional[str] = None
    common_authority: bool = False
    contract_authority: bool = False
    lookup_status: str = "success"


@router.get("/onboarding/fmcsa-lookup")
async def fmcsa_lookup(mc_number: Optional[str] = None, dot_number: Optional[str] = None):
    """
    Lookup FMCSA data for a carrier by MC# or DOT#.
    In production this would call the FMCSA SAFER API. For now returns simulated data.
    """
    if not mc_number and not dot_number:
        raise HTTPException(status_code=400, detail="Provide mc_number or dot_number")

    import hashlib
    import random

    seed_str = (mc_number or "") + (dot_number or "")
    seed = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
    random.seed(seed)

    statuses = ["AUTHORIZED", "AUTHORIZED", "AUTHORIZED", "NOT AUTHORIZED", "OUT OF SERVICE"]
    safety_ratings = ["Satisfactory", "Satisfactory", "Satisfactory", "Conditional", None]
    cargo_options = [
        ["General Freight", "Household Goods"],
        ["General Freight", "Metal/Sheets/Coils"],
        ["Refrigerated Food", "Fresh Produce"],
        ["General Freight"],
    ]

    operating_status = random.choice(statuses)
    power_units = random.randint(1, 50)
    drivers = max(power_units, random.randint(power_units, power_units + 10))

    cities = ["Chicago", "Dallas", "Atlanta", "Jacksonville", "Memphis", "Indianapolis"]
    states = ["IL", "TX", "GA", "FL", "TN", "IN"]
    city_idx = random.randint(0, len(cities) - 1)

    return FMCSALookupResponse(
        mc_number=mc_number or f"MC-{random.randint(100000, 999999)}",
        dot_number=dot_number or str(random.randint(1000000, 9999999)),
        legal_name=f"{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=3))} Trucking LLC",
        dba_name=None if random.random() > 0.3 else f"{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=3))} Transport",
        entity_type=random.choice(["CARRIER", "CARRIER", "BROKER"]),
        operating_status=operating_status,
        out_of_service=operating_status == "OUT OF SERVICE",
        phone=f"({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}",
        physical_address=f"{random.randint(100, 9999)} {random.choice(['Warehouse', 'Freight', 'Terminal'])} Dr",
        physical_city=cities[city_idx],
        physical_state=states[city_idx],
        physical_zip=str(random.randint(10000, 99999)),
        power_units=power_units,
        drivers=drivers,
        safety_rating=random.choice(safety_ratings),
        cargo_carried=random.choice(cargo_options),
        insurance_bipd_on_file=random.choice([750000, 1000000, 1500000, 5000000]),
        insurance_cargo_on_file=random.choice([100000, 250000, 500000, 1000000]),
        authority_status="ACTIVE" if operating_status == "AUTHORIZED" else "INACTIVE",
        common_authority=operating_status == "AUTHORIZED",
        contract_authority=random.random() > 0.5,
        lookup_status="success",
    )


# ============================================================================
# Onboarding Document Upload
# ============================================================================

class OnboardingDocumentUploadRequest(BaseModel):
    document_type: str  # "w9", "insurance_certificate", "signed_agreement", etc.
    filename: str
    file_url: Optional[str] = None
    mime_type: str = "application/pdf"
    file_size_bytes: int = 0


class OnboardingDocumentResponse(BaseModel):
    id: str
    onboarding_id: str
    document_type: str
    filename: str
    file_url: str
    is_verified: bool
    verification_notes: Optional[str] = None
    expiration_date: Optional[str] = None
    created_at: str


@router.post("/onboarding/{onboarding_id}/documents", response_model=OnboardingDocumentResponse)
async def upload_onboarding_document(onboarding_id: str, data: OnboardingDocumentUploadRequest):
    """Upload a document for an onboarding carrier (W9, insurance, etc.)."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({"_id": ObjectId(onboarding_id)})
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    if onboarding.get("status") == OnboardingStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Onboarding already approved")

    now = utc_now()
    file_url = data.file_url or f"/uploads/onboarding/{onboarding_id}/{data.filename}"

    doc = {
        "_id": ObjectId(),
        "onboarding_id": ObjectId(onboarding_id),
        "carrier_id": onboarding.get("carrier_id"),
        "document_type": data.document_type,
        "filename": data.filename,
        "file_url": file_url,
        "mime_type": data.mime_type,
        "file_size_bytes": data.file_size_bytes,
        "is_verified": False,
        "verified_by": None,
        "verified_at": None,
        "verification_notes": None,
        "expiration_date": None,
        "is_expired": False,
        "created_at": now,
        "updated_at": now,
    }

    await db.onboarding_documents.insert_one(doc)

    # Add document ID to onboarding record
    await db.carrier_onboardings.update_one(
        {"_id": ObjectId(onboarding_id)},
        {
            "$addToSet": {"uploaded_document_ids": doc["_id"]},
            "$set": {"updated_at": now}
        }
    )

    return OnboardingDocumentResponse(
        id=str(doc["_id"]),
        onboarding_id=onboarding_id,
        document_type=data.document_type,
        filename=data.filename,
        file_url=file_url,
        is_verified=False,
        verification_notes=None,
        expiration_date=None,
        created_at=now.isoformat(),
    )


@router.get("/onboarding/{onboarding_id}/documents")
async def list_onboarding_documents(onboarding_id: str):
    """List all documents uploaded for an onboarding."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({"_id": ObjectId(onboarding_id)})
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    cursor = db.onboarding_documents.find(
        {"onboarding_id": ObjectId(onboarding_id)}
    ).sort("created_at", -1)
    docs = await cursor.to_list(50)

    return [
        {
            "id": str(d["_id"]),
            "onboarding_id": str(d["onboarding_id"]),
            "document_type": d.get("document_type"),
            "filename": d.get("filename"),
            "file_url": d.get("file_url"),
            "mime_type": d.get("mime_type"),
            "file_size_bytes": d.get("file_size_bytes", 0),
            "is_verified": d.get("is_verified", False),
            "verified_by": d.get("verified_by"),
            "verification_notes": d.get("verification_notes"),
            "expiration_date": d.get("expiration_date").isoformat() if d.get("expiration_date") and hasattr(d.get("expiration_date"), "isoformat") else None,
            "created_at": d["created_at"].isoformat() if d.get("created_at") else "",
        }
        for d in docs
    ]


# ============================================================================
# Onboarding Status / Checklist
# ============================================================================

class OnboardingChecklistItem(BaseModel):
    key: str
    label: str
    required: bool
    completed: bool
    details: Optional[str] = None


class OnboardingStatusDetailResponse(BaseModel):
    id: str
    company_name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    status: str
    current_step: int
    total_steps: int
    progress_percent: int
    checklist: List[OnboardingChecklistItem]
    fmcsa_verified: bool
    insurance_verified: bool
    documents_uploaded: int
    documents_required: int
    agreement_accepted: bool
    completed_steps: List[str]
    created_at: str
    updated_at: str


@router.get("/onboarding/{onboarding_id}/status", response_model=OnboardingStatusDetailResponse)
async def get_onboarding_checklist_status(onboarding_id: str):
    """Get the full onboarding checklist status for a carrier."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({"_id": ObjectId(onboarding_id)})
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    doc_count = await db.onboarding_documents.count_documents(
        {"onboarding_id": ObjectId(onboarding_id)}
    )

    completed_steps = onboarding.get("completed_steps", [])
    fmcsa_verified = onboarding.get("fmcsa_verified", False)
    insurance_verified = onboarding.get("insurance_verified", False)
    agreement_accepted = onboarding.get("agreement_accepted", False)
    required_docs = onboarding.get("required_documents", ["w9", "insurance_certificate", "signed_agreement"])

    verified_docs_cursor = db.onboarding_documents.find(
        {"onboarding_id": ObjectId(onboarding_id)}
    )
    uploaded_docs = await verified_docs_cursor.to_list(50)
    uploaded_doc_types = set(d.get("document_type") for d in uploaded_docs)

    checklist = [
        OnboardingChecklistItem(
            key="company_info", label="Company Information", required=True,
            completed="company_info" in completed_steps,
            details="MC#, DOT#, company name, address" if "company_info" not in completed_steps else "Completed",
        ),
        OnboardingChecklistItem(
            key="fmcsa_verification", label="FMCSA Verification", required=True,
            completed=fmcsa_verified,
            details="Verify authority status with FMCSA" if not fmcsa_verified else "FMCSA verified",
        ),
        OnboardingChecklistItem(
            key="w9", label="W-9 Form", required=True,
            completed="w9" in uploaded_doc_types or "w9" in completed_steps,
            details="Upload W-9 form" if "w9" not in uploaded_doc_types else "W-9 uploaded",
        ),
        OnboardingChecklistItem(
            key="insurance", label="Insurance Certificate", required=True,
            completed="insurance_certificate" in uploaded_doc_types or insurance_verified or "insurance" in completed_steps,
            details="Upload certificate of insurance" if not insurance_verified else "Insurance verified",
        ),
        OnboardingChecklistItem(
            key="agreement", label="Carrier Agreement Signed", required=True,
            completed=agreement_accepted or "agreement" in completed_steps,
            details="Sign carrier agreement" if not agreement_accepted else "Agreement signed",
        ),
        OnboardingChecklistItem(
            key="equipment", label="Equipment Details", required=False,
            completed="equipment" in completed_steps,
            details="Truck count, equipment types, lanes" if "equipment" not in completed_steps else "Completed",
        ),
        OnboardingChecklistItem(
            key="compliance", label="Compliance Review", required=False,
            completed="compliance" in completed_steps,
            details="Safety rating, authority status" if "compliance" not in completed_steps else "Completed",
        ),
    ]

    total_steps = onboarding.get("total_steps", 6)
    current_step = onboarding.get("current_step", 1)

    return OnboardingStatusDetailResponse(
        id=onboarding_id,
        company_name=onboarding.get("company_name", ""),
        mc_number=onboarding.get("mc_number"),
        dot_number=onboarding.get("dot_number"),
        status=onboarding.get("status", "not_started"),
        current_step=current_step,
        total_steps=total_steps,
        progress_percent=int((current_step / total_steps) * 100) if total_steps > 0 else 0,
        checklist=checklist,
        fmcsa_verified=fmcsa_verified,
        insurance_verified=insurance_verified,
        documents_uploaded=doc_count,
        documents_required=len(required_docs),
        agreement_accepted=agreement_accepted,
        completed_steps=completed_steps,
        created_at=onboarding.get("created_at", utc_now()).isoformat() if hasattr(onboarding.get("created_at", ""), "isoformat") else str(onboarding.get("created_at", "")),
        updated_at=onboarding.get("updated_at", utc_now()).isoformat() if hasattr(onboarding.get("updated_at", ""), "isoformat") else str(onboarding.get("updated_at", "")),
    )


# ============================================================================
# Approve / Reject Carrier Onboarding
# ============================================================================

class ApproveOnboardingRequest(BaseModel):
    notes: Optional[str] = None
    approved_by: Optional[str] = None


@router.post("/onboarding/{onboarding_id}/approve")
async def approve_onboarding(onboarding_id: str, data: ApproveOnboardingRequest = ApproveOnboardingRequest()):
    """
    Approve a carrier onboarding and create a new carrier record from the onboarding data.
    """
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({"_id": ObjectId(onboarding_id)})
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    if onboarding.get("status") == OnboardingStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Onboarding already approved")

    if onboarding.get("status") not in [OnboardingStatus.PENDING_REVIEW.value, OnboardingStatus.IN_PROGRESS.value]:
        raise HTTPException(status_code=400, detail="Onboarding must be in pending_review or in_progress status to approve")

    now = utc_now()

    from app.models.carrier import Carrier, CarrierStatus, CarrierContact

    contacts = []
    if onboarding.get("contact_name"):
        contacts.append(CarrierContact(
            name=onboarding["contact_name"],
            email=onboarding.get("contact_email"),
            phone=onboarding.get("contact_phone"),
            role="Primary",
            is_primary=True,
        ))

    carrier = Carrier(
        name=onboarding.get("company_name", "Unknown"),
        mc_number=onboarding.get("mc_number"),
        dot_number=onboarding.get("dot_number"),
        status=CarrierStatus.ACTIVE,
        contacts=contacts,
        dispatch_email=onboarding.get("dispatch_email"),
        dispatch_phone=onboarding.get("dispatch_phone"),
        equipment_types=onboarding.get("equipment_types", []),
        address_line1=onboarding.get("address_line1"),
        city=onboarding.get("city"),
        state=onboarding.get("state"),
        zip_code=onboarding.get("zip_code"),
        insurance_expiration=onboarding.get("insurance_expiration"),
        authority_active=True,
        safety_rating=onboarding.get("safety_rating"),
        payment_terms=30,
        factoring_company=onboarding.get("factoring_company"),
        notes=f"Onboarded via carrier portal. {data.notes or ''}".strip(),
    )

    await db.carriers.insert_one(carrier.model_dump_mongo())

    await db.carrier_onboardings.update_one(
        {"_id": ObjectId(onboarding_id)},
        {
            "$set": {
                "status": OnboardingStatus.APPROVED.value,
                "carrier_id": carrier.id,
                "reviewed_by": data.approved_by,
                "reviewed_at": now,
                "updated_at": now,
            }
        }
    )

    return {
        "status": "approved",
        "carrier_id": str(carrier.id),
        "carrier_name": carrier.name,
        "message": f"Carrier '{carrier.name}' has been approved and created.",
    }


class RejectOnboardingRequest(BaseModel):
    reason: str
    rejected_by: Optional[str] = None


@router.post("/onboarding/{onboarding_id}/reject")
async def reject_onboarding(onboarding_id: str, data: RejectOnboardingRequest):
    """Reject a carrier onboarding application."""
    db = get_database()

    onboarding = await db.carrier_onboardings.find_one({"_id": ObjectId(onboarding_id)})
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding not found")

    if onboarding.get("status") == OnboardingStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Cannot reject an already approved onboarding")

    now = utc_now()

    await db.carrier_onboardings.update_one(
        {"_id": ObjectId(onboarding_id)},
        {
            "$set": {
                "status": OnboardingStatus.REJECTED.value,
                "rejection_reason": data.reason,
                "reviewed_by": data.rejected_by,
                "reviewed_at": now,
                "updated_at": now,
            }
        }
    )

    return {
        "status": "rejected",
        "reason": data.reason,
        "message": "Onboarding has been rejected.",
    }
