"""Billing API endpoints for invoice generation, carrier bills, billing summary,
aging reports, quick pay, factoring, carrier invoice processing, and rate confirmation matching."""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId

from app.database import get_database
from app.models.carrier_bill import CarrierBill, CarrierBillStatus
from app.models.invoice import Invoice, InvoiceStatus, InvoiceLineItem
from app.services.billing_service import (
    generate_invoice_from_shipment,
    match_carrier_bill,
    get_billing_summary,
)
from app.services.number_generator import NumberGenerator
from app.services.websocket_manager import manager
from app.models.base import utc_now

logger = logging.getLogger(__name__)

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


# ============================================================================
# Auto-Invoice from POD (Feature: e07899c0)
# ============================================================================


class AutoInvoiceFromPODResponse(BaseModel):
    """Response for auto-invoice from POD."""
    id: str
    invoice_number: str
    customer_id: str
    total: int
    accessorial_charges: List[Dict[str, Any]] = []
    pod_notes: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    ai_detected_accessorials: List[str] = []


@router.post("/auto-from-pod/{shipment_id}", response_model=AutoInvoiceFromPODResponse)
async def auto_invoice_from_pod(shipment_id: str):
    """
    Auto-generate an invoice when POD is received/confirmed.
    Pre-populates from shipment data and uses AI to detect accessorial charges from POD notes.
    """
    db = get_database()

    # Validate shipment
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Shipment must be delivered to auto-invoice from POD")

    # Check for existing invoice
    existing = await db.invoices.find_one({"shipment_ids": ObjectId(shipment_id)})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Invoice already exists: {existing.get('invoice_number', 'unknown')}",
        )

    # Check for POD
    pod = await db.pod_captures.find_one({"shipment_id": ObjectId(shipment_id)})

    # Get customer
    customer = await db.customers.find_one({"_id": shipment["customer_id"]})
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found for shipment")

    # Build line items
    line_items = []
    origin = shipment["stops"][0] if shipment.get("stops") else {}
    dest = shipment["stops"][-1] if shipment.get("stops") and len(shipment["stops"]) > 1 else {}

    # Main freight charge
    line_items.append(InvoiceLineItem(
        description=f"Freight: {origin.get('city', 'Origin')}, {origin.get('state', '')} -> {dest.get('city', 'Dest')}, {dest.get('state', '')}",
        quantity=1,
        unit_price=shipment.get("customer_price", 0),
        shipment_id=str(shipment["_id"]),
    ))

    # AI-detect accessorial charges from POD notes and shipment data
    ai_detected_accessorials = []
    accessorial_charges = []
    pod_notes = ""

    if pod:
        pod_notes = pod.get("delivery_notes", "") or ""

    # Detect common accessorials from POD notes/shipment data
    accessorial_keywords = {
        "detention": {"description": "Detention charge", "default_amount": 7500},
        "layover": {"description": "Layover charge", "default_amount": 25000},
        "lumper": {"description": "Lumper fee", "default_amount": 15000},
        "liftgate": {"description": "Liftgate service", "default_amount": 5000},
        "residential": {"description": "Residential delivery", "default_amount": 7500},
        "reweigh": {"description": "Reweigh fee", "default_amount": 3500},
        "tarp": {"description": "Tarp charge", "default_amount": 7500},
        "inside delivery": {"description": "Inside delivery", "default_amount": 10000},
        "appointment": {"description": "Appointment scheduling fee", "default_amount": 2500},
        "TONU": {"description": "Truck ordered not used", "default_amount": 25000},
        "waiting": {"description": "Waiting time charge", "default_amount": 7500},
    }

    notes_lower = pod_notes.lower()
    shipment_notes = (shipment.get("notes", "") or "").lower()
    combined_notes = f"{notes_lower} {shipment_notes}"

    for keyword, charge_info in accessorial_keywords.items():
        if keyword.lower() in combined_notes:
            ai_detected_accessorials.append(keyword)
            accessorial_charges.append({
                "type": keyword,
                "description": charge_info["description"],
                "amount": charge_info["default_amount"],
            })
            line_items.append(InvoiceLineItem(
                description=f"Accessorial: {charge_info['description']}",
                quantity=1,
                unit_price=charge_info["default_amount"],
                shipment_id=str(shipment["_id"]),
            ))

    # Generate invoice
    invoice_number = await NumberGenerator.get_next_invoice_number()
    payment_terms = customer.get("payment_terms", 30)
    now = utc_now()

    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=shipment["customer_id"],
        shipment_ids=[ObjectId(shipment_id)],
        billing_name=customer["name"],
        billing_email=customer.get("billing_email"),
        billing_address=customer.get("address_line1"),
        line_items=line_items,
        invoice_date=now,
        due_date=now + timedelta(days=payment_terms),
        internal_notes=f"Auto-generated from POD. Detected accessorials: {', '.join(ai_detected_accessorials) if ai_detected_accessorials else 'None'}",
    )
    invoice.calculate_totals()

    await db.invoices.insert_one(invoice.model_dump_mongo())

    await manager.broadcast("billing:auto_invoice_from_pod", {
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "total": invoice.total,
        "shipment_id": shipment_id,
        "accessorials_detected": len(ai_detected_accessorials),
    })

    return AutoInvoiceFromPODResponse(
        id=str(invoice.id),
        invoice_number=invoice.invoice_number,
        customer_id=str(invoice.customer_id),
        total=invoice.total,
        accessorial_charges=accessorial_charges,
        pod_notes=pod_notes,
        due_date=invoice.due_date,
        status=invoice.status.value,
        ai_detected_accessorials=ai_detected_accessorials,
    )


# ============================================================================
# Batch Invoicing (Feature: f6a13915)
# ============================================================================


class BatchInvoiceRequest(BaseModel):
    """Request for batch invoice generation."""
    shipment_ids: List[str] = Field(default_factory=list)
    customer_id: Optional[str] = None  # If set, consolidate into one invoice per customer
    consolidate_by_customer: bool = False
    auto_send: bool = False


class BatchInvoiceResult(BaseModel):
    """Result for a single invoice in a batch."""
    shipment_id: str
    invoice_id: Optional[str] = None
    invoice_number: Optional[str] = None
    total: Optional[int] = None
    status: str  # "created", "skipped", "error"
    message: str


class BatchInvoiceResponse(BaseModel):
    """Response for batch invoicing."""
    total_processed: int
    created: int
    skipped: int
    errors: int
    results: List[BatchInvoiceResult]


@router.post("/batch-generate", response_model=BatchInvoiceResponse)
async def batch_generate_invoices(data: BatchInvoiceRequest):
    """
    Generate invoices for multiple delivered shipments in bulk.
    Can consolidate by customer for combined invoices.
    """
    db = get_database()
    results: List[BatchInvoiceResult] = []
    created = 0
    skipped = 0
    errors = 0

    # If no shipment_ids provided but customer_id given, find all delivered uninvoiced shipments
    shipment_ids = data.shipment_ids
    if not shipment_ids and data.customer_id:
        query: Dict[str, Any] = {"status": "delivered", "customer_id": ObjectId(data.customer_id)}
        shipments = await db.shipments.find(query).to_list(500)
        # Filter out already-invoiced
        for s in shipments:
            existing = await db.invoices.find_one({"shipment_ids": s["_id"]})
            if not existing:
                shipment_ids.append(str(s["_id"]))

    if not shipment_ids:
        return BatchInvoiceResponse(total_processed=0, created=0, skipped=0, errors=0, results=[])

    if data.consolidate_by_customer:
        # Group shipments by customer
        customer_shipments: Dict[str, List[dict]] = {}
        for sid in shipment_ids:
            try:
                shipment = await db.shipments.find_one({"_id": ObjectId(sid)})
                if not shipment:
                    results.append(BatchInvoiceResult(shipment_id=sid, status="error", message="Shipment not found"))
                    errors += 1
                    continue
                if shipment["status"] != "delivered":
                    results.append(BatchInvoiceResult(shipment_id=sid, status="skipped", message="Not delivered"))
                    skipped += 1
                    continue
                existing = await db.invoices.find_one({"shipment_ids": ObjectId(sid)})
                if existing:
                    results.append(BatchInvoiceResult(shipment_id=sid, status="skipped", message=f"Already invoiced: {existing.get('invoice_number')}"))
                    skipped += 1
                    continue
                cust_id = str(shipment["customer_id"])
                if cust_id not in customer_shipments:
                    customer_shipments[cust_id] = []
                customer_shipments[cust_id].append(shipment)
            except Exception as e:
                results.append(BatchInvoiceResult(shipment_id=sid, status="error", message=str(e)))
                errors += 1

        # Create one consolidated invoice per customer
        for cust_id, cust_shipments in customer_shipments.items():
            try:
                customer = await db.customers.find_one({"_id": ObjectId(cust_id)})
                if not customer:
                    for s in cust_shipments:
                        results.append(BatchInvoiceResult(shipment_id=str(s["_id"]), status="error", message="Customer not found"))
                        errors += 1
                    continue

                line_items = []
                shipment_oids = []
                for s in cust_shipments:
                    origin = s["stops"][0] if s.get("stops") else {}
                    dest = s["stops"][-1] if s.get("stops") and len(s["stops"]) > 1 else {}
                    line_items.append(InvoiceLineItem(
                        description=f"Freight ({s.get('shipment_number', '?')}): {origin.get('city', 'Origin')}, {origin.get('state', '')} -> {dest.get('city', 'Dest')}, {dest.get('state', '')}",
                        quantity=1,
                        unit_price=s.get("customer_price", 0),
                        shipment_id=str(s["_id"]),
                    ))
                    shipment_oids.append(s["_id"])

                invoice_number = await NumberGenerator.get_next_invoice_number()
                now = utc_now()
                payment_terms = customer.get("payment_terms", 30)

                invoice = Invoice(
                    invoice_number=invoice_number,
                    customer_id=ObjectId(cust_id),
                    shipment_ids=shipment_oids,
                    billing_name=customer["name"],
                    billing_email=customer.get("billing_email"),
                    billing_address=customer.get("address_line1"),
                    line_items=line_items,
                    invoice_date=now,
                    due_date=now + timedelta(days=payment_terms),
                    internal_notes=f"Batch consolidated invoice for {len(cust_shipments)} shipments",
                )
                invoice.calculate_totals()

                if data.auto_send:
                    invoice.transition_to(InvoiceStatus.PENDING)
                    invoice.transition_to(InvoiceStatus.SENT)

                await db.invoices.insert_one(invoice.model_dump_mongo())

                for s in cust_shipments:
                    results.append(BatchInvoiceResult(
                        shipment_id=str(s["_id"]),
                        invoice_id=str(invoice.id),
                        invoice_number=invoice.invoice_number,
                        total=invoice.total,
                        status="created",
                        message=f"Consolidated invoice {invoice.invoice_number}",
                    ))
                    created += 1
            except Exception as e:
                for s in cust_shipments:
                    results.append(BatchInvoiceResult(shipment_id=str(s["_id"]), status="error", message=str(e)))
                    errors += 1
    else:
        # Create individual invoices
        for sid in shipment_ids:
            try:
                invoice = await generate_invoice_from_shipment(sid)
                if data.auto_send:
                    invoice.transition_to(InvoiceStatus.PENDING)
                    invoice.transition_to(InvoiceStatus.SENT)
                    await db.invoices.update_one(
                        {"_id": invoice.id},
                        {"$set": invoice.model_dump_mongo()},
                    )
                results.append(BatchInvoiceResult(
                    shipment_id=sid,
                    invoice_id=str(invoice.id),
                    invoice_number=invoice.invoice_number,
                    total=invoice.total,
                    status="created",
                    message="Invoice created",
                ))
                created += 1
            except ValueError as e:
                msg = str(e)
                if "already exists" in msg.lower():
                    results.append(BatchInvoiceResult(shipment_id=sid, status="skipped", message=msg))
                    skipped += 1
                else:
                    results.append(BatchInvoiceResult(shipment_id=sid, status="error", message=msg))
                    errors += 1
            except Exception as e:
                results.append(BatchInvoiceResult(shipment_id=sid, status="error", message=str(e)))
                errors += 1

    await manager.broadcast("billing:batch_invoices_generated", {
        "created": created,
        "skipped": skipped,
        "errors": errors,
    })

    return BatchInvoiceResponse(
        total_processed=len(shipment_ids),
        created=created,
        skipped=skipped,
        errors=errors,
        results=results,
    )


# ============================================================================
# AR Aging Report (Feature: 36c73d09)
# ============================================================================


class AgingBucket(BaseModel):
    """An aging bucket with invoice/bill details."""
    bucket: str  # "current", "1_30", "31_60", "61_90", "91_120", "120_plus"
    label: str
    total_amount: int = 0
    count: int = 0
    items: List[Dict[str, Any]] = []


class AgingReportResponse(BaseModel):
    """AR or AP aging report."""
    report_type: str  # "ar" or "ap"
    as_of_date: datetime
    total_outstanding: int
    total_count: int
    buckets: List[AgingBucket]
    by_entity: List[Dict[str, Any]] = []  # Grouped by customer/carrier


@router.get("/aging-report", response_model=AgingReportResponse)
async def get_ar_aging_report(customer_id: Optional[str] = None):
    """
    Get AR aging report with buckets: Current, 1-30, 31-60, 61-90, 91-120, 120+ days.
    Shows customer-level and invoice-level detail.
    """
    db = get_database()
    now = utc_now()

    query: Dict[str, Any] = {"status": {"$in": ["sent", "partial"]}}
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)

    invoices = await db.invoices.find(query).sort("due_date", 1).to_list(5000)

    bucket_defs = [
        ("current", "Current", 0),
        ("1_30", "1-30 Days", 30),
        ("31_60", "31-60 Days", 60),
        ("61_90", "61-90 Days", 90),
        ("91_120", "91-120 Days", 120),
        ("120_plus", "120+ Days", None),
    ]

    buckets = {b[0]: AgingBucket(bucket=b[0], label=b[1]) for b in bucket_defs}
    entity_totals: Dict[str, Dict[str, Any]] = {}

    for inv_doc in invoices:
        inv = Invoice(**inv_doc)
        amount_due = inv.amount_due
        if amount_due <= 0:
            continue

        due_date = inv.due_date or inv.invoice_date
        days_past = (now - due_date).days if due_date else 0

        # Determine bucket
        if days_past <= 0:
            bucket_key = "current"
        elif days_past <= 30:
            bucket_key = "1_30"
        elif days_past <= 60:
            bucket_key = "31_60"
        elif days_past <= 90:
            bucket_key = "61_90"
        elif days_past <= 120:
            bucket_key = "91_120"
        else:
            bucket_key = "120_plus"

        item = {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "customer_id": str(inv.customer_id),
            "billing_name": inv.billing_name,
            "amount_due": amount_due,
            "total": inv.total,
            "due_date": due_date.isoformat() if due_date else None,
            "days_past_due": max(0, days_past),
            "status": inv.status.value,
        }

        buckets[bucket_key].total_amount += amount_due
        buckets[bucket_key].count += 1
        buckets[bucket_key].items.append(item)

        # Track by customer
        cust_key = str(inv.customer_id)
        if cust_key not in entity_totals:
            entity_totals[cust_key] = {
                "entity_id": cust_key,
                "entity_name": inv.billing_name,
                "total_outstanding": 0,
                "invoice_count": 0,
                "current": 0,
                "past_due_1_30": 0,
                "past_due_31_60": 0,
                "past_due_61_90": 0,
                "past_due_91_120": 0,
                "past_due_120_plus": 0,
            }
        entity_totals[cust_key]["total_outstanding"] += amount_due
        entity_totals[cust_key]["invoice_count"] += 1
        bucket_field_map = {
            "current": "current",
            "1_30": "past_due_1_30",
            "31_60": "past_due_31_60",
            "61_90": "past_due_61_90",
            "91_120": "past_due_91_120",
            "120_plus": "past_due_120_plus",
        }
        entity_totals[cust_key][bucket_field_map[bucket_key]] += amount_due

    total_outstanding = sum(b.total_amount for b in buckets.values())
    total_count = sum(b.count for b in buckets.values())

    return AgingReportResponse(
        report_type="ar",
        as_of_date=now,
        total_outstanding=total_outstanding,
        total_count=total_count,
        buckets=list(buckets.values()),
        by_entity=sorted(entity_totals.values(), key=lambda x: x["total_outstanding"], reverse=True),
    )


# ============================================================================
# AP/Payables Aging Report (Feature: 51bea3ab)
# ============================================================================


class CashFlowProjection(BaseModel):
    """Weekly cash flow projection."""
    week_start: str
    week_end: str
    expected_outflow: int
    bill_count: int


class PayablesAgingResponse(BaseModel):
    """AP aging report with cash flow projection."""
    report_type: str = "ap"
    as_of_date: datetime
    total_outstanding: int
    total_count: int
    buckets: List[AgingBucket]
    by_carrier: List[Dict[str, Any]] = []
    cash_flow_projection: List[CashFlowProjection] = []


@router.get("/payables-aging", response_model=PayablesAgingResponse)
async def get_payables_aging_report(carrier_id: Optional[str] = None):
    """
    Get AP aging report with buckets matching AR, plus cash flow projection.
    Shows carrier-level and payment-level detail.
    """
    db = get_database()
    now = utc_now()

    query: Dict[str, Any] = {"status": {"$in": ["received", "matched", "disputed", "approved"]}}
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)

    bills = await db.carrier_bills.find(query).sort("due_date", 1).to_list(5000)

    buckets = {
        "current": AgingBucket(bucket="current", label="Current"),
        "1_30": AgingBucket(bucket="1_30", label="1-30 Days"),
        "31_60": AgingBucket(bucket="31_60", label="31-60 Days"),
        "61_90": AgingBucket(bucket="61_90", label="61-90 Days"),
        "90_plus": AgingBucket(bucket="90_plus", label="90+ Days"),
    }
    carrier_totals: Dict[str, Dict[str, Any]] = {}

    # Cache carrier names
    carrier_cache: Dict[str, str] = {}

    for bill_doc in bills:
        amount = bill_doc.get("amount", 0)
        due_date = bill_doc.get("due_date") or bill_doc.get("received_date", now)
        days_past = (now - due_date).days if due_date else 0

        carrier_oid = bill_doc.get("carrier_id")
        carrier_str = str(carrier_oid) if carrier_oid else "unknown"
        if carrier_str not in carrier_cache:
            carrier_doc = await db.carriers.find_one({"_id": carrier_oid}) if carrier_oid else None
            carrier_cache[carrier_str] = carrier_doc["name"] if carrier_doc else "Unknown Carrier"

        if days_past <= 0:
            bucket_key = "current"
        elif days_past <= 30:
            bucket_key = "1_30"
        elif days_past <= 60:
            bucket_key = "31_60"
        elif days_past <= 90:
            bucket_key = "61_90"
        else:
            bucket_key = "90_plus"

        item = {
            "id": str(bill_doc["_id"]),
            "bill_number": bill_doc.get("bill_number"),
            "carrier_id": carrier_str,
            "carrier_name": carrier_cache[carrier_str],
            "amount": amount,
            "due_date": due_date.isoformat() if due_date else None,
            "days_past_due": max(0, days_past),
            "status": bill_doc.get("status"),
        }

        buckets[bucket_key].total_amount += amount
        buckets[bucket_key].count += 1
        buckets[bucket_key].items.append(item)

        # By carrier
        if carrier_str not in carrier_totals:
            carrier_totals[carrier_str] = {
                "entity_id": carrier_str,
                "entity_name": carrier_cache[carrier_str],
                "total_outstanding": 0,
                "bill_count": 0,
                "current": 0,
                "past_due_1_30": 0,
                "past_due_31_60": 0,
                "past_due_61_90": 0,
                "past_due_90_plus": 0,
            }
        carrier_totals[carrier_str]["total_outstanding"] += amount
        carrier_totals[carrier_str]["bill_count"] += 1
        cf_map = {
            "current": "current",
            "1_30": "past_due_1_30",
            "31_60": "past_due_31_60",
            "61_90": "past_due_61_90",
            "90_plus": "past_due_90_plus",
        }
        carrier_totals[carrier_str][cf_map[bucket_key]] += amount

    # Cash flow projection: next 8 weeks
    projections = []
    for week_offset in range(8):
        week_start = now + timedelta(weeks=week_offset)
        week_end = week_start + timedelta(days=6)
        week_bills = [
            b for b in bills
            if b.get("due_date") and week_start.date() <= b["due_date"].date() <= week_end.date()
        ]
        projections.append(CashFlowProjection(
            week_start=week_start.strftime("%Y-%m-%d"),
            week_end=week_end.strftime("%Y-%m-%d"),
            expected_outflow=sum(b.get("amount", 0) for b in week_bills),
            bill_count=len(week_bills),
        ))

    total_outstanding = sum(b.total_amount for b in buckets.values())
    total_count = sum(b.count for b in buckets.values())

    return PayablesAgingResponse(
        as_of_date=now,
        total_outstanding=total_outstanding,
        total_count=total_count,
        buckets=list(buckets.values()),
        by_carrier=sorted(carrier_totals.values(), key=lambda x: x["total_outstanding"], reverse=True),
        cash_flow_projection=projections,
    )


# ============================================================================
# Quick Pay Options (Feature: 54674d64)
# ============================================================================


class QuickPayTier(BaseModel):
    """A quick pay tier offering."""
    name: str
    days: int
    discount_percent: float
    net_payment: int  # Amount after discount, in cents


class QuickPayOfferResponse(BaseModel):
    """Response for a quick pay offer."""
    id: str
    carrier_id: str
    carrier_name: str
    bill_id: str
    bill_amount: int
    tiers: List[QuickPayTier]
    standard_payment_date: Optional[str] = None
    status: str  # "offered", "accepted", "declined", "expired"
    selected_tier: Optional[str] = None
    savings: Optional[int] = None  # Broker savings in cents


class QuickPayOfferRequest(BaseModel):
    """Request to create a quick pay offer."""
    bill_id: str
    custom_tiers: Optional[List[Dict[str, Any]]] = None


@router.post("/quick-pay-offer/{carrier_id}", response_model=QuickPayOfferResponse)
async def create_quick_pay_offer(carrier_id: str, data: QuickPayOfferRequest):
    """
    Create a quick pay offer for a carrier.
    Offers faster payment in exchange for a discount (e.g., pay in 3 days for 3% discount).
    """
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    bill_doc = await db.carrier_bills.find_one({"_id": ObjectId(data.bill_id)})
    if not bill_doc:
        raise HTTPException(status_code=404, detail="Carrier bill not found")

    bill_amount = bill_doc.get("amount", 0)

    # Default quick pay tiers or use custom
    default_tiers = [
        {"name": "Same Day", "days": 0, "discount_percent": 3.0},
        {"name": "2-Day", "days": 2, "discount_percent": 2.5},
        {"name": "5-Day", "days": 5, "discount_percent": 2.0},
        {"name": "10-Day", "days": 10, "discount_percent": 1.5},
    ]
    tier_configs = data.custom_tiers or default_tiers

    tiers = []
    for t in tier_configs:
        discount = t.get("discount_percent", 0)
        net = int(bill_amount * (1 - discount / 100))
        tiers.append(QuickPayTier(
            name=t.get("name", f"{t.get('days', 0)}-day"),
            days=t.get("days", 0),
            discount_percent=discount,
            net_payment=net,
        ))

    # Calculate standard payment date (Net 30 from received)
    received = bill_doc.get("received_date", utc_now())
    standard_date = (received + timedelta(days=30)).strftime("%Y-%m-%d")

    # Store offer
    offer_doc = {
        "_id": ObjectId(),
        "carrier_id": ObjectId(carrier_id),
        "bill_id": ObjectId(data.bill_id),
        "bill_amount": bill_amount,
        "tiers": [t.model_dump() for t in tiers],
        "standard_payment_date": standard_date,
        "status": "offered",
        "selected_tier": None,
        "savings": None,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.quick_pay_offers.insert_one(offer_doc)

    return QuickPayOfferResponse(
        id=str(offer_doc["_id"]),
        carrier_id=carrier_id,
        carrier_name=carrier.get("name", "Unknown"),
        bill_id=data.bill_id,
        bill_amount=bill_amount,
        tiers=tiers,
        standard_payment_date=standard_date,
        status="offered",
    )


@router.patch("/quick-pay/{offer_id}/accept")
async def accept_quick_pay(offer_id: str, tier_name: str):
    """Accept a quick pay offer with a selected tier."""
    db = get_database()

    offer = await db.quick_pay_offers.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Quick pay offer not found")

    if offer["status"] != "offered":
        raise HTTPException(status_code=400, detail=f"Offer is {offer['status']}, cannot accept")

    # Find selected tier
    selected = None
    for t in offer.get("tiers", []):
        if t["name"] == tier_name:
            selected = t
            break

    if not selected:
        raise HTTPException(status_code=400, detail=f"Tier '{tier_name}' not found in offer")

    savings = offer["bill_amount"] - selected["net_payment"]

    await db.quick_pay_offers.update_one(
        {"_id": ObjectId(offer_id)},
        {"$set": {
            "status": "accepted",
            "selected_tier": tier_name,
            "savings": savings,
            "accepted_at": utc_now(),
            "updated_at": utc_now(),
        }},
    )

    await manager.broadcast("billing:quick_pay_accepted", {
        "offer_id": offer_id,
        "tier": tier_name,
        "savings": savings,
    })

    return {
        "status": "accepted",
        "offer_id": offer_id,
        "selected_tier": tier_name,
        "net_payment": selected["net_payment"],
        "savings": savings,
        "payment_due_date": (utc_now() + timedelta(days=selected["days"])).strftime("%Y-%m-%d"),
    }


@router.get("/quick-pay-offers")
async def list_quick_pay_offers(
    carrier_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """List quick pay offers with optional filters."""
    db = get_database()
    query: Dict[str, Any] = {}
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if status:
        query["status"] = status

    offers = await db.quick_pay_offers.find(query).sort("created_at", -1).to_list(500)

    result = []
    for o in offers:
        carrier = await db.carriers.find_one({"_id": o.get("carrier_id")})
        result.append({
            "id": str(o["_id"]),
            "carrier_id": str(o.get("carrier_id")),
            "carrier_name": carrier.get("name", "Unknown") if carrier else "Unknown",
            "bill_id": str(o.get("bill_id")),
            "bill_amount": o.get("bill_amount", 0),
            "status": o.get("status"),
            "selected_tier": o.get("selected_tier"),
            "savings": o.get("savings"),
            "created_at": o.get("created_at"),
        })

    return result


# ============================================================================
# Factoring Integration (Feature: fe53823c)
# ============================================================================


class FactoringAssignmentRequest(BaseModel):
    """Request to create a factoring assignment."""
    carrier_id: str
    factoring_company_name: str
    factoring_company_id: Optional[str] = None
    noa_reference: Optional[str] = None
    noa_date: Optional[datetime] = None
    payment_email: Optional[str] = None
    payment_address: Optional[str] = None
    fee_percent: Optional[float] = None
    notes: Optional[str] = None


class FactoringAssignmentResponse(BaseModel):
    """Response for a factoring assignment."""
    id: str
    carrier_id: str
    carrier_name: str
    factoring_company_name: str
    factoring_company_id: Optional[str] = None
    noa_reference: Optional[str] = None
    noa_date: Optional[datetime] = None
    noa_status: str  # "pending", "active", "expired", "revoked"
    payment_email: Optional[str] = None
    payment_address: Optional[str] = None
    fee_percent: Optional[float] = None
    total_factored_amount: int = 0
    factored_invoice_count: int = 0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


@router.post("/factoring-assignments", response_model=FactoringAssignmentResponse)
async def create_factoring_assignment(data: FactoringAssignmentRequest):
    """Create or update a factoring assignment (NOA) for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(data.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    now = utc_now()
    doc = {
        "_id": ObjectId(),
        "carrier_id": ObjectId(data.carrier_id),
        "factoring_company_name": data.factoring_company_name,
        "factoring_company_id": data.factoring_company_id,
        "noa_reference": data.noa_reference,
        "noa_date": data.noa_date or now,
        "noa_status": "active",
        "payment_email": data.payment_email,
        "payment_address": data.payment_address,
        "fee_percent": data.fee_percent,
        "total_factored_amount": 0,
        "factored_invoice_count": 0,
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
    }

    await db.factoring_assignments.insert_one(doc)

    return FactoringAssignmentResponse(
        id=str(doc["_id"]),
        carrier_id=data.carrier_id,
        carrier_name=carrier.get("name", "Unknown"),
        factoring_company_name=data.factoring_company_name,
        factoring_company_id=data.factoring_company_id,
        noa_reference=data.noa_reference,
        noa_date=data.noa_date or now,
        noa_status="active",
        payment_email=data.payment_email,
        payment_address=data.payment_address,
        fee_percent=data.fee_percent,
        notes=data.notes,
        created_at=now,
        updated_at=now,
    )


@router.get("/factoring-status")
async def get_factoring_status(carrier_id: Optional[str] = None):
    """Get factoring status for carriers. Shows which carriers have active NOAs."""
    db = get_database()
    query: Dict[str, Any] = {}
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)

    assignments = await db.factoring_assignments.find(query).sort("created_at", -1).to_list(500)

    result = []
    for a in assignments:
        carrier = await db.carriers.find_one({"_id": a.get("carrier_id")})
        result.append({
            "id": str(a["_id"]),
            "carrier_id": str(a.get("carrier_id")),
            "carrier_name": carrier.get("name", "Unknown") if carrier else "Unknown",
            "factoring_company_name": a.get("factoring_company_name"),
            "factoring_company_id": a.get("factoring_company_id"),
            "noa_reference": a.get("noa_reference"),
            "noa_date": a.get("noa_date"),
            "noa_status": a.get("noa_status", "pending"),
            "payment_email": a.get("payment_email"),
            "fee_percent": a.get("fee_percent"),
            "total_factored_amount": a.get("total_factored_amount", 0),
            "factored_invoice_count": a.get("factored_invoice_count", 0),
            "created_at": a.get("created_at"),
        })

    return result


@router.patch("/factoring-assignments/{assignment_id}")
async def update_factoring_assignment(assignment_id: str, noa_status: Optional[str] = None, notes: Optional[str] = None):
    """Update a factoring assignment status (e.g., revoke NOA)."""
    db = get_database()

    assignment = await db.factoring_assignments.find_one({"_id": ObjectId(assignment_id)})
    if not assignment:
        raise HTTPException(status_code=404, detail="Factoring assignment not found")

    update: Dict[str, Any] = {"updated_at": utc_now()}
    if noa_status:
        if noa_status not in ["pending", "active", "expired", "revoked"]:
            raise HTTPException(status_code=400, detail="Invalid NOA status")
        update["noa_status"] = noa_status
    if notes is not None:
        update["notes"] = notes

    await db.factoring_assignments.update_one(
        {"_id": ObjectId(assignment_id)},
        {"$set": update},
    )

    return {"status": "updated", "id": assignment_id}


# ============================================================================
# Carrier Invoice Processing (Feature: b5e12555)
# ============================================================================


class CarrierInvoiceUploadRequest(BaseModel):
    """Request to upload and process a carrier invoice."""
    carrier_id: str
    shipment_id: Optional[str] = None
    invoice_number: Optional[str] = None
    amount: Optional[int] = None  # In cents, from AI extraction
    invoice_date: Optional[datetime] = None
    reference_numbers: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None  # OCR/extracted text
    notes: Optional[str] = None


class CarrierInvoiceResponse(BaseModel):
    """Response for a processed carrier invoice."""
    id: str
    carrier_id: str
    carrier_name: str
    shipment_id: Optional[str] = None
    shipment_number: Optional[str] = None
    invoice_number: Optional[str] = None
    extracted_amount: Optional[int] = None
    matched_amount: Optional[int] = None
    variance: Optional[int] = None
    status: str  # "uploaded", "extracted", "matched", "discrepancy", "approved"
    match_confidence: Optional[float] = None
    discrepancy_flags: List[str] = []
    created_at: datetime


@router.post("/carrier-invoices/upload", response_model=CarrierInvoiceResponse)
async def upload_carrier_invoice(data: CarrierInvoiceUploadRequest):
    """
    Upload a carrier invoice. AI extracts amounts and matches to shipment/rate confirmation.
    Flags discrepancies automatically.
    """
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(data.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Try to auto-match shipment if not provided
    shipment = None
    shipment_number = None
    matched_amount = None
    variance = None
    match_confidence = None
    discrepancy_flags = []
    status = "uploaded"

    if data.shipment_id:
        shipment = await db.shipments.find_one({"_id": ObjectId(data.shipment_id)})
        if shipment:
            shipment_number = shipment.get("shipment_number")
    elif data.reference_numbers:
        # Fuzzy match reference numbers to find shipment
        for ref in data.reference_numbers:
            shipment = await db.shipments.find_one({
                "$or": [
                    {"shipment_number": ref},
                    {"pro_number": ref},
                ]
            })
            if shipment:
                shipment_number = shipment.get("shipment_number")
                data.shipment_id = str(shipment["_id"])
                match_confidence = 0.95
                break

        if not shipment:
            # Try partial match
            for ref in data.reference_numbers:
                shipment = await db.shipments.find_one({
                    "carrier_id": ObjectId(data.carrier_id),
                    "$or": [
                        {"shipment_number": {"$regex": ref, "$options": "i"}},
                        {"pro_number": {"$regex": ref, "$options": "i"}},
                    ],
                })
                if shipment:
                    shipment_number = shipment.get("shipment_number")
                    data.shipment_id = str(shipment["_id"])
                    match_confidence = 0.7
                    break

    # If we have a shipment, check rate confirmation
    if shipment and data.amount:
        status = "extracted"

        # Find accepted tender for rate comparison
        tender = await db.tenders.find_one({
            "shipment_id": shipment["_id"],
            "carrier_id": ObjectId(data.carrier_id),
            "status": "accepted",
        })

        if tender:
            matched_amount = tender.get("offered_rate", 0)
            variance = data.amount - matched_amount

            if abs(variance) <= 100:  # Within $1 tolerance
                status = "matched"
                match_confidence = match_confidence or 1.0
            else:
                status = "discrepancy"
                if variance > 0:
                    discrepancy_flags.append(f"Over-billed by ${variance / 100:.2f}")
                else:
                    discrepancy_flags.append(f"Under-billed by ${abs(variance) / 100:.2f}")

                if data.amount > matched_amount * 1.1:
                    discrepancy_flags.append("Amount exceeds 10% tolerance")

    # Store the carrier invoice record
    now = utc_now()
    doc = {
        "_id": ObjectId(),
        "carrier_id": ObjectId(data.carrier_id),
        "shipment_id": ObjectId(data.shipment_id) if data.shipment_id else None,
        "invoice_number": data.invoice_number,
        "extracted_amount": data.amount,
        "matched_amount": matched_amount,
        "variance": variance,
        "status": status,
        "match_confidence": match_confidence,
        "discrepancy_flags": discrepancy_flags,
        "reference_numbers": data.reference_numbers,
        "raw_text": data.raw_text,
        "notes": data.notes,
        "invoice_date": data.invoice_date,
        "created_at": now,
        "updated_at": now,
    }

    await db.carrier_invoices.insert_one(doc)

    # If matched with no discrepancy, auto-create carrier bill
    if status == "matched" and data.amount and data.shipment_id:
        bill_number = data.invoice_number or f"CI-{str(doc['_id'])[-8:]}"
        bill = CarrierBill(
            carrier_id=ObjectId(data.carrier_id),
            shipment_id=ObjectId(data.shipment_id),
            bill_number=bill_number,
            amount=data.amount,
            received_date=now,
            notes=f"Auto-created from carrier invoice upload. Match confidence: {match_confidence}",
        )
        await db.carrier_bills.insert_one(bill.model_dump_mongo())

    return CarrierInvoiceResponse(
        id=str(doc["_id"]),
        carrier_id=data.carrier_id,
        carrier_name=carrier.get("name", "Unknown"),
        shipment_id=data.shipment_id,
        shipment_number=shipment_number,
        invoice_number=data.invoice_number,
        extracted_amount=data.amount,
        matched_amount=matched_amount,
        variance=variance,
        status=status,
        match_confidence=match_confidence,
        discrepancy_flags=discrepancy_flags,
        created_at=now,
    )


@router.post("/carrier-invoices/{invoice_id}/match")
async def match_carrier_invoice(invoice_id: str):
    """Re-attempt matching a carrier invoice to a shipment and rate confirmation."""
    db = get_database()

    inv_doc = await db.carrier_invoices.find_one({"_id": ObjectId(invoice_id)})
    if not inv_doc:
        raise HTTPException(status_code=404, detail="Carrier invoice not found")

    # Re-run matching logic
    shipment = None
    if inv_doc.get("shipment_id"):
        shipment = await db.shipments.find_one({"_id": inv_doc["shipment_id"]})

    if not shipment and inv_doc.get("reference_numbers"):
        for ref in inv_doc["reference_numbers"]:
            shipment = await db.shipments.find_one({
                "$or": [
                    {"shipment_number": ref},
                    {"pro_number": ref},
                ]
            })
            if shipment:
                break

    if not shipment:
        return {"status": "no_match", "message": "Could not find matching shipment"}

    amount = inv_doc.get("extracted_amount", 0)
    tender = await db.tenders.find_one({
        "shipment_id": shipment["_id"],
        "carrier_id": inv_doc["carrier_id"],
        "status": "accepted",
    })

    update: Dict[str, Any] = {
        "shipment_id": shipment["_id"],
        "updated_at": utc_now(),
    }

    if tender and amount:
        matched_amount = tender.get("offered_rate", 0)
        variance = amount - matched_amount
        update["matched_amount"] = matched_amount
        update["variance"] = variance

        if abs(variance) <= 100:
            update["status"] = "matched"
            update["match_confidence"] = 1.0
            update["discrepancy_flags"] = []
        else:
            update["status"] = "discrepancy"
            flags = []
            if variance > 0:
                flags.append(f"Over-billed by ${variance / 100:.2f}")
            else:
                flags.append(f"Under-billed by ${abs(variance) / 100:.2f}")
            update["discrepancy_flags"] = flags

    await db.carrier_invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": update},
    )

    return {
        "status": update.get("status", "matched"),
        "shipment_id": str(shipment["_id"]),
        "shipment_number": shipment.get("shipment_number"),
        "matched_amount": update.get("matched_amount"),
        "variance": update.get("variance"),
    }


@router.post("/carrier-invoices/{invoice_id}/approve")
async def approve_carrier_invoice(invoice_id: str):
    """One-click approve a matched carrier invoice, creating the carrier bill if needed."""
    db = get_database()

    inv_doc = await db.carrier_invoices.find_one({"_id": ObjectId(invoice_id)})
    if not inv_doc:
        raise HTTPException(status_code=404, detail="Carrier invoice not found")

    if inv_doc.get("status") not in ["matched", "discrepancy", "extracted"]:
        raise HTTPException(status_code=400, detail="Invoice must be matched or reviewed before approval")

    amount = inv_doc.get("extracted_amount", 0)
    shipment_id = inv_doc.get("shipment_id")

    if not shipment_id or not amount:
        raise HTTPException(status_code=400, detail="Cannot approve invoice without shipment and amount")

    # Check if carrier bill already exists
    existing_bill = await db.carrier_bills.find_one({
        "carrier_id": inv_doc["carrier_id"],
        "shipment_id": shipment_id,
    })

    if not existing_bill:
        bill_number = inv_doc.get("invoice_number") or f"CI-{str(inv_doc['_id'])[-8:]}"
        bill = CarrierBill(
            carrier_id=inv_doc["carrier_id"],
            shipment_id=shipment_id,
            bill_number=bill_number,
            amount=amount,
            received_date=utc_now(),
            notes="Approved from carrier invoice processing",
        )
        await db.carrier_bills.insert_one(bill.model_dump_mongo())

    await db.carrier_invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": {"status": "approved", "updated_at": utc_now()}},
    )

    return {"status": "approved", "invoice_id": invoice_id}


@router.get("/carrier-invoices")
async def list_carrier_invoices(
    carrier_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """List carrier invoices with optional filters."""
    db = get_database()
    query: Dict[str, Any] = {}
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if status:
        query["status"] = status

    docs = await db.carrier_invoices.find(query).sort("created_at", -1).to_list(500)

    result = []
    carrier_cache: Dict[str, str] = {}
    for d in docs:
        c_id = str(d.get("carrier_id"))
        if c_id not in carrier_cache:
            carrier = await db.carriers.find_one({"_id": d.get("carrier_id")})
            carrier_cache[c_id] = carrier.get("name", "Unknown") if carrier else "Unknown"

        shipment_number = None
        if d.get("shipment_id"):
            s = await db.shipments.find_one({"_id": d["shipment_id"]})
            if s:
                shipment_number = s.get("shipment_number")

        result.append({
            "id": str(d["_id"]),
            "carrier_id": c_id,
            "carrier_name": carrier_cache[c_id],
            "shipment_id": str(d["shipment_id"]) if d.get("shipment_id") else None,
            "shipment_number": shipment_number,
            "invoice_number": d.get("invoice_number"),
            "extracted_amount": d.get("extracted_amount"),
            "matched_amount": d.get("matched_amount"),
            "variance": d.get("variance"),
            "status": d.get("status"),
            "match_confidence": d.get("match_confidence"),
            "discrepancy_flags": d.get("discrepancy_flags", []),
            "created_at": d.get("created_at"),
        })

    return result


# ============================================================================
# Rate Confirmation Matching (Feature: 3287d6f3)
# ============================================================================


class RateConfirmationMatchResponse(BaseModel):
    """Response for rate confirmation matching."""
    shipment_id: str
    shipment_number: Optional[str] = None
    carrier_id: Optional[str] = None
    carrier_name: Optional[str] = None
    rate_con_amount: Optional[int] = None
    carrier_bill_amount: Optional[int] = None
    variance: Optional[int] = None
    variance_percent: Optional[float] = None
    match_status: str  # "exact_match", "within_tolerance", "over_billed", "under_billed", "no_bill", "no_rate_con"
    flags: List[str] = []
    auto_approved: bool = False


@router.post("/rate-confirmation-match/{shipment_id}", response_model=RateConfirmationMatchResponse)
async def rate_confirmation_match(shipment_id: str, tolerance_cents: int = 100):
    """
    Auto-match carrier invoices/bills against rate confirmations for a shipment.
    Highlights variances and auto-approves within tolerance.
    """
    db = get_database()

    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment_number = shipment.get("shipment_number")
    carrier_id = str(shipment.get("carrier_id", ""))
    carrier_name = None

    if shipment.get("carrier_id"):
        carrier = await db.carriers.find_one({"_id": shipment["carrier_id"]})
        if carrier:
            carrier_name = carrier.get("name")

    # Find accepted tender (= rate confirmation)
    tender = await db.tenders.find_one({
        "shipment_id": ObjectId(shipment_id),
        "status": "accepted",
    })

    if not tender:
        return RateConfirmationMatchResponse(
            shipment_id=shipment_id,
            shipment_number=shipment_number,
            carrier_id=carrier_id,
            carrier_name=carrier_name,
            match_status="no_rate_con",
            flags=["No accepted tender/rate confirmation found"],
        )

    rate_con_amount = tender.get("offered_rate", 0)

    # Find carrier bill
    bill = await db.carrier_bills.find_one({
        "shipment_id": ObjectId(shipment_id),
    })

    if not bill:
        # Check carrier invoices too
        ci = await db.carrier_invoices.find_one({
            "shipment_id": ObjectId(shipment_id),
        })
        if ci and ci.get("extracted_amount"):
            bill = {"amount": ci["extracted_amount"], "_id": ci["_id"]}

    if not bill:
        return RateConfirmationMatchResponse(
            shipment_id=shipment_id,
            shipment_number=shipment_number,
            carrier_id=carrier_id,
            carrier_name=carrier_name,
            rate_con_amount=rate_con_amount,
            match_status="no_bill",
            flags=["No carrier bill found for this shipment"],
        )

    bill_amount = bill.get("amount", 0)
    variance = bill_amount - rate_con_amount
    variance_percent = (abs(variance) / rate_con_amount * 100) if rate_con_amount else 0.0

    flags = []
    auto_approved = False

    if abs(variance) <= tolerance_cents:
        match_status = "exact_match" if variance == 0 else "within_tolerance"
        auto_approved = True
        if variance != 0:
            flags.append(f"Variance of ${abs(variance) / 100:.2f} within tolerance")
    elif variance > 0:
        match_status = "over_billed"
        flags.append(f"Carrier billed ${variance / 100:.2f} MORE than rate confirmation ({variance_percent:.1f}% over)")
        if variance_percent > 10:
            flags.append("Exceeds 10% threshold - requires review")
    else:
        match_status = "under_billed"
        flags.append(f"Carrier billed ${abs(variance) / 100:.2f} LESS than rate confirmation ({variance_percent:.1f}% under)")

    # Auto-approve if within tolerance
    if auto_approved and bill.get("_id"):
        bill_doc = await db.carrier_bills.find_one({"_id": bill["_id"]})
        if bill_doc and bill_doc.get("status") in ["received", "matched"]:
            await db.carrier_bills.update_one(
                {"_id": bill["_id"]},
                {"$set": {
                    "status": "approved",
                    "approved_by": "auto_rate_match",
                    "matched_tender_id": tender["_id"],
                    "variance_amount": variance,
                    "updated_at": utc_now(),
                }},
            )
            flags.append("Auto-approved based on rate confirmation match")

    return RateConfirmationMatchResponse(
        shipment_id=shipment_id,
        shipment_number=shipment_number,
        carrier_id=carrier_id,
        carrier_name=carrier_name,
        rate_con_amount=rate_con_amount,
        carrier_bill_amount=bill_amount,
        variance=variance,
        variance_percent=round(variance_percent, 1),
        match_status=match_status,
        flags=flags,
        auto_approved=auto_approved,
    )
