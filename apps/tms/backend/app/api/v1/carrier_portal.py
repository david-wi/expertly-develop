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

    if tender.get("status") != TenderStatus.SENT.value:
        raise HTTPException(status_code=400, detail="Tender already responded to")

    if data.accept:
        # Accept tender
        await db.tenders.update_one(
            {"_id": ObjectId(data.tender_id)},
            {
                "$set": {
                    "status": TenderStatus.ACCEPTED.value,
                    "responded_at": utc_now(),
                    "updated_at": utc_now()
                }
            }
        )

        # Update shipment with carrier
        await db.shipments.update_one(
            {"_id": tender["shipment_id"]},
            {
                "$set": {
                    "carrier_id": carrier["_id"],
                    "carrier_cost": tender.get("offered_rate", 0),
                    "updated_at": utc_now()
                }
            }
        )

        # Decline other tenders for this shipment
        await db.tenders.update_many(
            {
                "shipment_id": tender["shipment_id"],
                "_id": {"$ne": ObjectId(data.tender_id)},
                "status": TenderStatus.SENT.value
            },
            {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": utc_now()}}
        )

        return {"status": "accepted", "message": "Tender accepted successfully"}
    else:
        # Decline tender
        update = {
            "status": TenderStatus.DECLINED.value,
            "responded_at": utc_now(),
            "decline_reason": data.decline_reason,
            "updated_at": utc_now()
        }
        if data.counter_rate:
            update["counter_rate"] = data.counter_rate

        await db.tenders.update_one(
            {"_id": ObjectId(data.tender_id)},
            {"$set": update}
        )

        return {"status": "declined", "message": "Tender declined"}


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
