"""Carrier Payables API endpoints.

Dedicated endpoints for managing carrier accounts payable:
- Payables Aging Reports (Feature: 51bea3ab)
- Quick Pay Options (Feature: 54674d64)
- Factoring Integration / NOA Tracking (Feature: fe53823c)
- Carrier Invoice Processing with AI/OCR (Feature: b5e12555)
- Rate Confirmation Matching (Feature: 3287d6f3)
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId

from app.database import get_database
from app.models.carrier_bill import CarrierBill, CarrierBillStatus
from app.models.base import utc_now
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class AgingBucket(BaseModel):
    """An aging bucket with bill details."""
    bucket: str
    label: str
    total_amount: int = 0
    count: int = 0
    items: List[Dict[str, Any]] = []


class CashFlowProjection(BaseModel):
    """Weekly cash flow projection."""
    week_start: str
    week_end: str
    expected_outflow: int
    bill_count: int


class PayablesAgingReportResponse(BaseModel):
    """AP aging report with cash flow projection and carrier breakdown."""
    report_type: str = "ap"
    as_of_date: datetime
    total_outstanding: int
    total_count: int
    buckets: List[AgingBucket]
    by_carrier: List[Dict[str, Any]] = []
    cash_flow_projection: List[CashFlowProjection] = []


class CarrierPayableBillResponse(BaseModel):
    """Response model for a carrier payable bill."""
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
    carrier_name: Optional[str] = None
    shipment_number: Optional[str] = None
    # Factoring info
    is_factored: bool = False
    factor_company: Optional[str] = None
    factor_payment_email: Optional[str] = None


class CarrierPayableBillCreate(BaseModel):
    """Create a carrier payable bill from a carrier invoice."""
    carrier_id: str
    shipment_id: Optional[str] = None
    bill_number: str
    amount: int  # In cents
    received_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    invoice_number: Optional[str] = None
    reference_numbers: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None
    notes: Optional[str] = None


class QuickPayTier(BaseModel):
    """A quick pay tier."""
    name: str
    days: int
    discount_percent: float
    net_payment: int


class QuickPayRequest(BaseModel):
    """Request to create or accept quick pay."""
    tier_name: Optional[str] = None
    custom_tiers: Optional[List[Dict[str, Any]]] = None


class QuickPayOfferResponse(BaseModel):
    """Response for a quick pay offer."""
    id: str
    carrier_id: str
    carrier_name: str
    bill_id: str
    bill_number: Optional[str] = None
    bill_amount: int
    tiers: List[QuickPayTier]
    standard_payment_date: Optional[str] = None
    status: str
    selected_tier: Optional[str] = None
    savings: Optional[int] = None
    created_at: Optional[datetime] = None


class FactoringAssignmentCreate(BaseModel):
    """Create a factoring assignment (NOA) for a carrier."""
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
    noa_status: str
    payment_email: Optional[str] = None
    payment_address: Optional[str] = None
    fee_percent: Optional[float] = None
    total_factored_amount: int = 0
    factored_invoice_count: int = 0
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class CarrierInvoiceUploadRequest(BaseModel):
    """Request to upload and process a carrier invoice via AI/OCR."""
    carrier_id: str
    shipment_id: Optional[str] = None
    invoice_number: Optional[str] = None
    amount: Optional[int] = None
    invoice_date: Optional[datetime] = None
    reference_numbers: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None
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
    status: str
    match_confidence: Optional[float] = None
    discrepancy_flags: List[str] = []
    created_at: datetime


class RateConfirmationMatchResponse(BaseModel):
    """Response for rate confirmation matching."""
    bill_id: str
    shipment_id: str
    shipment_number: Optional[str] = None
    carrier_id: Optional[str] = None
    carrier_name: Optional[str] = None
    rate_con_amount: Optional[int] = None
    carrier_bill_amount: Optional[int] = None
    variance: Optional[int] = None
    variance_percent: Optional[float] = None
    match_status: str
    flags: List[str] = []
    auto_approved: bool = False


class PayablesDashboardResponse(BaseModel):
    """Summary dashboard for carrier payables."""
    total_outstanding: int
    total_bill_count: int
    approved_pending_payment: int
    approved_pending_count: int
    quick_pay_savings_ytd: int
    factored_carrier_count: int
    unmatched_invoices: int
    disputed_bills: int
    avg_days_to_pay: Optional[float] = None


# ============================================================================
# Helpers
# ============================================================================


async def _bill_to_response(doc: dict) -> CarrierPayableBillResponse:
    """Convert a MongoDB carrier bill document to response with enrichment."""
    db = get_database()

    carrier_name = None
    shipment_number = None
    is_factored = False
    factor_company = None
    factor_payment_email = None

    if doc.get("carrier_id"):
        carrier = await db.carriers.find_one({"_id": doc["carrier_id"]})
        if carrier:
            carrier_name = carrier.get("name")

        # Check if carrier has active factoring assignment
        factoring = await db.factoring_assignments.find_one({
            "carrier_id": doc["carrier_id"],
            "noa_status": "active",
        })
        if factoring:
            is_factored = True
            factor_company = factoring.get("factoring_company_name")
            factor_payment_email = factoring.get("payment_email")

    if doc.get("shipment_id"):
        shipment = await db.shipments.find_one({"_id": doc["shipment_id"]})
        if shipment:
            shipment_number = shipment.get("shipment_number")

    return CarrierPayableBillResponse(
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
        created_at=doc.get("created_at", utc_now()),
        updated_at=doc.get("updated_at", utc_now()),
        carrier_name=carrier_name,
        shipment_number=shipment_number,
        is_factored=is_factored,
        factor_company=factor_company,
        factor_payment_email=factor_payment_email,
    )


# ============================================================================
# Payables Dashboard
# ============================================================================


@router.get("/dashboard", response_model=PayablesDashboardResponse)
async def get_payables_dashboard():
    """Get carrier payables dashboard summary."""
    db = get_database()
    now = utc_now()

    # Total outstanding (not paid)
    outstanding_bills = await db.carrier_bills.find(
        {"status": {"$in": ["received", "matched", "disputed", "approved"]}}
    ).to_list(5000)

    total_outstanding = sum(b.get("amount", 0) for b in outstanding_bills)
    total_count = len(outstanding_bills)

    # Approved pending payment
    approved_bills = [b for b in outstanding_bills if b.get("status") == "approved"]
    approved_pending = sum(b.get("amount", 0) for b in approved_bills)

    # Quick pay savings YTD
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    qp_offers = await db.quick_pay_offers.find({
        "status": "accepted",
        "accepted_at": {"$gte": year_start},
    }).to_list(5000)
    quick_pay_savings = sum(o.get("savings", 0) for o in qp_offers)

    # Factored carrier count
    factored_count = await db.factoring_assignments.count_documents({"noa_status": "active"})

    # Unmatched invoices
    unmatched = await db.carrier_invoices.count_documents({
        "status": {"$in": ["uploaded", "extracted"]},
    })

    # Disputed bills
    disputed = len([b for b in outstanding_bills if b.get("status") == "disputed"])

    # Average days to pay
    paid_bills = await db.carrier_bills.find({
        "status": "paid",
        "paid_at": {"$gte": year_start},
    }).to_list(5000)

    avg_days = None
    if paid_bills:
        days_list = []
        for b in paid_bills:
            if b.get("paid_at") and b.get("received_date"):
                delta = (b["paid_at"] - b["received_date"]).days
                days_list.append(delta)
        if days_list:
            avg_days = round(sum(days_list) / len(days_list), 1)

    return PayablesDashboardResponse(
        total_outstanding=total_outstanding,
        total_bill_count=total_count,
        approved_pending_payment=approved_pending,
        approved_pending_count=len(approved_bills),
        quick_pay_savings_ytd=quick_pay_savings,
        factored_carrier_count=factored_count,
        unmatched_invoices=unmatched,
        disputed_bills=disputed,
        avg_days_to_pay=avg_days,
    )


# ============================================================================
# Payables Aging Report (Feature: 51bea3ab)
# ============================================================================


@router.get("/aging-report", response_model=PayablesAgingReportResponse)
async def get_payables_aging_report(carrier_id: Optional[str] = None):
    """
    Get AP aging report by bucket: Current, 1-30, 31-60, 61-90, 90+ days.
    Includes carrier-level breakdown and 8-week cash flow projection.
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

    return PayablesAgingReportResponse(
        as_of_date=now,
        total_outstanding=total_outstanding,
        total_count=total_count,
        buckets=list(buckets.values()),
        by_carrier=sorted(carrier_totals.values(), key=lambda x: x["total_outstanding"], reverse=True),
        cash_flow_projection=projections,
    )


# ============================================================================
# Carrier Payable Bills (list, create, approve)
# ============================================================================


@router.get("/bills", response_model=List[CarrierPayableBillResponse])
async def list_carrier_payable_bills(
    status: Optional[CarrierBillStatus] = None,
    carrier_id: Optional[str] = None,
    shipment_id: Optional[str] = None,
):
    """List carrier payable bills with optional filters. Includes factoring status."""
    db = get_database()

    query: Dict[str, Any] = {}
    if status:
        query["status"] = status.value
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)

    cursor = db.carrier_bills.find(query).sort("created_at", -1)
    bills = await cursor.to_list(1000)

    return [await _bill_to_response(b) for b in bills]


@router.post("/bills", response_model=CarrierPayableBillResponse)
async def create_carrier_payable_bill(data: CarrierPayableBillCreate):
    """
    Create a carrier payable bill. Supports AI/OCR-extracted data.
    If reference_numbers are provided, attempts auto-match to shipment.
    """
    db = get_database()

    # Validate carrier
    carrier = await db.carriers.find_one({"_id": ObjectId(data.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Auto-match shipment from reference numbers if no shipment_id
    shipment_id = data.shipment_id
    if not shipment_id and data.reference_numbers:
        for ref in data.reference_numbers:
            shipment = await db.shipments.find_one({
                "$or": [
                    {"shipment_number": ref},
                    {"pro_number": ref},
                ]
            })
            if shipment:
                shipment_id = str(shipment["_id"])
                break

        if not shipment_id:
            for ref in data.reference_numbers:
                shipment = await db.shipments.find_one({
                    "carrier_id": ObjectId(data.carrier_id),
                    "$or": [
                        {"shipment_number": {"$regex": ref, "$options": "i"}},
                        {"pro_number": {"$regex": ref, "$options": "i"}},
                    ],
                })
                if shipment:
                    shipment_id = str(shipment["_id"])
                    break

    if not shipment_id:
        raise HTTPException(
            status_code=400,
            detail="Shipment not found. Provide a valid shipment_id or reference numbers.",
        )

    # Validate shipment exists
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    bill = CarrierBill(
        carrier_id=ObjectId(data.carrier_id),
        shipment_id=ObjectId(shipment_id),
        bill_number=data.bill_number,
        amount=data.amount,
        received_date=data.received_date or utc_now(),
        due_date=data.due_date,
        notes=data.notes,
    )

    await db.carrier_bills.insert_one(bill.model_dump_mongo())
    bill_doc = await db.carrier_bills.find_one({"_id": bill.id})

    await manager.broadcast("carrier_payables:bill_created", {
        "id": str(bill.id),
        "bill_number": data.bill_number,
        "amount": data.amount,
    })

    return await _bill_to_response(bill_doc)


@router.post("/bills/{bill_id}/approve", response_model=CarrierPayableBillResponse)
async def approve_carrier_payable_bill(bill_id: str, approved_by: Optional[str] = None):
    """Approve a carrier bill for payment. Checks factoring status for payment routing."""
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

    await manager.broadcast("carrier_payables:bill_approved", {
        "id": bill_id,
        "bill_number": bill.bill_number,
    })

    return await _bill_to_response(updated)


# ============================================================================
# Quick Pay Options (Feature: 54674d64)
# ============================================================================


@router.post("/bills/{bill_id}/quick-pay", response_model=QuickPayOfferResponse)
async def create_quick_pay_for_bill(bill_id: str, data: QuickPayRequest):
    """
    Create a quick pay offer for a specific carrier bill.
    Carriers get faster payment in exchange for a discount.
    Default tiers: Same Day (3%), 2-Day (2.5%), 5-Day (2%), 10-Day (1.5%).
    """
    db = get_database()

    bill_doc = await db.carrier_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill_doc:
        raise HTTPException(status_code=404, detail="Carrier bill not found")

    if bill_doc["status"] not in ["matched", "approved"]:
        raise HTTPException(status_code=400, detail="Bill must be matched or approved for quick pay")

    carrier = await db.carriers.find_one({"_id": bill_doc["carrier_id"]})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    bill_amount = bill_doc.get("amount", 0)

    # Default quick pay tiers
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

    received = bill_doc.get("received_date", utc_now())
    standard_date = (received + timedelta(days=30)).strftime("%Y-%m-%d")

    now = utc_now()
    offer_doc = {
        "_id": ObjectId(),
        "carrier_id": bill_doc["carrier_id"],
        "bill_id": ObjectId(bill_id),
        "bill_amount": bill_amount,
        "tiers": [t.model_dump() for t in tiers],
        "standard_payment_date": standard_date,
        "status": "offered",
        "selected_tier": None,
        "savings": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.quick_pay_offers.insert_one(offer_doc)

    await manager.broadcast("carrier_payables:quick_pay_offered", {
        "offer_id": str(offer_doc["_id"]),
        "bill_id": bill_id,
        "carrier": carrier.get("name"),
    })

    return QuickPayOfferResponse(
        id=str(offer_doc["_id"]),
        carrier_id=str(bill_doc["carrier_id"]),
        carrier_name=carrier.get("name", "Unknown"),
        bill_id=bill_id,
        bill_number=bill_doc.get("bill_number"),
        bill_amount=bill_amount,
        tiers=tiers,
        standard_payment_date=standard_date,
        status="offered",
        created_at=now,
    )


@router.patch("/quick-pay/{offer_id}/accept")
async def accept_quick_pay_offer(offer_id: str, tier_name: str):
    """Accept a quick pay offer with a selected tier."""
    db = get_database()

    offer = await db.quick_pay_offers.find_one({"_id": ObjectId(offer_id)})
    if not offer:
        raise HTTPException(status_code=404, detail="Quick pay offer not found")

    if offer["status"] != "offered":
        raise HTTPException(status_code=400, detail=f"Offer is {offer['status']}, cannot accept")

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

    await manager.broadcast("carrier_payables:quick_pay_accepted", {
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


@router.get("/quick-pay-offers", response_model=List[QuickPayOfferResponse])
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
    carrier_cache: Dict[str, str] = {}
    for o in offers:
        c_id = str(o.get("carrier_id"))
        if c_id not in carrier_cache:
            carrier = await db.carriers.find_one({"_id": o.get("carrier_id")})
            carrier_cache[c_id] = carrier.get("name", "Unknown") if carrier else "Unknown"

        # Get bill number
        bill_number = None
        if o.get("bill_id"):
            bill = await db.carrier_bills.find_one({"_id": o["bill_id"]})
            if bill:
                bill_number = bill.get("bill_number")

        tiers = [QuickPayTier(**t) for t in o.get("tiers", [])]
        result.append(QuickPayOfferResponse(
            id=str(o["_id"]),
            carrier_id=c_id,
            carrier_name=carrier_cache[c_id],
            bill_id=str(o.get("bill_id")),
            bill_number=bill_number,
            bill_amount=o.get("bill_amount", 0),
            tiers=tiers,
            standard_payment_date=o.get("standard_payment_date"),
            status=o.get("status", "offered"),
            selected_tier=o.get("selected_tier"),
            savings=o.get("savings"),
            created_at=o.get("created_at"),
        ))

    return result


# ============================================================================
# Factoring Integration (Feature: fe53823c)
# ============================================================================


@router.get("/factoring", response_model=List[FactoringAssignmentResponse])
async def list_factoring_assignments(carrier_id: Optional[str] = None):
    """List factoring assignments (NOAs). Shows which carriers have active factoring."""
    db = get_database()
    query: Dict[str, Any] = {}
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)

    assignments = await db.factoring_assignments.find(query).sort("created_at", -1).to_list(500)

    result = []
    for a in assignments:
        carrier = await db.carriers.find_one({"_id": a.get("carrier_id")})
        result.append(FactoringAssignmentResponse(
            id=str(a["_id"]),
            carrier_id=str(a.get("carrier_id")),
            carrier_name=carrier.get("name", "Unknown") if carrier else "Unknown",
            factoring_company_name=a.get("factoring_company_name", ""),
            factoring_company_id=a.get("factoring_company_id"),
            noa_reference=a.get("noa_reference"),
            noa_date=a.get("noa_date"),
            noa_status=a.get("noa_status", "pending"),
            payment_email=a.get("payment_email"),
            payment_address=a.get("payment_address"),
            fee_percent=a.get("fee_percent"),
            total_factored_amount=a.get("total_factored_amount", 0),
            factored_invoice_count=a.get("factored_invoice_count", 0),
            notes=a.get("notes"),
            created_at=a.get("created_at", utc_now()),
            updated_at=a.get("updated_at", utc_now()),
        ))

    return result


@router.post("/factoring", response_model=FactoringAssignmentResponse)
async def create_factoring_assignment(data: FactoringAssignmentCreate):
    """Create or update a factoring assignment (NOA) for a carrier."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(data.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    # Check for existing active NOA
    existing = await db.factoring_assignments.find_one({
        "carrier_id": ObjectId(data.carrier_id),
        "noa_status": "active",
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Carrier already has active NOA with {existing.get('factoring_company_name')}. Revoke it first.",
        )

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

    await manager.broadcast("carrier_payables:factoring_created", {
        "carrier": carrier.get("name"),
        "factor": data.factoring_company_name,
    })

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


@router.patch("/factoring/{assignment_id}")
async def update_factoring_assignment(
    assignment_id: str,
    noa_status: Optional[str] = None,
    notes: Optional[str] = None,
):
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


@router.post("/invoices/upload", response_model=CarrierInvoiceResponse)
async def upload_carrier_invoice(data: CarrierInvoiceUploadRequest):
    """
    Upload a carrier invoice for AI/OCR processing.
    Extracts amounts, auto-matches to shipment/rate confirmation, and flags discrepancies.
    """
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(data.carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    shipment = None
    shipment_number = None
    matched_amount = None
    variance = None
    match_confidence = None
    discrepancy_flags: List[str] = []
    status = "uploaded"

    if data.shipment_id:
        shipment = await db.shipments.find_one({"_id": ObjectId(data.shipment_id)})
        if shipment:
            shipment_number = shipment.get("shipment_number")
    elif data.reference_numbers:
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

    # Rate confirmation matching
    if shipment and data.amount:
        status = "extracted"

        tender = await db.tenders.find_one({
            "shipment_id": shipment["_id"],
            "carrier_id": ObjectId(data.carrier_id),
            "status": "accepted",
        })

        if tender:
            matched_amount = tender.get("offered_rate", 0)
            variance = data.amount - matched_amount

            if abs(variance) <= 100:
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

    # Auto-create carrier bill if matched cleanly
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

    await manager.broadcast("carrier_payables:invoice_processed", {
        "id": str(doc["_id"]),
        "status": status,
        "carrier": carrier.get("name"),
    })

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


@router.get("/invoices", response_model=List[CarrierInvoiceResponse])
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

        result.append(CarrierInvoiceResponse(
            id=str(d["_id"]),
            carrier_id=c_id,
            carrier_name=carrier_cache[c_id],
            shipment_id=str(d["shipment_id"]) if d.get("shipment_id") else None,
            shipment_number=shipment_number,
            invoice_number=d.get("invoice_number"),
            extracted_amount=d.get("extracted_amount"),
            matched_amount=d.get("matched_amount"),
            variance=d.get("variance"),
            status=d.get("status", "uploaded"),
            match_confidence=d.get("match_confidence"),
            discrepancy_flags=d.get("discrepancy_flags", []),
            created_at=d.get("created_at", utc_now()),
        ))

    return result


# ============================================================================
# Rate Confirmation Matching (Feature: 3287d6f3)
# ============================================================================


@router.post("/bills/{bill_id}/match-rate-con", response_model=RateConfirmationMatchResponse)
async def match_rate_confirmation(bill_id: str, tolerance_cents: int = 100):
    """
    Match a carrier bill against the rate confirmation (accepted tender).
    Auto-approves if within tolerance. Flags discrepancies for review.
    """
    db = get_database()

    bill_doc = await db.carrier_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill_doc:
        raise HTTPException(status_code=404, detail="Carrier bill not found")

    shipment_id = bill_doc.get("shipment_id")
    if not shipment_id:
        raise HTTPException(status_code=400, detail="Bill has no shipment linked")

    shipment = await db.shipments.find_one({"_id": shipment_id})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment_number = shipment.get("shipment_number")
    carrier_id = str(bill_doc.get("carrier_id", ""))
    carrier_name = None

    if bill_doc.get("carrier_id"):
        carrier = await db.carriers.find_one({"_id": bill_doc["carrier_id"]})
        if carrier:
            carrier_name = carrier.get("name")

    # Find accepted tender = rate confirmation
    tender = await db.tenders.find_one({
        "shipment_id": shipment_id,
        "status": "accepted",
    })

    if not tender:
        return RateConfirmationMatchResponse(
            bill_id=bill_id,
            shipment_id=str(shipment_id),
            shipment_number=shipment_number,
            carrier_id=carrier_id,
            carrier_name=carrier_name,
            carrier_bill_amount=bill_doc.get("amount"),
            match_status="no_rate_con",
            flags=["No accepted tender/rate confirmation found"],
        )

    rate_con_amount = tender.get("offered_rate", 0)
    bill_amount = bill_doc.get("amount", 0)
    variance = bill_amount - rate_con_amount
    variance_percent = (abs(variance) / rate_con_amount * 100) if rate_con_amount else 0.0

    flags: List[str] = []
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
    if auto_approved and bill_doc.get("status") in ["received", "matched"]:
        await db.carrier_bills.update_one(
            {"_id": ObjectId(bill_id)},
            {"$set": {
                "status": "approved",
                "approved_by": "auto_rate_match",
                "matched_tender_id": tender["_id"],
                "variance_amount": variance,
                "updated_at": utc_now(),
            }},
        )
        flags.append("Auto-approved based on rate confirmation match")
    elif not auto_approved:
        # Update bill with variance info even if not auto-approved
        await db.carrier_bills.update_one(
            {"_id": ObjectId(bill_id)},
            {"$set": {
                "matched_tender_id": tender["_id"],
                "variance_amount": variance,
                "variance_reason": "; ".join(flags),
                "status": "disputed" if bill_doc.get("status") == "received" else bill_doc.get("status"),
                "updated_at": utc_now(),
            }},
        )

    return RateConfirmationMatchResponse(
        bill_id=bill_id,
        shipment_id=str(shipment_id),
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
