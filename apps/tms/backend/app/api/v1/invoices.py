from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.invoice import Invoice, InvoiceStatus, InvoicePayment
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoicePaymentCreate
from app.services.number_generator import NumberGenerator

router = APIRouter()


def invoice_to_response(invoice: Invoice) -> InvoiceResponse:
    return InvoiceResponse(
        id=str(invoice.id),
        invoice_number=invoice.invoice_number,
        customer_id=str(invoice.customer_id),
        shipment_ids=[str(s) for s in invoice.shipment_ids],
        status=invoice.status,
        invoice_date=invoice.invoice_date,
        due_date=invoice.due_date,
        sent_at=invoice.sent_at,
        billing_name=invoice.billing_name,
        billing_email=invoice.billing_email,
        billing_address=invoice.billing_address,
        line_items=invoice.line_items,
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        total=invoice.total,
        amount_paid=invoice.amount_paid,
        amount_due=invoice.amount_due,
        payments=invoice.payments,
        notes=invoice.notes,
        internal_notes=invoice.internal_notes,
        created_by=invoice.created_by,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
    )


@router.get("", response_model=List[InvoiceResponse])
async def list_invoices(
    status: Optional[InvoiceStatus] = None,
    customer_id: Optional[str] = None,
):
    """List invoices with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)

    cursor = db.invoices.find(query).sort("invoice_date", -1)
    invoices = await cursor.to_list(1000)

    return [invoice_to_response(Invoice(**i)) for i in invoices]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str):
    """Get an invoice by ID."""
    db = get_database()

    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return invoice_to_response(Invoice(**invoice))


@router.post("", response_model=InvoiceResponse)
async def create_invoice(data: InvoiceCreate):
    """Create a new invoice."""
    db = get_database()

    invoice_data = data.model_dump()
    invoice_data["customer_id"] = ObjectId(invoice_data["customer_id"])
    invoice_data["shipment_ids"] = [ObjectId(s) for s in invoice_data["shipment_ids"]]

    # Generate invoice number
    invoice_number = await NumberGenerator.get_next_invoice_number()
    invoice_data["invoice_number"] = invoice_number

    # Set defaults
    if not invoice_data.get("invoice_date"):
        invoice_data["invoice_date"] = datetime.utcnow()
    if not invoice_data.get("due_date"):
        # Get customer payment terms
        customer = await db.customers.find_one({"_id": invoice_data["customer_id"]})
        terms = customer.get("payment_terms", 30) if customer else 30
        invoice_data["due_date"] = invoice_data["invoice_date"] + timedelta(days=terms)

    invoice = Invoice(**invoice_data)
    invoice.calculate_totals()

    await db.invoices.insert_one(invoice.model_dump_mongo())

    return invoice_to_response(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(invoice_id: str, data: InvoiceUpdate):
    """Update an invoice."""
    db = get_database()

    invoice_doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice_doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = Invoice(**invoice_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != invoice.status:
            invoice.transition_to(new_status)

    for field, value in update_data.items():
        setattr(invoice, field, value)

    # Recalculate if line items changed
    if "line_items" in update_data or "tax_amount" in update_data:
        invoice.calculate_totals()
    else:
        invoice.mark_updated()

    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": invoice.model_dump_mongo()}
    )

    return invoice_to_response(invoice)


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(invoice_id: str):
    """Mark an invoice as sent."""
    db = get_database()

    invoice_doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice_doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = Invoice(**invoice_doc)
    invoice.transition_to(InvoiceStatus.SENT)

    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": invoice.model_dump_mongo()}
    )

    return invoice_to_response(invoice)


@router.post("/{invoice_id}/payment", response_model=InvoiceResponse)
async def record_payment(invoice_id: str, data: InvoicePaymentCreate):
    """Record a payment on an invoice."""
    db = get_database()

    invoice_doc = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice_doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice = Invoice(**invoice_doc)

    payment = InvoicePayment(
        amount=data.amount,
        payment_date=data.payment_date,
        payment_method=data.payment_method,
        reference_number=data.reference_number,
        notes=data.notes,
    )

    invoice.add_payment(payment)

    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": invoice.model_dump_mongo()}
    )

    return invoice_to_response(invoice)


@router.get("/aging-report")
async def get_invoice_aging_report(customer_id: Optional[str] = None):
    """
    Get AR aging report from invoices endpoint.
    Redirects to the billing aging-report endpoint logic.
    Buckets: Current, 30, 60, 90, 120+ days.
    """
    from app.models.base import utc_now as _utc_now
    db = get_database()
    now = _utc_now()

    query = {"status": {"$in": ["sent", "partial"]}}
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)

    invoices_list = await db.invoices.find(query).sort("due_date", 1).to_list(5000)

    buckets = {
        "current": {"label": "Current", "total": 0, "count": 0},
        "1_30": {"label": "1-30 Days", "total": 0, "count": 0},
        "31_60": {"label": "31-60 Days", "total": 0, "count": 0},
        "61_90": {"label": "61-90 Days", "total": 0, "count": 0},
        "91_120": {"label": "91-120 Days", "total": 0, "count": 0},
        "120_plus": {"label": "120+ Days", "total": 0, "count": 0},
    }

    for inv_doc in invoices_list:
        inv = Invoice(**inv_doc)
        amount_due = inv.amount_due
        if amount_due <= 0:
            continue

        due_date = inv.due_date or inv.invoice_date
        days_past = (now - due_date).days if due_date else 0

        if days_past <= 0:
            key = "current"
        elif days_past <= 30:
            key = "1_30"
        elif days_past <= 60:
            key = "31_60"
        elif days_past <= 90:
            key = "61_90"
        elif days_past <= 120:
            key = "91_120"
        else:
            key = "120_plus"

        buckets[key]["total"] += amount_due
        buckets[key]["count"] += 1

    return {
        "as_of_date": now.isoformat(),
        "total_outstanding": sum(b["total"] for b in buckets.values()),
        "buckets": buckets,
    }


@router.post("/auto-from-pod/{shipment_id}", response_model=InvoiceResponse)
async def auto_invoice_from_pod_via_invoices(shipment_id: str):
    """
    Auto-generate invoice from POD via the invoices endpoint.
    Delegates to the billing auto-from-pod logic.
    """
    from app.api.v1.billing import auto_invoice_from_pod
    result = await auto_invoice_from_pod(shipment_id)

    # Re-read the created invoice to return full InvoiceResponse
    invoice_doc = await get_database().invoices.find_one({"_id": ObjectId(result.id)})
    if not invoice_doc:
        raise HTTPException(status_code=500, detail="Invoice created but not found")

    return invoice_to_response(Invoice(**invoice_doc))


@router.post("/from-shipment/{shipment_id}", response_model=InvoiceResponse)
async def create_invoice_from_shipment(shipment_id: str):
    """Create an invoice from a delivered shipment."""
    db = get_database()
    from app.models.invoice import InvoiceLineItem

    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    if shipment["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Can only invoice delivered shipments")

    # Get customer
    customer = await db.customers.find_one({"_id": shipment["customer_id"]})
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")

    # Generate invoice number
    invoice_number = await NumberGenerator.get_next_invoice_number()

    # Create line item from shipment
    origin = shipment["stops"][0] if shipment.get("stops") else {}
    dest = shipment["stops"][-1] if shipment.get("stops") and len(shipment["stops"]) > 1 else {}

    line_item = InvoiceLineItem(
        description=f"Freight: {origin.get('city', 'Origin')}, {origin.get('state', '')} → {dest.get('city', 'Dest')}, {dest.get('state', '')}",
        quantity=1,
        unit_price=shipment.get("customer_price", 0),
        shipment_id=str(shipment["_id"]),
    )

    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=shipment["customer_id"],
        shipment_ids=[ObjectId(shipment_id)],
        billing_name=customer["name"],
        billing_email=customer.get("billing_email"),
        line_items=[line_item],
    )
    invoice.calculate_totals()

    # Set due date based on customer terms
    invoice.due_date = invoice.invoice_date + timedelta(days=customer.get("payment_terms", 30))

    await db.invoices.insert_one(invoice.model_dump_mongo())

    return invoice_to_response(invoice)
