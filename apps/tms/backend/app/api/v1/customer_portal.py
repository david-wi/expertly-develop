"""Customer portal API for shipment visibility and self-service."""
import secrets
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.base import utc_now
from app.models.portal import CustomerPortalSession, PortalNotification

router = APIRouter()


# ============================================================================
# Authentication
# ============================================================================

class CustomerLoginRequest(BaseModel):
    email: str
    customer_id: Optional[str] = None


class CustomerLoginResponse(BaseModel):
    message: str
    email: str


class CustomerVerifyRequest(BaseModel):
    email: str
    code: str


class CustomerSessionResponse(BaseModel):
    token: str
    customer_id: str
    customer_name: str
    expires_at: datetime


async def get_current_customer(authorization: str = Header(None)):
    """Validate customer portal session and return customer."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization[7:]
    db = get_database()

    session = await db.customer_portal_sessions.find_one({
        "token": token,
        "is_active": True,
        "token_expires_at": {"$gt": utc_now()}
    })

    if not session:
        raise HTTPException(status_code=401, detail="Session expired")

    customer = await db.customers.find_one({"_id": session["customer_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Update last active
    await db.customer_portal_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"last_active_at": utc_now()}}
    )

    return customer


@router.post("/auth/request-access")
async def request_customer_access(data: CustomerLoginRequest):
    """Request access code via email (magic link style)."""
    db = get_database()

    # Find customer by email
    customer = await db.customers.find_one({
        "$or": [
            {"billing_email": data.email},
            {"contacts.email": data.email}
        ]
    })

    if not customer:
        # Don't reveal if email exists
        return CustomerLoginResponse(
            message="If this email is associated with a customer account, you will receive an access code.",
            email=data.email
        )

    # Generate 6-digit code
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    # Store code (expires in 15 minutes)
    await db.customer_access_codes.insert_one({
        "customer_id": customer["_id"],
        "email": data.email,
        "code": code,
        "expires_at": utc_now() + timedelta(minutes=15),
        "used": False,
        "created_at": utc_now()
    })

    # TODO: Send email with code
    # For now, we'll include it in response for testing
    return CustomerLoginResponse(
        message=f"Access code sent to {data.email}. Code: {code}",  # Remove code in production
        email=data.email
    )


@router.post("/auth/verify", response_model=CustomerSessionResponse)
async def verify_customer_code(data: CustomerVerifyRequest):
    """Verify access code and create session."""
    db = get_database()

    # Find valid code
    access = await db.customer_access_codes.find_one({
        "email": data.email,
        "code": data.code,
        "used": False,
        "expires_at": {"$gt": utc_now()}
    })

    if not access:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    # Mark code as used
    await db.customer_access_codes.update_one(
        {"_id": access["_id"]},
        {"$set": {"used": True}}
    )

    # Get customer
    customer = await db.customers.find_one({"_id": access["customer_id"]})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Create session
    token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=7)

    session = CustomerPortalSession(
        customer_id=customer["_id"],
        email=data.email,
        token=token,
        token_expires_at=expires_at,
    )
    await db.customer_portal_sessions.insert_one(session.model_dump_mongo())

    return CustomerSessionResponse(
        token=token,
        customer_id=str(customer["_id"]),
        customer_name=customer.get("name", ""),
        expires_at=expires_at
    )


@router.post("/auth/logout")
async def customer_logout(authorization: str = Header(None)):
    """Logout and invalidate session."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"status": "ok"}

    token = authorization[7:]
    db = get_database()

    await db.customer_portal_sessions.update_one(
        {"token": token},
        {"$set": {"is_active": False}}
    )

    return {"status": "logged_out"}


# ============================================================================
# Dashboard
# ============================================================================

@router.get("/dashboard")
async def get_customer_dashboard(authorization: str = Header(None)):
    """Get customer dashboard with summary stats."""
    customer = await get_current_customer(authorization)
    db = get_database()
    customer_id = customer["_id"]

    # Get shipment counts by status
    pipeline = [
        {"$match": {"customer_id": customer_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_counts = await db.shipments.aggregate(pipeline).to_list(20)
    by_status = {s["_id"]: s["count"] for s in status_counts}

    # Get recent shipments
    recent = await db.shipments.find(
        {"customer_id": customer_id}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Get pending invoices
    pending_invoices = await db.invoices.find({
        "customer_id": customer_id,
        "status": {"$in": ["sent", "partial"]}
    }).to_list(10)

    total_outstanding = sum(inv.get("amount_due", 0) for inv in pending_invoices)

    return {
        "customer_name": customer.get("name"),
        "shipment_counts": {
            "total": sum(by_status.values()),
            "active": by_status.get("booked", 0) + by_status.get("pending_pickup", 0) +
                      by_status.get("in_transit", 0) + by_status.get("out_for_delivery", 0),
            "delivered": by_status.get("delivered", 0),
            "by_status": by_status,
        },
        "recent_shipments": [
            {
                "id": str(s["_id"]),
                "shipment_number": s.get("shipment_number"),
                "status": s.get("status"),
                "created_at": s.get("created_at"),
            }
            for s in recent
        ],
        "invoices": {
            "pending_count": len(pending_invoices),
            "total_outstanding": total_outstanding,
        }
    }


# ============================================================================
# Shipments
# ============================================================================

class CustomerShipmentResponse(BaseModel):
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
    last_location: Optional[str] = None
    eta: Optional[datetime] = None
    created_at: datetime


@router.get("/shipments", response_model=List[CustomerShipmentResponse])
async def get_customer_shipments(
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    authorization: str = Header(None)
):
    """Get customer's shipments."""
    customer = await get_current_customer(authorization)
    db = get_database()

    query = {"customer_id": customer["_id"]}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"shipment_number": {"$regex": search, "$options": "i"}},
            {"bol_number": {"$regex": search, "$options": "i"}},
        ]

    shipments = await db.shipments.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)

    result = []
    for s in shipments:
        stops = s.get("stops", [])
        origin = next((st for st in stops if st.get("stop_type") == "pickup"), {})
        dest = next((st for st in stops if st.get("stop_type") == "delivery"), {})

        result.append(CustomerShipmentResponse(
            id=str(s["_id"]),
            shipment_number=s.get("shipment_number", ""),
            status=s.get("status", "booked"),
            origin_city=origin.get("city", ""),
            origin_state=origin.get("state", ""),
            destination_city=dest.get("city", ""),
            destination_state=dest.get("state", ""),
            pickup_date=s.get("pickup_date"),
            delivery_date=s.get("delivery_date"),
            equipment_type=s.get("equipment_type", "van"),
            last_location=s.get("last_known_location"),
            eta=s.get("eta"),
            created_at=s.get("created_at", utc_now()),
        ))

    return result


@router.get("/shipments/{shipment_id}")
async def get_shipment_detail(shipment_id: str, authorization: str = Header(None)):
    """Get detailed shipment information."""
    customer = await get_current_customer(authorization)
    db = get_database()

    shipment = await db.shipments.find_one({
        "_id": ObjectId(shipment_id),
        "customer_id": customer["_id"]
    })

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Get carrier info (limited)
    carrier = None
    if shipment.get("carrier_id"):
        carrier_doc = await db.carriers.find_one({"_id": shipment["carrier_id"]})
        if carrier_doc:
            carrier = {
                "name": carrier_doc.get("name"),
                "mc_number": carrier_doc.get("mc_number"),
            }

    # Get tracking events
    events = await db.tracking_events.find(
        {"shipment_id": ObjectId(shipment_id)}
    ).sort("event_timestamp", -1).limit(20).to_list(20)

    return {
        "id": str(shipment["_id"]),
        "shipment_number": shipment.get("shipment_number"),
        "status": shipment.get("status"),
        "stops": shipment.get("stops", []),
        "equipment_type": shipment.get("equipment_type"),
        "weight_lbs": shipment.get("weight_lbs"),
        "commodity": shipment.get("commodity"),
        "pickup_date": shipment.get("pickup_date"),
        "delivery_date": shipment.get("delivery_date"),
        "actual_pickup_date": shipment.get("actual_pickup_date"),
        "actual_delivery_date": shipment.get("actual_delivery_date"),
        "last_location": shipment.get("last_known_location"),
        "last_check_call": shipment.get("last_check_call"),
        "eta": shipment.get("eta"),
        "customer_price": shipment.get("customer_price"),
        "bol_number": shipment.get("bol_number"),
        "carrier": carrier,
        "tracking_events": [
            {
                "event_type": e.get("event_type"),
                "timestamp": e.get("event_timestamp"),
                "location": f"{e.get('location_city', '')}, {e.get('location_state', '')}".strip(", "),
                "notes": e.get("notes"),
            }
            for e in events
        ],
        "created_at": shipment.get("created_at"),
    }


# ============================================================================
# Documents
# ============================================================================

@router.get("/shipments/{shipment_id}/documents")
async def get_shipment_documents(shipment_id: str, authorization: str = Header(None)):
    """Get documents for a shipment."""
    customer = await get_current_customer(authorization)
    db = get_database()

    # Verify customer owns this shipment
    shipment = await db.shipments.find_one({
        "_id": ObjectId(shipment_id),
        "customer_id": customer["_id"]
    })

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    documents = await db.documents.find({
        "shipment_id": ObjectId(shipment_id)
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
# Quotes
# ============================================================================

@router.get("/quotes")
async def get_customer_quotes(
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get customer's quotes."""
    customer = await get_current_customer(authorization)
    db = get_database()

    query = {"customer_id": customer["_id"]}
    if status:
        query["status"] = status

    quotes = await db.quotes.find(query).sort("created_at", -1).to_list(50)

    return [
        {
            "id": str(q["_id"]),
            "quote_number": q.get("quote_number"),
            "status": q.get("status"),
            "origin_city": q.get("origin_city"),
            "origin_state": q.get("origin_state"),
            "destination_city": q.get("destination_city"),
            "destination_state": q.get("destination_state"),
            "pickup_date": q.get("pickup_date"),
            "total_price": q.get("total_price"),
            "created_at": q.get("created_at"),
            "expires_at": q.get("expires_at"),
        }
        for q in quotes
    ]


@router.get("/quotes/{quote_id}")
async def get_quote_detail(quote_id: str, authorization: str = Header(None)):
    """Get quote detail."""
    customer = await get_current_customer(authorization)
    db = get_database()

    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "customer_id": customer["_id"]
    })

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    return {
        "id": str(quote["_id"]),
        "quote_number": quote.get("quote_number"),
        "status": quote.get("status"),
        "origin_city": quote.get("origin_city"),
        "origin_state": quote.get("origin_state"),
        "destination_city": quote.get("destination_city"),
        "destination_state": quote.get("destination_state"),
        "pickup_date": quote.get("pickup_date"),
        "delivery_date": quote.get("delivery_date"),
        "equipment_type": quote.get("equipment_type"),
        "weight_lbs": quote.get("weight_lbs"),
        "commodity": quote.get("commodity"),
        "line_items": quote.get("line_items", []),
        "total_price": quote.get("total_price"),
        "created_at": quote.get("created_at"),
        "expires_at": quote.get("expires_at"),
    }


@router.post("/quotes/{quote_id}/accept")
async def accept_quote(quote_id: str, authorization: str = Header(None)):
    """Accept a quote (books as shipment)."""
    customer = await get_current_customer(authorization)
    db = get_database()

    quote = await db.quotes.find_one({
        "_id": ObjectId(quote_id),
        "customer_id": customer["_id"]
    })

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if quote.get("status") != "sent":
        raise HTTPException(status_code=400, detail="Quote cannot be accepted in current status")

    # Update quote status
    await db.quotes.update_one(
        {"_id": ObjectId(quote_id)},
        {
            "$set": {
                "status": "accepted",
                "accepted_at": utc_now(),
                "updated_at": utc_now()
            }
        }
    )

    # Create work item to book shipment
    from app.models.work_item import WorkItemType, WorkItemStatus

    work_item = {
        "work_type": WorkItemType.QUOTE_FOLLOWUP.value,
        "status": WorkItemStatus.OPEN.value,
        "title": f"Book Quote {quote.get('quote_number')}",
        "description": f"Customer accepted quote via portal. Create shipment.",
        "quote_id": ObjectId(quote_id),
        "customer_id": customer["_id"],
        "priority": 2,
        "is_overdue": False,
        "is_snoozed": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.work_items.insert_one(work_item)

    return {"status": "accepted", "message": "Quote accepted. Shipment will be booked shortly."}


# ============================================================================
# Invoices
# ============================================================================

@router.get("/invoices")
async def get_customer_invoices(
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get customer's invoices."""
    customer = await get_current_customer(authorization)
    db = get_database()

    query = {"customer_id": customer["_id"]}
    if status:
        query["status"] = status

    invoices = await db.invoices.find(query).sort("invoice_date", -1).to_list(50)

    return [
        {
            "id": str(inv["_id"]),
            "invoice_number": inv.get("invoice_number"),
            "status": inv.get("status"),
            "invoice_date": inv.get("invoice_date"),
            "due_date": inv.get("due_date"),
            "total": inv.get("total"),
            "amount_paid": inv.get("amount_paid", 0),
            "amount_due": inv.get("amount_due", inv.get("total", 0)),
            "shipment_number": None,  # Would need to look up
        }
        for inv in invoices
    ]


@router.get("/invoices/{invoice_id}")
async def get_invoice_detail(invoice_id: str, authorization: str = Header(None)):
    """Get invoice detail."""
    customer = await get_current_customer(authorization)
    db = get_database()

    invoice = await db.invoices.find_one({
        "_id": ObjectId(invoice_id),
        "customer_id": customer["_id"]
    })

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Get shipment info if linked
    shipment = None
    if invoice.get("shipment_id"):
        shipment_doc = await db.shipments.find_one({"_id": invoice["shipment_id"]})
        if shipment_doc:
            shipment = {
                "id": str(shipment_doc["_id"]),
                "shipment_number": shipment_doc.get("shipment_number"),
            }

    return {
        "id": str(invoice["_id"]),
        "invoice_number": invoice.get("invoice_number"),
        "status": invoice.get("status"),
        "invoice_date": invoice.get("invoice_date"),
        "due_date": invoice.get("due_date"),
        "billing_name": invoice.get("billing_name"),
        "line_items": invoice.get("line_items", []),
        "total": invoice.get("total"),
        "amount_paid": invoice.get("amount_paid", 0),
        "amount_due": invoice.get("amount_due", invoice.get("total", 0)),
        "shipment": shipment,
        "created_at": invoice.get("created_at"),
    }


# ============================================================================
# Quote Requests
# ============================================================================

class QuoteRequestCreate(BaseModel):
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    pickup_date: Optional[datetime] = None
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    commodity: Optional[str] = None
    special_requirements: Optional[str] = None


@router.post("/quote-requests")
async def create_quote_request(data: QuoteRequestCreate, authorization: str = Header(None)):
    """Create a new quote request."""
    customer = await get_current_customer(authorization)
    db = get_database()

    from app.models.quote_request import QuoteRequestStatus

    quote_request = {
        "source_type": "customer_portal",
        "customer_id": customer["_id"],
        "status": QuoteRequestStatus.NEW.value,
        "extracted_origin_city": {"value": data.origin_city, "confidence": 1.0, "evidence_source": "portal"},
        "extracted_origin_state": {"value": data.origin_state, "confidence": 1.0, "evidence_source": "portal"},
        "extracted_destination_city": {"value": data.destination_city, "confidence": 1.0, "evidence_source": "portal"},
        "extracted_destination_state": {"value": data.destination_state, "confidence": 1.0, "evidence_source": "portal"},
        "extracted_pickup_date": {"value": data.pickup_date.isoformat() if data.pickup_date else None, "confidence": 1.0, "evidence_source": "portal"} if data.pickup_date else None,
        "extracted_equipment_type": {"value": data.equipment_type, "confidence": 1.0, "evidence_source": "portal"},
        "missing_fields": [],
        "extraction_confidence": 1.0,
        "received_at": utc_now(),
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    result = await db.quote_requests.insert_one(quote_request)

    # Create work item
    from app.models.work_item import WorkItemType, WorkItemStatus

    work_item = {
        "work_type": WorkItemType.QUOTE_REQUEST.value,
        "status": WorkItemStatus.OPEN.value,
        "title": f"Quote Request: {data.origin_city}, {data.origin_state} to {data.destination_city}, {data.destination_state}",
        "description": f"Customer submitted quote request via portal.",
        "quote_request_id": result.inserted_id,
        "customer_id": customer["_id"],
        "priority": 2,
        "is_overdue": False,
        "is_snoozed": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.work_items.insert_one(work_item)

    return {
        "id": str(result.inserted_id),
        "status": "submitted",
        "message": "Quote request submitted. You will receive a quote shortly."
    }


# ============================================================================
# Notifications
# ============================================================================

@router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    authorization: str = Header(None)
):
    """Get portal notifications."""
    customer = await get_current_customer(authorization)
    db = get_database()

    query = {
        "portal_type": "customer",
        "entity_id": customer["_id"]
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
            "invoice_id": str(n["invoice_id"]) if n.get("invoice_id") else None,
        }
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, authorization: str = Header(None)):
    """Mark notification as read."""
    customer = await get_current_customer(authorization)
    db = get_database()

    await db.portal_notifications.update_one(
        {
            "_id": ObjectId(notification_id),
            "entity_id": customer["_id"]
        },
        {"$set": {"is_read": True, "read_at": utc_now()}}
    )

    return {"status": "read"}


# ============================================================================
# Enhanced Customer Tracking Dashboard
# ============================================================================

@router.get("/tracking-dashboard")
async def get_customer_tracking_dashboard(authorization: str = Header(None)):
    """Enhanced tracking dashboard with all active shipments, map data, and ETA confidence."""
    customer = await get_current_customer(authorization)
    db = get_database()
    customer_id = customer["_id"]

    # Get all active shipments
    active_statuses = ["booked", "pending_pickup", "in_transit", "out_for_delivery"]
    active_shipments = await db.shipments.find({
        "customer_id": customer_id,
        "status": {"$in": active_statuses}
    }).sort("created_at", -1).to_list(100)

    shipment_tracking = []
    for s in active_shipments:
        stops = s.get("stops", [])
        origin = next((st for st in stops if st.get("stop_type") == "pickup"), {})
        dest = next((st for st in stops if st.get("stop_type") == "delivery"), {})

        # Get latest tracking event
        latest_event = await db.tracking_events.find_one(
            {"shipment_id": s["_id"]},
            sort=[("event_timestamp", -1)]
        )

        # Calculate ETA confidence
        eta_confidence = None
        if s.get("eta") and s.get("delivery_date"):
            # Higher confidence when GPS data is recent
            last_check = s.get("last_check_call")
            if last_check:
                hours_since = (utc_now() - last_check).total_seconds() / 3600
                if hours_since < 1:
                    eta_confidence = 0.95
                elif hours_since < 4:
                    eta_confidence = 0.80
                elif hours_since < 8:
                    eta_confidence = 0.60
                else:
                    eta_confidence = 0.40

        shipment_tracking.append({
            "id": str(s["_id"]),
            "shipment_number": s.get("shipment_number"),
            "status": s.get("status"),
            "origin_city": origin.get("city", ""),
            "origin_state": origin.get("state", ""),
            "destination_city": dest.get("city", ""),
            "destination_state": dest.get("state", ""),
            "pickup_date": s.get("pickup_date"),
            "delivery_date": s.get("delivery_date"),
            "eta": s.get("eta"),
            "eta_confidence": eta_confidence,
            "last_location": s.get("last_known_location"),
            "last_update": s.get("last_check_call"),
            "latest_event": {
                "event_type": latest_event.get("event_type"),
                "timestamp": latest_event.get("event_timestamp"),
                "location": f"{latest_event.get('location_city', '')}, {latest_event.get('location_state', '')}".strip(", "),
            } if latest_event else None,
            "latitude": latest_event.get("latitude") if latest_event else None,
            "longitude": latest_event.get("longitude") if latest_event else None,
        })

    # Get recently delivered (last 7 days)
    from datetime import timedelta
    seven_days_ago = utc_now() - timedelta(days=7)
    recent_delivered = await db.shipments.find({
        "customer_id": customer_id,
        "status": "delivered",
        "actual_delivery_date": {"$gte": seven_days_ago},
    }).sort("actual_delivery_date", -1).limit(10).to_list(10)

    return {
        "customer_name": customer.get("name"),
        "active_shipments": shipment_tracking,
        "active_count": len(shipment_tracking),
        "in_transit_count": len([s for s in shipment_tracking if s["status"] == "in_transit"]),
        "pending_pickup_count": len([s for s in shipment_tracking if s["status"] == "pending_pickup"]),
        "recent_deliveries": [
            {
                "id": str(s["_id"]),
                "shipment_number": s.get("shipment_number"),
                "delivered_at": s.get("actual_delivery_date"),
            }
            for s in recent_delivered
        ],
    }


@router.get("/shipments/{shipment_id}/tracking-detail")
async def get_customer_shipment_tracking_detail(shipment_id: str, authorization: str = Header(None)):
    """Detailed tracking view for a single shipment with map data and ETA."""
    customer = await get_current_customer(authorization)
    db = get_database()

    shipment = await db.shipments.find_one({
        "_id": ObjectId(shipment_id),
        "customer_id": customer["_id"]
    })
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Get all tracking events with GPS coordinates
    events = await db.tracking_events.find(
        {"shipment_id": ObjectId(shipment_id)}
    ).sort("event_timestamp", -1).to_list(100)

    # Get POD
    pod = await db.pod_captures.find_one({"shipment_id": ObjectId(shipment_id)})

    # Get route points (GPS coordinates for map)
    route_points = [
        {"lat": e.get("latitude"), "lng": e.get("longitude"), "timestamp": e.get("event_timestamp")}
        for e in events
        if e.get("latitude") and e.get("longitude")
    ]

    stops = shipment.get("stops", [])
    origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
    dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})

    return {
        "shipment_number": shipment.get("shipment_number"),
        "status": shipment.get("status"),
        "origin": {"city": origin.get("city"), "state": origin.get("state"), "lat": origin.get("latitude"), "lng": origin.get("longitude")},
        "destination": {"city": dest.get("city"), "state": dest.get("state"), "lat": dest.get("latitude"), "lng": dest.get("longitude")},
        "eta": shipment.get("eta"),
        "last_location": shipment.get("last_known_location"),
        "route_points": route_points,
        "tracking_events": [
            {
                "event_type": e.get("event_type"),
                "timestamp": e.get("event_timestamp"),
                "location": f"{e.get('location_city', '')}, {e.get('location_state', '')}".strip(", "),
                "latitude": e.get("latitude"),
                "longitude": e.get("longitude"),
                "notes": e.get("notes"),
            }
            for e in events
        ],
        "pod": {
            "captured_at": pod.get("captured_at"),
            "received_by": pod.get("received_by"),
            "has_signature": bool(pod.get("signature_data")),
            "photo_count": pod.get("photo_count", 0),
        } if pod else None,
    }
