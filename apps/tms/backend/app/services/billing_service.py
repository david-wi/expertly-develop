"""Billing service for invoice generation and carrier bill matching."""

import logging
from datetime import timedelta
from typing import Optional, Dict, Any

from bson import ObjectId

from app.database import get_database
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.carrier_bill import CarrierBill, CarrierBillStatus
from app.services.number_generator import NumberGenerator
from app.models.base import utc_now

logger = logging.getLogger(__name__)


class MatchResult:
    """Result of attempting to match a carrier bill to a tender."""

    def __init__(
        self,
        matched: bool,
        tender_id: Optional[str] = None,
        tender_rate: Optional[int] = None,
        variance_amount: Optional[int] = None,
        variance_reason: Optional[str] = None,
        message: str = "",
    ):
        self.matched = matched
        self.tender_id = tender_id
        self.tender_rate = tender_rate
        self.variance_amount = variance_amount
        self.variance_reason = variance_reason
        self.message = message


async def generate_invoice_from_shipment(shipment_id: str) -> Invoice:
    """
    Generate a customer invoice from a delivered shipment.

    Args:
        shipment_id: The shipment ID to generate an invoice for

    Returns:
        The created Invoice

    Raises:
        ValueError: If shipment not found, not delivered, or customer not found
    """
    db = get_database()

    # Load shipment
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise ValueError("Shipment not found")

    if shipment["status"] != "delivered":
        raise ValueError("Can only invoice delivered shipments")

    # Check for existing invoice
    existing = await db.invoices.find_one({"shipment_ids": ObjectId(shipment_id)})
    if existing:
        raise ValueError(f"Invoice already exists for this shipment: {existing.get('invoice_number', 'unknown')}")

    # Load customer
    customer = await db.customers.find_one({"_id": shipment["customer_id"]})
    if not customer:
        raise ValueError("Customer not found for shipment")

    # Generate invoice number
    invoice_number = await NumberGenerator.get_next_invoice_number()

    # Build line item from shipment stops
    origin = shipment["stops"][0] if shipment.get("stops") else {}
    dest = shipment["stops"][-1] if shipment.get("stops") and len(shipment["stops"]) > 1 else {}

    description = (
        f"Freight: {origin.get('city', 'Origin')}, {origin.get('state', '')} "
        f"-> {dest.get('city', 'Dest')}, {dest.get('state', '')}"
    )

    line_item = InvoiceLineItem(
        description=description,
        quantity=1,
        unit_price=shipment.get("customer_price", 0),
        shipment_id=str(shipment["_id"]),
    )

    # Create invoice
    payment_terms = customer.get("payment_terms", 30)
    now = utc_now()

    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=shipment["customer_id"],
        shipment_ids=[ObjectId(shipment_id)],
        billing_name=customer["name"],
        billing_email=customer.get("billing_email"),
        billing_address=customer.get("address_line1"),
        line_items=[line_item],
        invoice_date=now,
        due_date=now + timedelta(days=payment_terms),
    )
    invoice.calculate_totals()

    await db.invoices.insert_one(invoice.model_dump_mongo())

    logger.info(
        "Generated invoice %s for shipment %s (total: $%.2f)",
        invoice_number, shipment_id, invoice.total / 100,
    )

    return invoice


async def match_carrier_bill(bill_id: str) -> MatchResult:
    """
    Attempt to match a carrier bill to an accepted tender.

    Finds the tender by matching carrier_id + shipment_id, then compares amounts
    to detect variances.

    Args:
        bill_id: The carrier bill ID to match

    Returns:
        MatchResult with match details
    """
    db = get_database()

    # Load the carrier bill
    bill_doc = await db.carrier_bills.find_one({"_id": ObjectId(bill_id)})
    if not bill_doc:
        return MatchResult(matched=False, message="Carrier bill not found")

    bill = CarrierBill(**bill_doc)

    # Find matching accepted tender
    tender = await db.tenders.find_one({
        "carrier_id": bill.carrier_id,
        "shipment_id": bill.shipment_id,
        "status": "accepted",
    })

    if not tender:
        return MatchResult(
            matched=False,
            message="No accepted tender found for this carrier and shipment",
        )

    # Compare amounts
    tender_rate = tender["offered_rate"]
    variance = bill.amount - tender_rate
    variance_reason = None

    if variance != 0:
        pct = abs(variance) / tender_rate * 100 if tender_rate else 0
        if variance > 0:
            variance_reason = f"Carrier billed ${variance / 100:.2f} more than tender ({pct:.1f}% over)"
        else:
            variance_reason = f"Carrier billed ${abs(variance) / 100:.2f} less than tender ({pct:.1f}% under)"

    # Update the bill with match info
    update_data = {
        "matched_tender_id": tender["_id"],
        "variance_amount": variance,
        "variance_reason": variance_reason,
        "status": CarrierBillStatus.MATCHED.value,
        "updated_at": utc_now(),
    }
    await db.carrier_bills.update_one(
        {"_id": ObjectId(bill_id)},
        {"$set": update_data},
    )

    logger.info(
        "Matched carrier bill %s to tender %s (variance: $%.2f)",
        bill_id, str(tender["_id"]), variance / 100,
    )

    return MatchResult(
        matched=True,
        tender_id=str(tender["_id"]),
        tender_rate=tender_rate,
        variance_amount=variance,
        variance_reason=variance_reason,
        message="Successfully matched to tender",
    )


async def get_billing_summary() -> Dict[str, Any]:
    """
    Get a summary of billing data: AR, AP, revenue, cost, margin.

    Returns:
        Dict with billing summary data
    """
    db = get_database()

    # Outstanding AR: unpaid customer invoices (draft, pending, sent, partial)
    ar_pipeline = [
        {"$match": {"status": {"$in": ["draft", "pending", "sent", "partial"]}}},
        {"$group": {
            "_id": None,
            "total_outstanding": {"$sum": "$total"},
            "total_paid": {"$sum": "$amount_paid"},
            "count": {"$sum": 1},
        }},
    ]
    ar_result = await db.invoices.aggregate(ar_pipeline).to_list(1)
    ar_data = ar_result[0] if ar_result else {"total_outstanding": 0, "total_paid": 0, "count": 0}
    ar_net = ar_data["total_outstanding"] - ar_data["total_paid"]

    # Outstanding AP: unpaid carrier bills (received, matched, disputed, approved)
    ap_pipeline = [
        {"$match": {"status": {"$in": ["received", "matched", "disputed", "approved"]}}},
        {"$group": {
            "_id": None,
            "total_outstanding": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    ap_result = await db.carrier_bills.aggregate(ap_pipeline).to_list(1)
    ap_data = ap_result[0] if ap_result else {"total_outstanding": 0, "count": 0}

    # Revenue: all paid invoices
    revenue_pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$total"},
            "count": {"$sum": 1},
        }},
    ]
    revenue_result = await db.invoices.aggregate(revenue_pipeline).to_list(1)
    revenue_data = revenue_result[0] if revenue_result else {"total": 0, "count": 0}

    # Cost: all paid carrier bills
    cost_pipeline = [
        {"$match": {"status": "paid"}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    cost_result = await db.carrier_bills.aggregate(cost_pipeline).to_list(1)
    cost_data = cost_result[0] if cost_result else {"total": 0, "count": 0}

    revenue = revenue_data["total"]
    cost = cost_data["total"]
    margin = revenue - cost
    margin_percent = (margin / revenue * 100) if revenue > 0 else 0

    return {
        "outstanding_ar": ar_net,
        "outstanding_ar_count": ar_data["count"],
        "outstanding_ap": ap_data["total_outstanding"],
        "outstanding_ap_count": ap_data["count"],
        "revenue": revenue,
        "revenue_invoice_count": revenue_data["count"],
        "cost": cost,
        "cost_bill_count": cost_data["count"],
        "margin": margin,
        "margin_percent": round(margin_percent, 1),
    }
