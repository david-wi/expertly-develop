from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.tender import Tender, TenderStatus
from app.models.shipment import ShipmentStatus
from app.models.work_item import WorkItem, WorkItemType, WorkItemStatus

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

    if tender.status != TenderStatus.SENT:
        raise HTTPException(status_code=400, detail="Tender must be sent to accept")

    tender.transition_to(TenderStatus.ACCEPTED)
    tender.response_notes = data.notes

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
            "status": {"$in": [TenderStatus.DRAFT, TenderStatus.SENT]},
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

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$set": tender.model_dump_mongo()}
    )

    return tender_to_response(tender)
