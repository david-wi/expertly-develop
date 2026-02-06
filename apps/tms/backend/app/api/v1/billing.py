"""Billing API endpoints for invoice generation, carrier bills, and billing summary."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.carrier_bill import CarrierBill, CarrierBillStatus
from app.models.invoice import Invoice, InvoiceStatus
from app.services.billing_service import (
    generate_invoice_from_shipment,
    match_carrier_bill,
    get_billing_summary,
)
from app.services.websocket_manager import manager
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class CarrierBillCreate(BaseModel):
    """Create a new carrier bill."""
    carrier_id: str
    shipment_id: str
    bill_number: str
    amount: int  # In cents
    received_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class CarrierBillResponse(BaseModel):
    """Response model for a carrier bill."""
    id: str
    carrier_id: str
    shipment_id: str
    bill_number: str
    amount: int
    received_date: datetime
    due_date: Optional[datetime] = None
    status: str
    matched_tender_id: Optional[str] = None
    variance_amount: Optional[int] = None
    variance_reason: Optional[str] = None
    approved_by: Optional[str] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Enriched fields
    carrier_name: Optional[str] = None
    shipment_number: Optional[str] = None


class MatchResultResponse(BaseModel):
    """Response for a bill match attempt."""
    matched: bool
    tender_id: Optional[str] = None
    tender_rate: Optional[int] = None
    variance_amount: Optional[int] = None
    variance_reason: Optional[str] = None
    message: str


class InvoiceGenerateResponse(BaseModel):
    """Response for generating an invoice from a shipment."""
    id: str
    invoice_number: str
    customer_id: str
    total: int
    due_date: Optional[datetime] = None
    status: str


class BillingQueueItem(BaseModel):
    """An item in the billing queue needing attention."""
    item_type: str  # "unmatched_bill", "overdue_invoice", "draft_invoice", "disputed_bill"
    id: str
    reference: str
    amount: int
    status: str
    due_date: Optional[datetime] = None
    details: Optional[str] = None
    created_at: datetime


class BillingSummaryResponse(BaseModel):
    """Billing summary with AR/AP data."""
    outstanding_ar: int
    outstanding_ar_count: int
    outstanding_ap: int
    outstanding_ap_count: int
    revenue: int
    revenue_invoice_count: int
    cost: int
    cost_bill_count: int
    margin: int
    margin_percent: float


# ============================================================================
# Helpers
# ============================================================================


async def bill_to_response(doc: dict) -> CarrierBillResponse:
    """Convert a MongoDB document to a CarrierBillResponse with enrichment."""
    db = get_database()

    # Enrich with carrier and shipment names
    carrier_name = None
    shipment_number = None

    if doc.get("carrier_id"):
        carrier = await db.carriers.find_one({"_id": doc["carrier_id"]})
        if carrier:
            carrier_name = carrier.get("name")

    if doc.get("shipment_id"):
        shipment = await db.shipments.find_one({"_id": doc["shipment_id"]})
        if shipment:
            shipment_number = shipment.get("shipment_number")

    return CarrierBillResponse(
        id=str(doc["_id"]),
        carrier_id=str(doc["carrier_id"]),
        shipment_id=str(doc["shipment_id"]),
        bill_number=doc["bill_number"],
        amount=doc["amount"],
        received_date=doc["received_date"],
        due_date=doc.get("due_date"),
        status=doc["status"],
        matched_tender_id=str(doc["matched_tender_id"]) if doc.get("matched_tender_id") else None,
        variance_amount=doc.get("variance_amount"),
        variance_reason=doc.get("variance_reason"),
        approved_by=doc.get("approved_by"),
        paid_at=doc.get("paid_at"),
        notes=doc.get("notes"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
        carrier_name=carrier_name,
        shipment_number=shipment_number,
    )


# ============================================================================
# Billing Queue
# ============================================================================


@router.get("/queue", response_model=List[BillingQueueItem])
async def get_billing_queue():
    """Get items needing billing attention: unmatched bills, overdue invoices, etc."""
    db = get_database()
    queue_items: List[BillingQueueItem] = []
    now = utc_now()

    # 1. Unmatched carrier bills (received status, no tender match)
    unmatched_bills = await db.carrier_bills.find(
        {"status": CarrierBillStatus.RECEIVED.value}
    ).sort("created_at", -1).to_list(50)

    for bill in unmatched_bills:
        queue_items.append(BillingQueueItem(
            item_type="unmatched_bill",
            id=str(bill["_id"]),
            reference=bill["bill_number"],
            amount=bill["amount"],
            status=bill["status"],
            due_date=bill.get("due_date"),
            details="Carrier bill not yet matched to a tender",
            created_at=bill.get("created_at", now),
        ))

    # 2. Disputed carrier bills
    disputed_bills = await db.carrier_bills.find(
        {"status": CarrierBillStatus.DISPUTED.value}
    ).sort("created_at", -1).to_list(50)

    for bill in disputed_bills:
        queue_items.append(BillingQueueItem(
            item_type="disputed_bill",
            id=str(bill["_id"]),
            reference=bill["bill_number"],
            amount=bill["amount"],
            status=bill["status"],
            due_date=bill.get("due_date"),
            details=bill.get("variance_reason", "Disputed - needs review"),
            created_at=bill.get("created_at", now),
        ))

    # 3. Overdue customer invoices
    overdue_invoices = await db.invoices.find({
        "status": {"$in": [InvoiceStatus.SENT.value, InvoiceStatus.PARTIAL.value]},
        "due_date": {"$lt": now},
    }).sort("due_date", 1).to_list(50)

    for inv in overdue_invoices:
        invoice = Invoice(**inv)
        queue_items.append(BillingQueueItem(
            item_type="overdue_invoice",
            id=str(inv["_id"]),
            reference=inv["invoice_number"],
            amount=invoice.amount_due,
            status=inv["status"],
            due_date=inv.get("due_date"),
            details=f"Overdue by {(now - inv['due_date']).days} days",
            created_at=inv.get("created_at", now),
        ))

    # 4. Draft invoices that need to be sent
    draft_invoices = await db.invoices.find(
        {"status": InvoiceStatus.DRAFT.value}
    ).sort("created_at", -1).to_list(50)

    for inv in draft_invoices:
        queue_items.append(BillingQueueItem(
            item_type="draft_invoice",
            id=str(inv["_id"]),
            reference=inv["invoice_number"],
            amount=inv.get("total", 0),
            status=inv["status"],
            due_date=inv.get("due_date"),
            details="Draft invoice ready to be finalized and sent",
            created_at=inv.get("created_at", now),
        ))

    return queue_items


# ============================================================================
# Invoice Generation
# ============================================================================


@router.post("/generate-invoice/{shipment_id}", response_model=InvoiceGenerateResponse)
async def generate_invoice(shipment_id: str):
    """Generate a customer invoice from a delivered shipment."""
    try:
        invoice = await generate_invoice_from_shipment(shipment_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await manager.broadcast("billing:invoice_generated", {
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total": invoice.total,
    })

    return InvoiceGenerateResponse(
        id=str(invoice.id),
        invoice_number=invoice.invoice_number,
        customer_id=str(invoice.customer_id),
        total=invoice.total,
        due_date=invoice.due_date,
        status=invoice.status.value,
    )


# ============================================================================
# Carrier Bills
# ============================================================================


@router.get("/carrier-bills", response_model=List[CarrierBillResponse])
async def list_carrier_bills(
    status: Optional[CarrierBillStatus] = None,
    carrier_id: Optional[str] = None,
    shipment_id: Optional[str] = None,
):
    """List carrier bills with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status.value
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)

    cursor = db.carrier_bills.find(query).sort("created_at", -1)
    bills = await cursor.to_list(1000)

    return [await bill_to_response(b) for b in bills]


@router.post("/carrier-bills", response_model=CarrierBillResponse)
async def create_carrier_bill(data: CarrierBillCreate):
    """Create a new carrier bill."""
    db = get_database()

    # Validate carrier exists
    carrier = await db.carriers.find_one({"_id": ObjectId(data.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Validate shipment exists
    shipment = await db.shipments.find_one({"_id": ObjectId(data.shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    bill = CarrierBill(
        carrier_id=ObjectId(data.carrier_id),
        shipment_id=ObjectId(data.shipment_id),
        bill_number=data.bill_number,
        amount=data.amount,
        received_date=data.received_date or utc_now(),
        due_date=data.due_date,
        notes=data.notes,
    )

    await db.carrier_bills.insert_one(bill.model_dump_mongo())

    bill_doc = await db.carrier_bills.find_one({"_id": bill.id})

    await manager.broadcast("billing:carrier_bill_created", {
        "id": str(bill.id),
        "bill_number": data.bill_number,
        "amount": data.amount,
    })

    return await bill_to_response(bill_doc)


@router.post("/carrier-bills/{bill_id}/match", response_model=MatchResultResponse)
async def match_bill(bill_id: str):
    """Attempt to match a carrier bill to an accepted tender."""
    result = await match_carrier_bill(bill_id)

    return MatchResultResponse(
        matched=result.matched,
        tender_id=result.tender_id,
        tender_rate=result.tender_rate,
        variance_amount=result.variance_amount,
        variance_reason=result.variance_reason,
        message=result.message,
    )


@router.post("/carrier-bills/{bill_id}/approve", response_model=CarrierBillResponse)
async def approve_carrier_bill(bill_id: str, approved_by: Optional[str] = None):
    """Approve a carrier bill for payment."""
    db = get_database()

    bill_doc = await db.carrier_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill_doc:
        raise HTTPException(status_code=404, detail="Carrier bill not found")

    bill = CarrierBill(**bill_doc)

    if not bill.can_transition_to(CarrierBillStatus.APPROVED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve bill in '{bill.status}' status",
        )

    bill.transition_to(CarrierBillStatus.APPROVED)
    bill.approved_by = approved_by or "system"

    await db.carrier_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": bill.model_dump_mongo()},
    )

    updated = await db.carrier_bills.find_one({"_id": ObjectId(bill_id)})

    await manager.broadcast("billing:carrier_bill_approved", {
        "id": bill_id,
        "bill_number": bill.bill_number,
    })

    return await bill_to_response(updated)


# ============================================================================
# Summary
# ============================================================================


@router.get("/summary", response_model=BillingSummaryResponse)
async def billing_summary():
    """Get AR/AP billing summary."""
    summary = await get_billing_summary()
    return BillingSummaryResponse(**summary)
