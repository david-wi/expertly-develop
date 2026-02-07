from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.tender import Tender, TenderStatus
from app.models.shipment import ShipmentStatus
from app.models.work_item import WorkItem, WorkItemType, WorkItemStatus
from app.services.websocket_manager import manager

router = APIRouter()


class TenderCreate(BaseModel):
    shipment_id: str
    carrier_id: str
    offered_rate: int
    rate_type: str = "all_in"
    fuel_surcharge: Optional[int] = None
    accessorials: Optional[str] = None
    expires_hours: int = 24
    notes: Optional[str] = None


class TenderUpdate(BaseModel):
    offered_rate: Optional[int] = None
    fuel_surcharge: Optional[int] = None
    accessorials: Optional[str] = None
    notes: Optional[str] = None


class TenderResponse(BaseModel):
    id: str
    shipment_id: str
    carrier_id: str
    status: TenderStatus
    offered_rate: int
    rate_type: str
    fuel_surcharge: Optional[int] = None
    accessorials: Optional[str] = None
    expires_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    sent_via: Optional[str] = None
    sent_to_email: Optional[str] = None
    sent_to_phone: Optional[str] = None
    response_notes: Optional[str] = None
    counter_offer_rate: Optional[int] = None
    counter_offer_notes: Optional[str] = None
    negotiation_history: list = []
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


def tender_to_response(tender: Tender) -> TenderResponse:
    return TenderResponse(
        id=str(tender.id),
        shipment_id=str(tender.shipment_id),
        carrier_id=str(tender.carrier_id),
        status=tender.status,
        offered_rate=tender.offered_rate,
        rate_type=tender.rate_type,
        fuel_surcharge=tender.fuel_surcharge,
        accessorials=tender.accessorials,
        expires_at=tender.expires_at,
        sent_at=tender.sent_at,
        responded_at=tender.responded_at,
        sent_via=tender.sent_via,
        sent_to_email=tender.sent_to_email,
        sent_to_phone=tender.sent_to_phone,
        response_notes=tender.response_notes,
        counter_offer_rate=tender.counter_offer_rate,
        counter_offer_notes=tender.counter_offer_notes,
        negotiation_history=tender.negotiation_history,
        notes=tender.notes,
        created_at=tender.created_at,
        updated_at=tender.updated_at,
    )


@router.get("", response_model=List[TenderResponse])
async def list_tenders(
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    status: Optional[TenderStatus] = None,
):
    """List tenders with optional filters."""
    db = get_database()

    query = {}
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if status:
        query["status"] = status

    cursor = db.tenders.find(query).sort("created_at", -1)
    tenders = await cursor.to_list(1000)

    return [tender_to_response(Tender(**t)) for t in tenders]


@router.get("/{tender_id}", response_model=TenderResponse)
async def get_tender(tender_id: str):
    """Get a tender by ID."""
    db = get_database()

    tender = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    return tender_to_response(Tender(**tender))


@router.post("", response_model=TenderResponse)
async def create_tender(data: TenderCreate):
    """Create a new tender."""
    db = get_database()

    tender = Tender(
        shipment_id=ObjectId(data.shipment_id),
        carrier_id=ObjectId(data.carrier_id),
        offered_rate=data.offered_rate,
        rate_type=data.rate_type,
        fuel_surcharge=data.fuel_surcharge,
        accessorials=data.accessorials,
        expires_at=datetime.utcnow() + timedelta(hours=data.expires_hours),
        notes=data.notes,
    )

    await db.tenders.insert_one(tender.model_dump_mongo())

    await manager.broadcast("tender_created", {"id": str(tender.id), "shipment_id": data.shipment_id})
    return tender_to_response(tender)


class SendTenderRequest(BaseModel):
    via: str = "email"  # "email", "phone", "load_board"
    email: Optional[str] = None
    phone: Optional[str] = None


@router.post("/{tender_id}/send", response_model=TenderResponse)
async def send_tender(tender_id: str, data: SendTenderRequest):
    """Send a tender to a carrier."""
    db = get_database()

    tender_doc = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender_doc:
        raise HTTPException(status_code=404, detail="Tender not found")

    tender = Tender(**tender_doc)

    tender.transition_to(TenderStatus.SENT)
    tender.sent_via = data.via
    tender.sent_to_email = data.email
    tender.sent_to_phone = data.phone

    # Track negotiation event
    tender.add_negotiation_event(
        action="tender_sent",
        amount=tender.offered_rate,
        party="broker",
        notes=f"Sent via {data.via}",
    )

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$set": tender.model_dump_mongo()}
    )

    # Create work item to track response
    work_item = WorkItem(
        work_type=WorkItemType.TENDER_PENDING,
        title=f"Awaiting carrier response",
        priority=50,
        tender_id=tender.id,
        shipment_id=tender.shipment_id,
        carrier_id=tender.carrier_id,
        due_at=tender.expires_at,
    )
    await db.work_items.insert_one(work_item.model_dump_mongo())

    await manager.broadcast("tender_created", {"id": str(tender.id)})
    return tender_to_response(tender)


class AcceptTenderRequest(BaseModel):
    pro_number: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{tender_id}/accept", response_model=TenderResponse)
async def accept_tender(tender_id: str, data: AcceptTenderRequest):
    """Mark a tender as accepted and assign carrier to shipment."""
    db = get_database()

    tender_doc = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender_doc:
        raise HTTPException(status_code=404, detail="Tender not found")

    tender = Tender(**tender_doc)

    if tender.status not in [TenderStatus.SENT, TenderStatus.COUNTER_OFFERED]:
        raise HTTPException(status_code=400, detail="Tender must be sent or counter-offered to accept")

    tender.transition_to(TenderStatus.ACCEPTED)
    tender.response_notes = data.notes

    # Track negotiation event
    tender.add_negotiation_event(
        action="accepted",
        amount=tender.offered_rate,
        party="carrier",
        notes=data.notes,
    )

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$set": tender.model_dump_mongo()}
    )

    # Update shipment with carrier
    update_data = {
        "carrier_id": tender.carrier_id,
        "carrier_cost": tender.offered_rate,
        "status": ShipmentStatus.PENDING_PICKUP,
    }
    if data.pro_number:
        update_data["pro_number"] = data.pro_number

    await db.shipments.update_one(
        {"_id": tender.shipment_id},
        {"$set": update_data}
    )

    # Decline other pending tenders for this shipment
    await db.tenders.update_many(
        {
            "shipment_id": tender.shipment_id,
            "_id": {"$ne": tender.id},
            "status": {"$in": [TenderStatus.DRAFT, TenderStatus.SENT, TenderStatus.COUNTER_OFFERED]},
        },
        {"$set": {"status": TenderStatus.CANCELLED}}
    )

    # Complete work items
    await db.work_items.update_many(
        {
            "shipment_id": tender.shipment_id,
            "work_type": {"$in": [WorkItemType.SHIPMENT_NEEDS_CARRIER, WorkItemType.TENDER_PENDING]},
            "status": {"$ne": WorkItemStatus.DONE},
        },
        {"$set": {"status": WorkItemStatus.DONE}}
    )

    # Auto-remove load board postings when load is covered (Spot Market Integration)
    await db.loadboard_postings.update_many(
        {
            "shipment_id": tender.shipment_id,
            "status": {"$in": ["draft", "posted"]},
        },
        {"$set": {"status": "cancelled", "updated_at": datetime.utcnow()}}
    )

    await manager.broadcast("tender_accepted", {"id": str(tender.id), "shipment_id": str(tender.shipment_id)})
    await manager.broadcast("dashboard_refresh", {})
    return tender_to_response(tender)


class DeclineTenderRequest(BaseModel):
    reason: Optional[str] = None
    counter_offer_rate: Optional[int] = None


@router.post("/{tender_id}/decline", response_model=TenderResponse)
async def decline_tender(tender_id: str, data: DeclineTenderRequest):
    """Mark a tender as declined."""
    db = get_database()

    tender_doc = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender_doc:
        raise HTTPException(status_code=404, detail="Tender not found")

    tender = Tender(**tender_doc)

    tender.transition_to(TenderStatus.DECLINED)
    tender.response_notes = data.reason
    tender.counter_offer_rate = data.counter_offer_rate

    # Track negotiation event
    tender.add_negotiation_event(
        action="declined",
        amount=tender.offered_rate,
        party="carrier",
        notes=data.reason,
    )

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$set": tender.model_dump_mongo()}
    )

    await manager.broadcast("tender_declined", {"id": str(tender.id)})
    return tender_to_response(tender)


# ============================================================================
# Counter-Offer Workflows
# ============================================================================

class CounterOfferRequest(BaseModel):
    counter_rate: int  # in cents
    notes: Optional[str] = None


class CounterOfferResponse(BaseModel):
    id: str
    tender_id: str
    round_number: int
    offered_by: str  # "carrier" or "broker"
    original_rate: int
    counter_rate: int
    notes: Optional[str] = None
    status: str  # "pending", "accepted", "rejected"
    auto_accepted: bool = False
    created_at: datetime


@router.post("/{tender_id}/counter-offer", response_model=CounterOfferResponse)
async def create_counter_offer(tender_id: str, data: CounterOfferRequest):
    """Carrier submits a counter-offer on a tender."""
    db = get_database()

    tender_doc = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender_doc:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Count existing counter-offers for round number
    existing_count = await db.counter_offers.count_documents({"tender_id": ObjectId(tender_id)})
    round_number = existing_count + 1

    now = datetime.utcnow()

    # Check auto-accept config
    config = await db.tender_waterfall_config.find_one({"is_default": True})
    auto_accept_range = 0
    if config:
        auto_accept_range = config.get("auto_accept_counter_range_percent", 5)

    original_rate = tender_doc.get("offered_rate", 0)
    diff_percent = ((data.counter_rate - original_rate) / original_rate * 100) if original_rate > 0 else 100
    auto_accepted = diff_percent <= auto_accept_range

    status = "accepted" if auto_accepted else "pending"

    counter_doc = {
        "_id": ObjectId(),
        "tender_id": ObjectId(tender_id),
        "round_number": round_number,
        "offered_by": "carrier",
        "original_rate": original_rate,
        "counter_rate": data.counter_rate,
        "notes": data.notes,
        "status": status,
        "auto_accepted": auto_accepted,
        "created_at": now,
        "updated_at": now,
    }

    await db.counter_offers.insert_one(counter_doc)

    # If auto-accepted, update tender with new rate and accept
    if auto_accepted:
        await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {"$set": {
                "offered_rate": data.counter_rate,
                "counter_offer_rate": data.counter_rate,
                "status": TenderStatus.ACCEPTED.value,
                "responded_at": now,
                "updated_at": now,
                "response_notes": f"Auto-accepted counter-offer (within {auto_accept_range}% range)",
            }}
        )
        # Update shipment with carrier
        await db.shipments.update_one(
            {"_id": tender_doc["shipment_id"]},
            {"$set": {
                "carrier_id": tender_doc["carrier_id"],
                "carrier_cost": data.counter_rate,
                "updated_at": now,
            }}
        )
        await manager.broadcast("tender_accepted", {"id": tender_id, "auto_accepted": True})
    else:
        await db.tenders.update_one(
            {"_id": ObjectId(tender_id)},
            {"$set": {"counter_offer_rate": data.counter_rate, "updated_at": now}}
        )
        await manager.broadcast("counter_offer_received", {"id": tender_id, "counter_rate": data.counter_rate})

    return CounterOfferResponse(
        id=str(counter_doc["_id"]),
        tender_id=tender_id,
        round_number=round_number,
        offered_by="carrier",
        original_rate=original_rate,
        counter_rate=data.counter_rate,
        notes=data.notes,
        status=status,
        auto_accepted=auto_accepted,
        created_at=now,
    )


class AcceptCounterRequest(BaseModel):
    counter_offer_id: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{tender_id}/accept-counter")
async def accept_counter_offer(tender_id: str, data: AcceptCounterRequest):
    """Broker accepts a carrier's counter-offer."""
    db = get_database()

    tender_doc = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender_doc:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Find latest pending counter-offer
    query = {"tender_id": ObjectId(tender_id), "status": "pending"}
    if data.counter_offer_id:
        query["_id"] = ObjectId(data.counter_offer_id)

    counter = await db.counter_offers.find_one(query, sort=[("created_at", -1)])
    if not counter:
        raise HTTPException(status_code=404, detail="No pending counter-offer found")

    now = datetime.utcnow()
    new_rate = counter["counter_rate"]

    # Accept the counter-offer
    await db.counter_offers.update_one(
        {"_id": counter["_id"]},
        {"$set": {"status": "accepted", "updated_at": now}}
    )

    # Update tender
    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$set": {
            "offered_rate": new_rate,
            "status": TenderStatus.ACCEPTED.value,
            "responded_at": now,
            "updated_at": now,
            "response_notes": data.notes or "Counter-offer accepted",
        }}
    )

    # Update shipment
    await db.shipments.update_one(
        {"_id": tender_doc["shipment_id"]},
        {"$set": {
            "carrier_id": tender_doc["carrier_id"],
            "carrier_cost": new_rate,
            "updated_at": now,
        }}
    )

    # Track negotiation event
    negotiation_event = {
        "timestamp": now,
        "action": "counter_accepted",
        "amount": new_rate,
        "party": "broker",
        "notes": data.notes or "Counter-offer accepted",
        "auto_action": False,
    }
    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$push": {"negotiation_history": negotiation_event}}
    )

    # Cancel other tenders for this shipment
    await db.tenders.update_many(
        {
            "shipment_id": tender_doc["shipment_id"],
            "_id": {"$ne": ObjectId(tender_id)},
            "status": {"$in": [TenderStatus.DRAFT.value, TenderStatus.SENT.value, TenderStatus.COUNTER_OFFERED.value]},
        },
        {"$set": {"status": TenderStatus.CANCELLED.value, "updated_at": now}}
    )

    # Auto-remove load board postings when load is covered
    await db.loadboard_postings.update_many(
        {
            "shipment_id": tender_doc["shipment_id"],
            "status": {"$in": ["draft", "posted"]},
        },
        {"$set": {"status": "cancelled", "updated_at": now}}
    )

    await manager.broadcast("tender_accepted", {"id": tender_id, "rate": new_rate})
    return {"status": "accepted", "new_rate": new_rate, "tender_id": tender_id}


# ============================================================================
# Negotiation Thread (per-tender)
# ============================================================================

@router.get("/{tender_id}/negotiation-thread")
async def get_negotiation_thread(tender_id: str):
    """Get the full negotiation thread for a specific tender, including all events with timestamps."""
    db = get_database()

    tender = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Get carrier name
    carrier = await db.carriers.find_one({"_id": tender["carrier_id"]})
    carrier_name = carrier.get("name", "Unknown") if carrier else "Unknown"

    # Get shipment info
    shipment = await db.shipments.find_one({"_id": tender["shipment_id"]})
    shipment_number = shipment.get("shipment_number", "") if shipment else ""

    # Get counter-offers from collection as well
    counter_offers = await db.counter_offers.find(
        {"tender_id": ObjectId(tender_id)}
    ).sort("created_at", 1).to_list(100)

    return {
        "tender_id": str(tender["_id"]),
        "shipment_id": str(tender["shipment_id"]),
        "shipment_number": shipment_number,
        "carrier_id": str(tender["carrier_id"]),
        "carrier_name": carrier_name,
        "status": tender.get("status"),
        "offered_rate": tender.get("offered_rate", 0),
        "counter_offer_rate": tender.get("counter_offer_rate"),
        "negotiation_events": tender.get("negotiation_history", []),
        "counter_offers": [
            {
                "id": str(c["_id"]),
                "round_number": c.get("round_number", 1),
                "offered_by": c.get("offered_by", "carrier"),
                "original_rate": c.get("original_rate", 0),
                "counter_rate": c.get("counter_rate", 0),
                "status": c.get("status", "pending"),
                "auto_accepted": c.get("auto_accepted", False),
                "notes": c.get("notes"),
                "created_at": c["created_at"].isoformat() if hasattr(c.get("created_at"), "isoformat") else "",
            }
            for c in counter_offers
        ],
        "total_rounds": len(tender.get("negotiation_history", [])),
        "created_at": tender["created_at"].isoformat() if hasattr(tender.get("created_at"), "isoformat") else "",
    }


class BrokerCounterOfferRequest(BaseModel):
    counter_rate: int  # in cents
    notes: Optional[str] = None


@router.post("/{tender_id}/broker-counter")
async def broker_counter_offer(tender_id: str, data: BrokerCounterOfferRequest):
    """Broker proposes a different rate back to the carrier."""
    db = get_database()

    tender_doc = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender_doc:
        raise HTTPException(status_code=404, detail="Tender not found")

    if tender_doc.get("status") not in [TenderStatus.COUNTER_OFFERED.value, TenderStatus.SENT.value]:
        raise HTTPException(status_code=400, detail="Tender not in a state for counter-offers")

    now = datetime.utcnow()

    negotiation_event = {
        "timestamp": now,
        "action": "counter_offer",
        "amount": data.counter_rate,
        "party": "broker",
        "notes": data.notes,
        "auto_action": False,
    }

    # Update tender with new offered rate
    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {
            "$set": {
                "offered_rate": data.counter_rate,
                "status": TenderStatus.SENT.value,  # Re-set to sent (awaiting carrier response)
                "response_notes": data.notes,
                "updated_at": now,
            },
            "$push": {"negotiation_history": negotiation_event},
        }
    )

    # Save to counter_offers collection
    existing_count = await db.counter_offers.count_documents({"tender_id": ObjectId(tender_id)})
    await db.counter_offers.insert_one({
        "_id": ObjectId(),
        "tender_id": ObjectId(tender_id),
        "round_number": existing_count + 1,
        "offered_by": "broker",
        "original_rate": tender_doc.get("offered_rate", 0),
        "counter_rate": data.counter_rate,
        "notes": data.notes,
        "status": "pending",
        "auto_accepted": False,
        "created_at": now,
        "updated_at": now,
    })

    # Create notification for carrier
    await db.portal_notifications.insert_one({
        "portal_type": "carrier",
        "entity_id": tender_doc["carrier_id"],
        "title": "Updated Rate Offer",
        "message": f"The broker has proposed a new rate: ${data.counter_rate / 100:.2f}",
        "notification_type": "tender",
        "tender_id": ObjectId(tender_id),
        "shipment_id": tender_doc["shipment_id"],
        "is_read": False,
        "created_at": now,
        "updated_at": now,
    })

    await manager.broadcast("broker_counter_offer", {"id": tender_id, "new_rate": data.counter_rate})

    return {
        "status": "counter_sent",
        "tender_id": tender_id,
        "new_rate": data.counter_rate,
        "message": "Counter-offer sent to carrier",
    }


# ============================================================================
# Negotiation History
# ============================================================================

@router.get("/negotiation-history")
async def get_negotiation_history(
    carrier_id: Optional[str] = None,
    lane: Optional[str] = None,  # format: "origin_state-destination_state"
):
    """Get rate negotiation history per lane/carrier."""
    db = get_database()

    tender_query: dict = {}
    if carrier_id:
        tender_query["carrier_id"] = ObjectId(carrier_id)
    if lane and "-" in lane:
        # Lane filtering done after join with shipments
        pass

    cursor = db.tenders.find(tender_query).sort("created_at", -1)
    tenders = await cursor.to_list(500)

    # Get counter-offers
    tender_ids = [t["_id"] for t in tenders]
    counter_cursor = db.counter_offers.find({"tender_id": {"$in": tender_ids}}).sort("created_at", 1)
    counters = await counter_cursor.to_list(2000)
    counters_by_tender = {}
    for c in counters:
        tid = str(c["tender_id"])
        if tid not in counters_by_tender:
            counters_by_tender[tid] = []
        counters_by_tender[tid].append({
            "id": str(c["_id"]),
            "round_number": c.get("round_number", 1),
            "offered_by": c.get("offered_by", "carrier"),
            "original_rate": c.get("original_rate", 0),
            "counter_rate": c.get("counter_rate", 0),
            "status": c.get("status", "pending"),
            "auto_accepted": c.get("auto_accepted", False),
            "created_at": c["created_at"].isoformat() if hasattr(c.get("created_at"), "isoformat") else "",
        })

    # Enrich with shipment data for lane info
    shipment_ids = list(set(t.get("shipment_id") for t in tenders if t.get("shipment_id")))
    shipments = {}
    if shipment_ids:
        ship_cursor = db.shipments.find({"_id": {"$in": shipment_ids}})
        async for s in ship_cursor:
            stops = s.get("stops", [])
            origin = next((st for st in stops if st.get("stop_type") == "pickup"), {})
            dest = next((st for st in stops if st.get("stop_type") == "delivery"), {})
            shipments[str(s["_id"])] = {
                "origin_state": origin.get("state", ""),
                "origin_city": origin.get("city", ""),
                "destination_state": dest.get("state", ""),
                "destination_city": dest.get("city", ""),
            }

    # Get carrier names
    carrier_ids = list(set(t.get("carrier_id") for t in tenders if t.get("carrier_id")))
    carrier_names = {}
    if carrier_ids:
        car_cursor = db.carriers.find({"_id": {"$in": carrier_ids}})
        async for c in car_cursor:
            carrier_names[str(c["_id"])] = c.get("name", "")

    negotiations = []
    for t in tenders:
        tid = str(t["_id"])
        sid = str(t.get("shipment_id", ""))
        ship_info = shipments.get(sid, {})

        # Apply lane filter
        if lane and "-" in lane:
            parts = lane.split("-")
            if len(parts) == 2:
                if ship_info.get("origin_state", "").upper() != parts[0].upper() or ship_info.get("destination_state", "").upper() != parts[1].upper():
                    continue

        negotiations.append({
            "tender_id": tid,
            "shipment_id": sid,
            "carrier_id": str(t.get("carrier_id", "")),
            "carrier_name": carrier_names.get(str(t.get("carrier_id", "")), ""),
            "status": t.get("status", ""),
            "offered_rate": t.get("offered_rate", 0),
            "counter_offer_rate": t.get("counter_offer_rate"),
            "final_rate": t.get("offered_rate", 0) if t.get("status") == "accepted" else None,
            "origin": f"{ship_info.get('origin_city', '')}, {ship_info.get('origin_state', '')}",
            "destination": f"{ship_info.get('destination_city', '')}, {ship_info.get('destination_state', '')}",
            "lane": f"{ship_info.get('origin_state', '')}-{ship_info.get('destination_state', '')}",
            "counter_offers": counters_by_tender.get(tid, []),
            "negotiation_rounds": len(counters_by_tender.get(tid, [])),
            "created_at": t["created_at"].isoformat() if hasattr(t.get("created_at"), "isoformat") else "",
            "responded_at": t["responded_at"].isoformat() if hasattr(t.get("responded_at"), "isoformat") else None,
        })

    # Calculate summary stats
    accepted = [n for n in negotiations if n["status"] == "accepted"]
    total_savings = sum(
        (n["offered_rate"] - (n["counter_offer_rate"] or n["offered_rate"]))
        for n in accepted if n.get("counter_offer_rate")
    )

    return {
        "total_negotiations": len(negotiations),
        "accepted_count": len(accepted),
        "average_rounds": sum(n["negotiation_rounds"] for n in negotiations) / max(len(negotiations), 1),
        "total_savings_cents": abs(total_savings),
        "negotiations": negotiations[:100],
    }


# ============================================================================
# Automated Tender Waterfall
# ============================================================================

class WaterfallConfigRequest(BaseModel):
    timeout_minutes: int = 30
    max_rounds: int = 5
    auto_accept_counter_range_percent: float = 5.0
    auto_post_to_loadboard: bool = True
    carrier_ranking_method: str = "ai"  # "ai", "performance", "rate", "manual"


@router.post("/waterfall-config")
async def save_waterfall_config(data: WaterfallConfigRequest):
    """Save/update waterfall configuration."""
    db = get_database()

    now = datetime.utcnow()
    config = {
        "timeout_minutes": data.timeout_minutes,
        "max_rounds": data.max_rounds,
        "auto_accept_counter_range_percent": data.auto_accept_counter_range_percent,
        "auto_post_to_loadboard": data.auto_post_to_loadboard,
        "carrier_ranking_method": data.carrier_ranking_method,
        "is_default": True,
        "updated_at": now,
    }

    await db.tender_waterfall_config.update_one(
        {"is_default": True},
        {"$set": config},
        upsert=True
    )

    return {"status": "saved", "config": config}


@router.get("/waterfall-config")
async def get_waterfall_config():
    """Get current waterfall configuration."""
    db = get_database()

    config = await db.tender_waterfall_config.find_one({"is_default": True})
    if not config:
        return {
            "timeout_minutes": 30,
            "max_rounds": 5,
            "auto_accept_counter_range_percent": 5.0,
            "auto_post_to_loadboard": True,
            "carrier_ranking_method": "ai",
        }

    return {
        "timeout_minutes": config.get("timeout_minutes", 30),
        "max_rounds": config.get("max_rounds", 5),
        "auto_accept_counter_range_percent": config.get("auto_accept_counter_range_percent", 5.0),
        "auto_post_to_loadboard": config.get("auto_post_to_loadboard", True),
        "carrier_ranking_method": config.get("carrier_ranking_method", "ai"),
    }


class StartWaterfallRequest(BaseModel):
    carrier_ids: Optional[List[str]] = None  # If None, AI ranks carriers
    offered_rate: int
    timeout_minutes: int = 30
    rate_increase_per_round_percent: float = 0
    notes: Optional[str] = None


@router.post("/{tender_id_or_shipment_id}/start-waterfall")
async def start_waterfall(tender_id_or_shipment_id: str, data: StartWaterfallRequest):
    """Start an automated tender waterfall for a shipment."""
    db = get_database()

    now = datetime.utcnow()

    # Check if it's a shipment ID
    shipment = await db.shipments.find_one({"_id": ObjectId(tender_id_or_shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment_id = shipment["_id"]

    # Determine carrier order
    carrier_ids = []
    if data.carrier_ids:
        carrier_ids = [ObjectId(cid) for cid in data.carrier_ids]
    else:
        # AI-ranked carrier ordering based on performance, rate, and availability
        stops = shipment.get("stops", [])
        origin = next((s for s in stops if s.get("stop_type") == "pickup"), {})
        dest = next((s for s in stops if s.get("stop_type") == "delivery"), {})
        origin_state = origin.get("state", "")
        dest_state = dest.get("state", "")
        equipment_type = shipment.get("equipment_type", "van")

        # Find carriers that handle this lane/equipment
        carrier_query = {
            "status": "active",
            "$or": [
                {"equipment_types": equipment_type},
                {"equipment_types": {"$size": 0}},
            ]
        }
        carriers = await db.carriers.find(carrier_query).to_list(50)

        # Score carriers by performance
        scored = []
        for c in carriers:
            score = 50  # Base score
            on_time = c.get("on_time_deliveries", 0)
            total = c.get("total_loads", 0)
            if total > 0:
                score += (on_time / total) * 30  # Up to 30 points for on-time
            # Lane familiarity
            for lane in c.get("preferred_lanes", []):
                if lane.get("origin_state") == origin_state or lane.get("destination_state") == dest_state:
                    score += 10
                    break
            # Recency bonus
            if c.get("last_load_at"):
                days_since = (now - c["last_load_at"]).days if hasattr(c.get("last_load_at"), "days") else 999
                if days_since < 30:
                    score += 10
            scored.append((c["_id"], score, c.get("name", "")))

        scored.sort(key=lambda x: x[1], reverse=True)
        carrier_ids = [s[0] for s in scored[:data.carrier_ids and len(data.carrier_ids) or 10]]

    if not carrier_ids:
        raise HTTPException(status_code=400, detail="No carriers available for waterfall")

    # Get carrier names
    carrier_docs = await db.carriers.find({"_id": {"$in": carrier_ids}}).to_list(100)
    carrier_name_map = {str(c["_id"]): c.get("name", "") for c in carrier_docs}

    # Create waterfall record
    waterfall_steps = []
    for i, cid in enumerate(carrier_ids):
        rate = int(data.offered_rate * (1 + (data.rate_increase_per_round_percent / 100) * i))
        waterfall_steps.append({
            "step": i + 1,
            "carrier_id": cid,
            "carrier_name": carrier_name_map.get(str(cid), ""),
            "rate": rate,
            "status": "pending" if i == 0 else "waiting",
            "sent_at": now if i == 0 else None,
            "timeout_at": (now + timedelta(minutes=data.timeout_minutes)) if i == 0 else None,
            "responded_at": None,
        })

    waterfall_doc = {
        "_id": ObjectId(),
        "shipment_id": shipment_id,
        "status": "active",
        "current_step": 1,
        "total_carriers": len(carrier_ids),
        "base_rate": data.offered_rate,
        "current_rate": data.offered_rate,
        "timeout_minutes": data.timeout_minutes,
        "rate_increase_per_round_percent": data.rate_increase_per_round_percent,
        "auto_post_to_loadboard": True,
        "steps": waterfall_steps,
        "notes": data.notes,
        "started_at": now,
        "completed_at": None,
        "winning_carrier_id": None,
        "created_at": now,
        "updated_at": now,
    }

    await db.tender_waterfalls.insert_one(waterfall_doc)

    # Create the first tender
    first_carrier = carrier_ids[0]
    tender = Tender(
        shipment_id=shipment_id,
        carrier_id=first_carrier,
        offered_rate=data.offered_rate,
        rate_type="all_in",
        expires_at=now + timedelta(minutes=data.timeout_minutes),
        notes=f"Waterfall step 1 - {data.notes or ''}",
    )
    tender.transition_to(TenderStatus.SENT)
    await db.tenders.insert_one(tender.model_dump_mongo())

    await manager.broadcast("waterfall_started", {
        "waterfall_id": str(waterfall_doc["_id"]),
        "shipment_id": str(shipment_id),
        "total_carriers": len(carrier_ids),
    })

    return {
        "waterfall_id": str(waterfall_doc["_id"]),
        "shipment_id": str(shipment_id),
        "status": "active",
        "current_step": 1,
        "total_carriers": len(carrier_ids),
        "current_rate": data.offered_rate,
        "steps": [
            {
                "step": s["step"],
                "carrier_name": s["carrier_name"],
                "rate": s["rate"],
                "status": s["status"],
            }
            for s in waterfall_steps
        ],
    }


@router.get("/{waterfall_id}/waterfall-status")
async def get_waterfall_status(waterfall_id: str):
    """Get real-time waterfall status."""
    db = get_database()

    waterfall = await db.tender_waterfalls.find_one({"_id": ObjectId(waterfall_id)})
    if not waterfall:
        raise HTTPException(status_code=404, detail="Waterfall not found")

    now = datetime.utcnow()
    steps = waterfall.get("steps", [])
    current_step = waterfall.get("current_step", 1)

    # Check for timeouts on current step
    for step in steps:
        if step["status"] == "pending" and step.get("timeout_at"):
            timeout_at = step["timeout_at"]
            if hasattr(timeout_at, "timestamp") and now > timeout_at:
                step["status"] = "timed_out"

    # Calculate countdown for active step
    active_step = next((s for s in steps if s["status"] == "pending"), None)
    countdown_seconds = 0
    if active_step and active_step.get("timeout_at"):
        timeout_at = active_step["timeout_at"]
        if hasattr(timeout_at, "timestamp"):
            countdown_seconds = max(0, int((timeout_at - now).total_seconds()))

    return {
        "waterfall_id": str(waterfall["_id"]),
        "shipment_id": str(waterfall["shipment_id"]),
        "status": waterfall.get("status", "active"),
        "current_step": current_step,
        "total_carriers": waterfall.get("total_carriers", 0),
        "current_rate": waterfall.get("current_rate", 0),
        "base_rate": waterfall.get("base_rate", 0),
        "countdown_seconds": countdown_seconds,
        "winning_carrier_id": str(waterfall["winning_carrier_id"]) if waterfall.get("winning_carrier_id") else None,
        "started_at": waterfall["started_at"].isoformat() if hasattr(waterfall.get("started_at"), "isoformat") else None,
        "completed_at": waterfall["completed_at"].isoformat() if hasattr(waterfall.get("completed_at"), "isoformat") else None,
        "steps": [
            {
                "step": s["step"],
                "carrier_id": str(s.get("carrier_id", "")),
                "carrier_name": s.get("carrier_name", ""),
                "rate": s.get("rate", 0),
                "status": s.get("status", "waiting"),
                "sent_at": s["sent_at"].isoformat() if hasattr(s.get("sent_at"), "isoformat") else None,
                "responded_at": s["responded_at"].isoformat() if hasattr(s.get("responded_at"), "isoformat") else None,
            }
            for s in steps
        ],
    }
