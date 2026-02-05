"""
Customs API - Manage customs entries and commercial invoices.

Provides endpoints for:
- Creating and managing customs entries
- Generating commercial invoices
- Tracking clearance status
"""

from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import get_database
from app.models.customs import (
    CustomsEntry,
    CustomsEntryStatus,
    CustomsEntryType,
    CustomsLineItem,
    CommercialInvoice,
)

router = APIRouter()


# FastAPI dependency wrapper for database
def get_db():
    """Get database as FastAPI dependency."""
    return get_database()


# ============== Pydantic Schemas ==============

class CustomsLineItemSchema(BaseModel):
    description: str
    quantity: int
    unit_of_measure: str
    unit_value_cents: int
    total_value_cents: int
    country_of_origin: str
    hs_code: Optional[str] = None
    hs_code_description: Optional[str] = None
    weight_kg: Optional[float] = None
    manufacturer: Optional[str] = None


class CustomsEntryCreate(BaseModel):
    shipment_id: Optional[str] = None
    entry_type: str = "import"
    importer_of_record: Optional[str] = None
    importer_ein: Optional[str] = None
    consignee_name: Optional[str] = None
    consignee_address: Optional[str] = None
    exporter_name: Optional[str] = None
    exporter_address: Optional[str] = None
    exporter_country: Optional[str] = None
    port_of_entry: Optional[str] = None
    mode_of_transport: Optional[str] = None
    line_items: List[CustomsLineItemSchema] = []
    notes: Optional[str] = None


class CustomsEntryUpdate(BaseModel):
    status: Optional[str] = None
    customs_reference: Optional[str] = None
    broker_reference: Optional[str] = None
    importer_of_record: Optional[str] = None
    importer_ein: Optional[str] = None
    port_of_entry: Optional[str] = None
    estimated_arrival: Optional[str] = None
    line_items: Optional[List[CustomsLineItemSchema]] = None
    estimated_duty_cents: Optional[int] = None
    actual_duty_cents: Optional[int] = None
    notes: Optional[str] = None
    hold_reason: Optional[str] = None


class CustomsEntryResponse(BaseModel):
    id: str
    entry_number: str
    customs_reference: Optional[str] = None
    broker_reference: Optional[str] = None
    entry_type: str
    status: str
    shipment_id: Optional[str] = None
    importer_of_record: Optional[str] = None
    consignee_name: Optional[str] = None
    exporter_name: Optional[str] = None
    port_of_entry: Optional[str] = None
    estimated_arrival: Optional[str] = None
    actual_arrival: Optional[str] = None
    clearance_date: Optional[str] = None
    total_declared_value_cents: int
    estimated_duty_cents: int
    actual_duty_cents: Optional[int] = None
    line_items: List[dict] = []
    notes: Optional[str] = None
    hold_reason: Optional[str] = None
    created_at: Optional[str] = None


class CommercialInvoiceCreate(BaseModel):
    shipment_id: Optional[str] = None
    customs_entry_id: Optional[str] = None
    seller_name: str
    seller_address: Optional[str] = None
    seller_country: str
    buyer_name: str
    buyer_address: Optional[str] = None
    buyer_country: str
    country_of_origin: str
    country_of_destination: str
    line_items: List[CustomsLineItemSchema] = []
    freight_cents: int = 0
    insurance_cents: int = 0
    incoterms: Optional[str] = None


class CommercialInvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    invoice_date: str
    shipment_id: Optional[str] = None
    customs_entry_id: Optional[str] = None
    seller_name: str
    seller_country: str
    buyer_name: str
    buyer_country: str
    total_cents: int
    currency: str
    incoterms: Optional[str] = None
    line_items: List[dict] = []
    created_at: Optional[str] = None


# ============== Helper Functions ==============

def generate_entry_number() -> str:
    """Generate a unique customs entry number."""
    import random
    import string
    suffix = ''.join(random.choices(string.digits, k=6))
    return f"CE-{datetime.utcnow().strftime('%Y%m%d')}-{suffix}"


def generate_invoice_number() -> str:
    """Generate a unique commercial invoice number."""
    import random
    import string
    suffix = ''.join(random.choices(string.digits, k=6))
    return f"CI-{datetime.utcnow().strftime('%Y%m%d')}-{suffix}"


def serialize_customs_entry(entry: dict) -> CustomsEntryResponse:
    """Convert MongoDB document to response schema."""
    return CustomsEntryResponse(
        id=str(entry["_id"]),
        entry_number=entry.get("entry_number", ""),
        customs_reference=entry.get("customs_reference"),
        broker_reference=entry.get("broker_reference"),
        entry_type=entry.get("entry_type", "import"),
        status=entry.get("status", "draft"),
        shipment_id=str(entry["shipment_id"]) if entry.get("shipment_id") else None,
        importer_of_record=entry.get("importer_of_record"),
        consignee_name=entry.get("consignee_name"),
        exporter_name=entry.get("exporter_name"),
        port_of_entry=entry.get("port_of_entry"),
        estimated_arrival=entry["estimated_arrival"].isoformat() if entry.get("estimated_arrival") else None,
        actual_arrival=entry["actual_arrival"].isoformat() if entry.get("actual_arrival") else None,
        clearance_date=entry["clearance_date"].isoformat() if entry.get("clearance_date") else None,
        total_declared_value_cents=entry.get("total_declared_value_cents", 0),
        estimated_duty_cents=entry.get("estimated_duty_cents", 0),
        actual_duty_cents=entry.get("actual_duty_cents"),
        line_items=entry.get("line_items", []),
        notes=entry.get("notes"),
        hold_reason=entry.get("hold_reason"),
        created_at=entry["created_at"].isoformat() if entry.get("created_at") else None,
    )


def serialize_commercial_invoice(invoice: dict) -> CommercialInvoiceResponse:
    """Convert MongoDB document to response schema."""
    return CommercialInvoiceResponse(
        id=str(invoice["_id"]),
        invoice_number=invoice.get("invoice_number", ""),
        invoice_date=invoice["invoice_date"].isoformat() if invoice.get("invoice_date") else "",
        shipment_id=str(invoice["shipment_id"]) if invoice.get("shipment_id") else None,
        customs_entry_id=str(invoice["customs_entry_id"]) if invoice.get("customs_entry_id") else None,
        seller_name=invoice.get("seller_name", ""),
        seller_country=invoice.get("seller_country", ""),
        buyer_name=invoice.get("buyer_name", ""),
        buyer_country=invoice.get("buyer_country", ""),
        total_cents=invoice.get("total_cents", 0),
        currency=invoice.get("currency", "USD"),
        incoterms=invoice.get("incoterms"),
        line_items=invoice.get("line_items", []),
        created_at=invoice["created_at"].isoformat() if invoice.get("created_at") else None,
    )


# ============== Customs Entry Endpoints ==============

@router.get("", response_model=List[CustomsEntryResponse])
async def list_customs_entries(
    status: Optional[str] = None,
    shipment_id: Optional[str] = None,
    entry_type: Optional[str] = None,
    limit: int = 50,
    db=Depends(get_db),
):
    """List customs entries with optional filters."""
    query = {}
    if status:
        query["status"] = status
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if entry_type:
        query["entry_type"] = entry_type

    cursor = db.customs_entries.find(query).sort("created_at", -1).limit(limit)
    entries = await cursor.to_list(length=limit)

    return [serialize_customs_entry(entry) for entry in entries]


@router.get("/{entry_id}", response_model=CustomsEntryResponse)
async def get_customs_entry(entry_id: str, db=Depends(get_db)):
    """Get a single customs entry by ID."""
    entry = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Customs entry not found")

    return serialize_customs_entry(entry)


@router.post("", response_model=CustomsEntryResponse)
async def create_customs_entry(
    data: CustomsEntryCreate,
    db=Depends(get_db),
):
    """Create a new customs entry."""
    # Calculate total declared value from line items
    total_value = sum(item.total_value_cents for item in data.line_items)

    entry_doc = {
        "entry_number": generate_entry_number(),
        "entry_type": data.entry_type,
        "status": CustomsEntryStatus.DRAFT.value,
        "shipment_id": ObjectId(data.shipment_id) if data.shipment_id else None,
        "importer_of_record": data.importer_of_record,
        "importer_ein": data.importer_ein,
        "consignee_name": data.consignee_name,
        "consignee_address": data.consignee_address,
        "exporter_name": data.exporter_name,
        "exporter_address": data.exporter_address,
        "exporter_country": data.exporter_country,
        "port_of_entry": data.port_of_entry,
        "mode_of_transport": data.mode_of_transport,
        "line_items": [item.model_dump() for item in data.line_items],
        "total_declared_value_cents": total_value,
        "estimated_duty_cents": 0,
        "notes": data.notes,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.customs_entries.insert_one(entry_doc)
    entry_doc["_id"] = result.inserted_id

    return serialize_customs_entry(entry_doc)


@router.patch("/{entry_id}", response_model=CustomsEntryResponse)
async def update_customs_entry(
    entry_id: str,
    data: CustomsEntryUpdate,
    db=Depends(get_db),
):
    """Update a customs entry."""
    entry = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Customs entry not found")

    update_data = {"updated_at": datetime.utcnow()}

    if data.status:
        update_data["status"] = data.status
        if data.status == "cleared":
            update_data["clearance_date"] = datetime.utcnow()
    if data.customs_reference is not None:
        update_data["customs_reference"] = data.customs_reference
    if data.broker_reference is not None:
        update_data["broker_reference"] = data.broker_reference
    if data.importer_of_record is not None:
        update_data["importer_of_record"] = data.importer_of_record
    if data.importer_ein is not None:
        update_data["importer_ein"] = data.importer_ein
    if data.port_of_entry is not None:
        update_data["port_of_entry"] = data.port_of_entry
    if data.estimated_arrival is not None:
        update_data["estimated_arrival"] = datetime.fromisoformat(data.estimated_arrival)
    if data.estimated_duty_cents is not None:
        update_data["estimated_duty_cents"] = data.estimated_duty_cents
    if data.actual_duty_cents is not None:
        update_data["actual_duty_cents"] = data.actual_duty_cents
    if data.notes is not None:
        update_data["notes"] = data.notes
    if data.hold_reason is not None:
        update_data["hold_reason"] = data.hold_reason
    if data.line_items is not None:
        update_data["line_items"] = [item.model_dump() for item in data.line_items]
        update_data["total_declared_value_cents"] = sum(item.total_value_cents for item in data.line_items)

    await db.customs_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": update_data}
    )

    updated = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    return serialize_customs_entry(updated)


@router.post("/{entry_id}/submit")
async def submit_customs_entry(entry_id: str, db=Depends(get_db)):
    """Submit a customs entry for processing."""
    entry = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Customs entry not found")

    if entry.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Entry must be in draft status to submit")

    await db.customs_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {
            "status": CustomsEntryStatus.SUBMITTED.value,
            "submitted_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )

    updated = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    return serialize_customs_entry(updated)


@router.post("/{entry_id}/clear")
async def clear_customs_entry(entry_id: str, db=Depends(get_db)):
    """Mark a customs entry as cleared."""
    entry = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Customs entry not found")

    await db.customs_entries.update_one(
        {"_id": ObjectId(entry_id)},
        {"$set": {
            "status": CustomsEntryStatus.CLEARED.value,
            "clearance_date": datetime.utcnow(),
            "cleared_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }}
    )

    updated = await db.customs_entries.find_one({"_id": ObjectId(entry_id)})
    return serialize_customs_entry(updated)


# ============== Commercial Invoice Endpoints ==============

@router.get("/invoices", response_model=List[CommercialInvoiceResponse])
async def list_commercial_invoices(
    shipment_id: Optional[str] = None,
    customs_entry_id: Optional[str] = None,
    limit: int = 50,
    db=Depends(get_db),
):
    """List commercial invoices."""
    query = {}
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if customs_entry_id:
        query["customs_entry_id"] = ObjectId(customs_entry_id)

    cursor = db.commercial_invoices.find(query).sort("created_at", -1).limit(limit)
    invoices = await cursor.to_list(length=limit)

    return [serialize_commercial_invoice(inv) for inv in invoices]


@router.get("/invoices/{invoice_id}", response_model=CommercialInvoiceResponse)
async def get_commercial_invoice(invoice_id: str, db=Depends(get_db)):
    """Get a commercial invoice by ID."""
    invoice = await db.commercial_invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Commercial invoice not found")

    return serialize_commercial_invoice(invoice)


@router.post("/invoices", response_model=CommercialInvoiceResponse)
async def create_commercial_invoice(
    data: CommercialInvoiceCreate,
    db=Depends(get_db),
):
    """Create a new commercial invoice."""
    # Calculate totals
    subtotal = sum(item.total_value_cents for item in data.line_items)
    total = subtotal + data.freight_cents + data.insurance_cents

    invoice_doc = {
        "invoice_number": generate_invoice_number(),
        "invoice_date": datetime.utcnow(),
        "shipment_id": ObjectId(data.shipment_id) if data.shipment_id else None,
        "customs_entry_id": ObjectId(data.customs_entry_id) if data.customs_entry_id else None,
        "seller_name": data.seller_name,
        "seller_address": data.seller_address,
        "seller_country": data.seller_country,
        "buyer_name": data.buyer_name,
        "buyer_address": data.buyer_address,
        "buyer_country": data.buyer_country,
        "country_of_origin": data.country_of_origin,
        "country_of_destination": data.country_of_destination,
        "line_items": [item.model_dump() for item in data.line_items],
        "subtotal_cents": subtotal,
        "freight_cents": data.freight_cents,
        "insurance_cents": data.insurance_cents,
        "total_cents": total,
        "currency": "USD",
        "incoterms": data.incoterms,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.commercial_invoices.insert_one(invoice_doc)
    invoice_doc["_id"] = result.inserted_id

    return serialize_commercial_invoice(invoice_doc)


@router.post("/invoices/from-shipment/{shipment_id}", response_model=CommercialInvoiceResponse)
async def generate_invoice_from_shipment(shipment_id: str, db=Depends(get_db)):
    """Generate a commercial invoice from shipment data."""
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Get customer info
    customer = None
    if shipment.get("customer_id"):
        customer = await db.customers.find_one({"_id": shipment["customer_id"]})

    # Build invoice from shipment data
    invoice_doc = {
        "invoice_number": generate_invoice_number(),
        "invoice_date": datetime.utcnow(),
        "shipment_id": ObjectId(shipment_id),
        "seller_name": customer.get("company_name", "TBD") if customer else "TBD",
        "seller_address": customer.get("address", "") if customer else "",
        "seller_country": "US",  # Default
        "buyer_name": shipment.get("consignee_name", "TBD"),
        "buyer_address": f"{shipment.get('destination_city', '')}, {shipment.get('destination_state', '')}",
        "buyer_country": "US",  # Default
        "country_of_origin": "US",
        "country_of_destination": "US",
        "line_items": [{
            "description": shipment.get("commodity", "General Freight"),
            "quantity": 1,
            "unit_of_measure": "LOT",
            "unit_value_cents": shipment.get("customer_price", 0),
            "total_value_cents": shipment.get("customer_price", 0),
            "country_of_origin": "US",
            "weight_kg": (shipment.get("weight_lbs", 0) * 0.453592) if shipment.get("weight_lbs") else None,
        }],
        "subtotal_cents": shipment.get("customer_price", 0),
        "freight_cents": 0,
        "insurance_cents": 0,
        "total_cents": shipment.get("customer_price", 0),
        "currency": "USD",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.commercial_invoices.insert_one(invoice_doc)
    invoice_doc["_id"] = result.inserted_id

    return serialize_commercial_invoice(invoice_doc)
