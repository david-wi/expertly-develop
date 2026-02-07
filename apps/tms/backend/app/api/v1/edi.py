"""EDI API endpoints for managing trading partners and EDI messages."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.edi_message import EDIMessage, EDIMessageType, EDIDirection, EDIMessageStatus
from app.models.edi_trading_partner import EDITradingPartner, ConnectionType
from app.services.edi_parser import parse_edi_message, generate_997_acknowledgment
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class TradingPartnerCreate(BaseModel):
    """Create a new trading partner."""
    partner_name: str
    partner_code: Optional[str] = None
    isa_id: str
    isa_qualifier: str = "ZZ"
    gs_id: str
    supported_message_types: list[str] = []
    connection_type: str = "sftp"
    connection_config: dict = {}
    is_active: bool = True
    element_separator: str = "*"
    segment_terminator: str = "~"
    sub_element_separator: str = ":"
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class TradingPartnerUpdate(BaseModel):
    """Update a trading partner."""
    partner_name: Optional[str] = None
    partner_code: Optional[str] = None
    isa_id: Optional[str] = None
    isa_qualifier: Optional[str] = None
    gs_id: Optional[str] = None
    supported_message_types: Optional[list[str]] = None
    connection_type: Optional[str] = None
    connection_config: Optional[dict] = None
    is_active: Optional[bool] = None
    element_separator: Optional[str] = None
    segment_terminator: Optional[str] = None
    sub_element_separator: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class TradingPartnerResponse(BaseModel):
    """Response model for a trading partner."""
    id: str
    partner_name: str
    partner_code: Optional[str] = None
    isa_id: str
    isa_qualifier: str
    gs_id: str
    supported_message_types: list[str]
    connection_type: str
    connection_config: dict
    is_active: bool
    element_separator: str
    segment_terminator: str
    sub_element_separator: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class EDIMessageCreate(BaseModel):
    """Submit an EDI message for processing."""
    raw_content: str
    message_type: Optional[str] = None  # Auto-detect if not provided
    direction: str = "inbound"
    trading_partner_id: Optional[str] = None
    shipment_id: Optional[str] = None


class EDIMessageResponse(BaseModel):
    """Response model for an EDI message."""
    id: str
    message_type: str
    direction: str
    status: str
    raw_content: str
    parsed_data: Optional[dict] = None
    trading_partner_id: Optional[str] = None
    shipment_id: Optional[str] = None
    isa_control_number: Optional[str] = None
    gs_control_number: Optional[str] = None
    st_control_number: Optional[str] = None
    error_messages: list[str]
    acknowledged_at: Optional[datetime] = None
    functional_ack_status: Optional[str] = None
    processed_at: Optional[datetime] = None
    processing_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Enriched
    trading_partner_name: Optional[str] = None


class EDIParsePreview(BaseModel):
    """Preview parsed EDI content without saving."""
    raw_content: str
    message_type: Optional[str] = None
    element_separator: str = "*"
    segment_terminator: str = "~"


class EDIGenerateRequest(BaseModel):
    """Request to generate an outbound EDI message."""
    message_type: str
    trading_partner_id: str
    shipment_id: Optional[str] = None
    data: dict = {}


# ============================================================================
# Helpers
# ============================================================================


def partner_to_response(doc: dict) -> TradingPartnerResponse:
    """Convert a MongoDB document to a TradingPartnerResponse."""
    return TradingPartnerResponse(
        id=str(doc["_id"]),
        partner_name=doc["partner_name"],
        partner_code=doc.get("partner_code"),
        isa_id=doc["isa_id"],
        isa_qualifier=doc.get("isa_qualifier", "ZZ"),
        gs_id=doc["gs_id"],
        supported_message_types=doc.get("supported_message_types", []),
        connection_type=doc.get("connection_type", "sftp"),
        connection_config=doc.get("connection_config", {}),
        is_active=doc.get("is_active", True),
        element_separator=doc.get("element_separator", "*"),
        segment_terminator=doc.get("segment_terminator", "~"),
        sub_element_separator=doc.get("sub_element_separator", ":"),
        contact_name=doc.get("contact_name"),
        contact_email=doc.get("contact_email"),
        contact_phone=doc.get("contact_phone"),
        notes=doc.get("notes"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


async def message_to_response(doc: dict) -> EDIMessageResponse:
    """Convert a MongoDB document to an EDIMessageResponse with enrichment."""
    db = get_database()

    trading_partner_name = None
    if doc.get("trading_partner_id"):
        partner = await db.edi_trading_partners.find_one({"_id": doc["trading_partner_id"]})
        if partner:
            trading_partner_name = partner.get("partner_name")

    return EDIMessageResponse(
        id=str(doc["_id"]),
        message_type=doc["message_type"],
        direction=doc["direction"],
        status=doc["status"],
        raw_content=doc["raw_content"],
        parsed_data=doc.get("parsed_data"),
        trading_partner_id=str(doc["trading_partner_id"]) if doc.get("trading_partner_id") else None,
        shipment_id=str(doc["shipment_id"]) if doc.get("shipment_id") else None,
        isa_control_number=doc.get("isa_control_number"),
        gs_control_number=doc.get("gs_control_number"),
        st_control_number=doc.get("st_control_number"),
        error_messages=doc.get("error_messages", []),
        acknowledged_at=doc.get("acknowledged_at"),
        functional_ack_status=doc.get("functional_ack_status"),
        processed_at=doc.get("processed_at"),
        processing_notes=doc.get("processing_notes"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
        trading_partner_name=trading_partner_name,
    )


# ============================================================================
# Trading Partner CRUD
# ============================================================================


@router.get("/trading-partners", response_model=List[TradingPartnerResponse])
async def list_trading_partners(is_active: Optional[bool] = None):
    """List all trading partners with optional active filter."""
    db = get_database()

    query: dict = {}
    if is_active is not None:
        query["is_active"] = is_active

    cursor = db.edi_trading_partners.find(query).sort("partner_name", 1)
    partners = await cursor.to_list(1000)

    return [partner_to_response(p) for p in partners]


@router.post("/trading-partners", response_model=TradingPartnerResponse)
async def create_trading_partner(data: TradingPartnerCreate):
    """Create a new trading partner."""
    db = get_database()

    partner = EDITradingPartner(
        partner_name=data.partner_name,
        partner_code=data.partner_code,
        isa_id=data.isa_id,
        isa_qualifier=data.isa_qualifier,
        gs_id=data.gs_id,
        supported_message_types=data.supported_message_types,
        connection_type=ConnectionType(data.connection_type),
        connection_config=data.connection_config,
        is_active=data.is_active,
        element_separator=data.element_separator,
        segment_terminator=data.segment_terminator,
        sub_element_separator=data.sub_element_separator,
        contact_name=data.contact_name,
        contact_email=data.contact_email,
        contact_phone=data.contact_phone,
        notes=data.notes,
    )

    await db.edi_trading_partners.insert_one(partner.model_dump_mongo())
    doc = await db.edi_trading_partners.find_one({"_id": partner.id})
    return partner_to_response(doc)


@router.get("/trading-partners/{partner_id}", response_model=TradingPartnerResponse)
async def get_trading_partner(partner_id: str):
    """Get a specific trading partner."""
    db = get_database()
    doc = await db.edi_trading_partners.find_one({"_id": ObjectId(partner_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Trading partner not found")
    return partner_to_response(doc)


@router.patch("/trading-partners/{partner_id}", response_model=TradingPartnerResponse)
async def update_trading_partner(partner_id: str, data: TradingPartnerUpdate):
    """Update a trading partner."""
    db = get_database()

    doc = await db.edi_trading_partners.find_one({"_id": ObjectId(partner_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Trading partner not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = utc_now()

    await db.edi_trading_partners.update_one(
        {"_id": ObjectId(partner_id)},
        {"$set": update_data},
    )

    updated = await db.edi_trading_partners.find_one({"_id": ObjectId(partner_id)})
    return partner_to_response(updated)


@router.delete("/trading-partners/{partner_id}")
async def delete_trading_partner(partner_id: str):
    """Delete a trading partner."""
    db = get_database()
    result = await db.edi_trading_partners.delete_one({"_id": ObjectId(partner_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trading partner not found")
    return {"status": "deleted", "id": partner_id}


# ============================================================================
# EDI Messages
# ============================================================================


@router.get("/messages", response_model=List[EDIMessageResponse])
async def list_edi_messages(
    message_type: Optional[str] = None,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    trading_partner_id: Optional[str] = None,
    shipment_id: Optional[str] = None,
    limit: int = 100,
):
    """List EDI messages with filters."""
    db = get_database()

    query: dict = {}
    if message_type:
        query["message_type"] = message_type
    if direction:
        query["direction"] = direction
    if status:
        query["status"] = status
    if trading_partner_id:
        query["trading_partner_id"] = ObjectId(trading_partner_id)
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)

    cursor = db.edi_messages.find(query).sort("created_at", -1).limit(limit)
    messages = await cursor.to_list(limit)

    return [await message_to_response(m) for m in messages]


@router.post("/messages", response_model=EDIMessageResponse)
async def receive_edi_message(data: EDIMessageCreate):
    """Receive and process an EDI message."""
    db = get_database()

    # Look up trading partner for separator config
    element_sep = "*"
    segment_term = "~"
    if data.trading_partner_id:
        partner = await db.edi_trading_partners.find_one({"_id": ObjectId(data.trading_partner_id)})
        if partner:
            element_sep = partner.get("element_separator", "*")
            segment_term = partner.get("segment_terminator", "~")

    # Parse the message
    parsed = parse_edi_message(
        data.raw_content,
        message_type=data.message_type,
        element_separator=element_sep,
        segment_terminator=segment_term,
    )

    # Determine message type from parse result
    detected_type = parsed.get("transaction_type") or data.message_type
    if not detected_type:
        raise HTTPException(status_code=400, detail="Could not determine EDI message type")

    error_messages = []
    if "error" in parsed:
        error_messages.append(parsed["error"])

    status = EDIMessageStatus.PARSED if not error_messages else EDIMessageStatus.ERROR

    # Extract control numbers from envelope
    envelope = parsed.get("envelope", {})

    message = EDIMessage(
        message_type=EDIMessageType(detected_type),
        direction=EDIDirection(data.direction),
        status=status,
        raw_content=data.raw_content,
        parsed_data=parsed,
        trading_partner_id=ObjectId(data.trading_partner_id) if data.trading_partner_id else None,
        shipment_id=ObjectId(data.shipment_id) if data.shipment_id else None,
        isa_control_number=envelope.get("isa_control_number"),
        gs_control_number=envelope.get("gs_control_number"),
        st_control_number=envelope.get("st_control_number"),
        error_messages=error_messages,
    )

    await db.edi_messages.insert_one(message.model_dump_mongo())
    doc = await db.edi_messages.find_one({"_id": message.id})
    return await message_to_response(doc)


@router.get("/messages/{message_id}", response_model=EDIMessageResponse)
async def get_edi_message(message_id: str):
    """Get a specific EDI message."""
    db = get_database()
    doc = await db.edi_messages.find_one({"_id": ObjectId(message_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="EDI message not found")
    return await message_to_response(doc)


@router.post("/messages/{message_id}/reparse", response_model=EDIMessageResponse)
async def reparse_edi_message(message_id: str):
    """Reparse an existing EDI message."""
    db = get_database()
    doc = await db.edi_messages.find_one({"_id": ObjectId(message_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="EDI message not found")

    # Look up partner for separators
    element_sep = "*"
    segment_term = "~"
    if doc.get("trading_partner_id"):
        partner = await db.edi_trading_partners.find_one({"_id": doc["trading_partner_id"]})
        if partner:
            element_sep = partner.get("element_separator", "*")
            segment_term = partner.get("segment_terminator", "~")

    parsed = parse_edi_message(
        doc["raw_content"],
        message_type=doc["message_type"],
        element_separator=element_sep,
        segment_terminator=segment_term,
    )

    error_messages = []
    if "error" in parsed:
        error_messages.append(parsed["error"])

    status = EDIMessageStatus.PARSED.value if not error_messages else EDIMessageStatus.ERROR.value

    await db.edi_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {
            "parsed_data": parsed,
            "error_messages": error_messages,
            "status": status,
            "updated_at": utc_now(),
        }},
    )

    updated = await db.edi_messages.find_one({"_id": ObjectId(message_id)})
    return await message_to_response(updated)


@router.post("/messages/{message_id}/acknowledge")
async def acknowledge_edi_message(message_id: str, accept: bool = True):
    """Generate a 997 functional acknowledgment for a received message."""
    db = get_database()
    doc = await db.edi_messages.find_one({"_id": ObjectId(message_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="EDI message not found")

    if doc["direction"] != "inbound":
        raise HTTPException(status_code=400, detail="Can only acknowledge inbound messages")

    parsed_data = doc.get("parsed_data", {})
    ack_content = generate_997_acknowledgment(
        parsed_data,
        accept=accept,
    )

    ack_status = "A" if accept else "R"

    await db.edi_messages.update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {
            "acknowledged_at": utc_now(),
            "functional_ack_status": ack_status,
            "status": EDIMessageStatus.ACKNOWLEDGED.value if accept else EDIMessageStatus.REJECTED.value,
            "updated_at": utc_now(),
        }},
    )

    return {
        "status": "acknowledged",
        "ack_status": ack_status,
        "ack_content": ack_content,
    }


@router.post("/parse-preview")
async def parse_preview(data: EDIParsePreview):
    """Preview parsed EDI content without saving to the database."""
    parsed = parse_edi_message(
        data.raw_content,
        message_type=data.message_type,
        element_separator=data.element_separator,
        segment_terminator=data.segment_terminator,
    )
    return parsed


# ============================================================================
# Message Statistics
# ============================================================================


@router.get("/stats")
async def get_edi_stats():
    """Get EDI message statistics."""
    db = get_database()

    total = await db.edi_messages.count_documents({})
    by_type = {}
    for msg_type in ["204", "214", "210", "990"]:
        by_type[msg_type] = await db.edi_messages.count_documents({"message_type": msg_type})

    by_status = {}
    for status in ["received", "parsed", "processed", "error", "acknowledged", "rejected"]:
        by_status[status] = await db.edi_messages.count_documents({"status": status})

    by_direction = {
        "inbound": await db.edi_messages.count_documents({"direction": "inbound"}),
        "outbound": await db.edi_messages.count_documents({"direction": "outbound"}),
    }

    partner_count = await db.edi_trading_partners.count_documents({"is_active": True})

    return {
        "total_messages": total,
        "by_type": by_type,
        "by_status": by_status,
        "by_direction": by_direction,
        "active_trading_partners": partner_count,
    }


# ============================================================================
# EDI 210 - Motor Carrier Freight Invoice
# ============================================================================


class EDI210GenerateRequest(BaseModel):
    """Request to generate an EDI 210 invoice from a TMS invoice."""
    trading_partner_id: Optional[str] = None
    auto_send: bool = False


class EDI210StatusResponse(BaseModel):
    """Response for EDI 210 transmission status."""
    invoice_id: str
    edi_message_id: Optional[str] = None
    status: str
    trading_partner_name: Optional[str] = None
    generated_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    error_messages: list[str] = []


@router.post("/generate-210/{invoice_id}", response_model=EDIMessageResponse)
async def generate_edi_210(invoice_id: str, data: EDI210GenerateRequest = EDI210GenerateRequest()):
    """
    Generate an EDI 210 (Motor Carrier Freight Invoice) from a TMS invoice.

    Creates a properly formatted EDI 210 message from an existing invoice,
    optionally linked to a trading partner for auto-send capability.
    """
    db = get_database()

    # Look up the invoice
    invoice = await db.invoices.find_one({"_id": ObjectId(invoice_id)})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Look up trading partner if specified, otherwise find one matching the customer
    trading_partner_id = None
    partner_name = None
    if data.trading_partner_id:
        partner = await db.edi_trading_partners.find_one({"_id": ObjectId(data.trading_partner_id)})
        if not partner:
            raise HTTPException(status_code=404, detail="Trading partner not found")
        if "210" not in partner.get("supported_message_types", []):
            raise HTTPException(status_code=400, detail="Trading partner does not support EDI 210")
        trading_partner_id = ObjectId(data.trading_partner_id)
        partner_name = partner.get("partner_name")
    else:
        # Auto-detect trading partner for this customer that supports 210
        customer_id = invoice.get("customer_id")
        if customer_id:
            partner = await db.edi_trading_partners.find_one({
                "is_active": True,
                "supported_message_types": "210",
            })
            if partner:
                trading_partner_id = partner["_id"]
                partner_name = partner.get("partner_name")

    # Build simulated EDI 210 content
    # TODO: Replace with real EDI 210 generation using proper segment builders
    invoice_number = invoice.get("invoice_number", "INV-000")
    total_cents = invoice.get("total", 0)
    total_dollars = total_cents / 100 if isinstance(total_cents, (int, float)) and total_cents > 100 else total_cents

    control_number = str(int(utc_now().timestamp()))[-9:]

    edi_210_content = (
        f"ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       "
        f"*{utc_now().strftime('%y%m%d')}*{utc_now().strftime('%H%M')}*U*00401*{control_number}*0*P*:~"
        f"GS*IM*SENDER*RECEIVER*{utc_now().strftime('%Y%m%d')}*{utc_now().strftime('%H%M')}*{control_number}*X*004010~"
        f"ST*210*{control_number}~"
        f"B3**{invoice_number}*PP*{total_dollars:.2f}*{utc_now().strftime('%Y%m%d')}*NET30*COLLECT~"
        f"N1*SH*{invoice.get('billing_name', 'Shipper')}~"
        f"N1*CN*{invoice.get('billing_name', 'Consignee')}~"
        f"LX*1~"
        f"L1*1*{total_dollars:.2f}*FR~"
        f"SE*8*{control_number}~"
        f"GE*1*{control_number}~"
        f"IEA*1*{control_number}~"
    )

    # Determine initial status
    initial_status = EDIMessageStatus.SENT if data.auto_send else EDIMessageStatus.PARSED

    message = EDIMessage(
        message_type=EDIMessageType.MOTOR_CARRIER_FREIGHT_INVOICE,
        direction=EDIDirection.OUTBOUND,
        status=initial_status,
        raw_content=edi_210_content,
        parsed_data={
            "transaction_type": "210",
            "invoice_number": invoice_number,
            "total_amount": total_dollars,
            "source_invoice_id": str(invoice["_id"]),
            "generated_from": "tms_invoice",
        },
        trading_partner_id=trading_partner_id,
        shipment_id=ObjectId(invoice["shipment_id"]) if invoice.get("shipment_id") else None,
        isa_control_number=control_number,
        gs_control_number=control_number,
        st_control_number=control_number,
        error_messages=[],
    )

    if data.auto_send:
        message.processed_at = utc_now()
        message.processing_notes = f"Auto-sent to {partner_name or 'trading partner'}"

    await db.edi_messages.insert_one(message.model_dump_mongo())

    # Update invoice with EDI tracking info
    await db.invoices.update_one(
        {"_id": ObjectId(invoice_id)},
        {"$set": {
            "edi_210_message_id": str(message.id),
            "edi_210_status": initial_status.value,
            "edi_210_generated_at": utc_now(),
            "updated_at": utc_now(),
        }},
    )

    doc = await db.edi_messages.find_one({"_id": message.id})
    return await message_to_response(doc)


@router.get("/210-status", response_model=List[EDI210StatusResponse])
async def get_edi_210_status(
    invoice_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    """
    Get EDI 210 transmission status for invoices.

    Allows brokers to track which invoices have been sent as EDI 210 messages
    and their current transmission status.
    """
    db = get_database()

    query: dict = {"message_type": "210", "direction": "outbound"}
    if status:
        query["status"] = status

    if invoice_id:
        query["parsed_data.source_invoice_id"] = invoice_id

    cursor = db.edi_messages.find(query).sort("created_at", -1).limit(limit)
    messages = await cursor.to_list(limit)

    results = []
    for msg in messages:
        partner_name = None
        if msg.get("trading_partner_id"):
            partner = await db.edi_trading_partners.find_one({"_id": msg["trading_partner_id"]})
            if partner:
                partner_name = partner.get("partner_name")

        parsed = msg.get("parsed_data", {})
        results.append(EDI210StatusResponse(
            invoice_id=parsed.get("source_invoice_id", ""),
            edi_message_id=str(msg["_id"]),
            status=msg["status"],
            trading_partner_name=partner_name,
            generated_at=msg.get("created_at"),
            sent_at=msg.get("processed_at"),
            acknowledged_at=msg.get("acknowledged_at"),
            error_messages=msg.get("error_messages", []),
        ))

    return results


# ============================================================================
# EDI 990 - Response to Load Tender
# ============================================================================


class EDI990GenerateRequest(BaseModel):
    """Request to generate an EDI 990 response to a load tender."""
    response_type: str = "accept"  # accept, decline, counter
    counter_rate: Optional[float] = None
    decline_reason: Optional[str] = None
    trading_partner_id: Optional[str] = None
    notes: Optional[str] = None


class EDI990StatusResponse(BaseModel):
    """Response for EDI 990 status tracking."""
    tender_id: str
    edi_message_id: Optional[str] = None
    response_type: str
    status: str
    trading_partner_name: Optional[str] = None
    generated_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    error_messages: list[str] = []


@router.post("/generate-990/{tender_id}", response_model=EDIMessageResponse)
async def generate_edi_990(tender_id: str, data: EDI990GenerateRequest = EDI990GenerateRequest()):
    """
    Generate an EDI 990 (Response to Load Tender) for a tender.

    Creates a properly formatted EDI 990 message responding to an EDI 204 load tender.
    Supports accept, decline, and counter responses.
    """
    db = get_database()

    # Look up the tender
    tender = await db.tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Map response type to EDI 990 code
    response_code_map = {
        "accept": "A",   # Accepted
        "decline": "D",  # Declined
        "counter": "C",  # Counter offer
    }
    response_code = response_code_map.get(data.response_type, "A")

    if data.response_type not in response_code_map:
        raise HTTPException(status_code=400, detail="Invalid response_type. Must be: accept, decline, or counter")

    # Look up trading partner
    trading_partner_id = None
    partner_name = None
    if data.trading_partner_id:
        partner = await db.edi_trading_partners.find_one({"_id": ObjectId(data.trading_partner_id)})
        if partner:
            trading_partner_id = ObjectId(data.trading_partner_id)
            partner_name = partner.get("partner_name")

    # Build simulated EDI 990 content
    # TODO: Replace with real EDI 990 generation using proper segment builders
    control_number = str(int(utc_now().timestamp()))[-9:]
    shipment_id = tender.get("shipment_id")

    # Look up shipment for reference number
    shipment_ref = ""
    if shipment_id:
        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id) if isinstance(shipment_id, str) else shipment_id})
        if shipment:
            shipment_ref = shipment.get("shipment_number", "")

    edi_990_content = (
        f"ISA*00*          *00*          *ZZ*CARRIER        *ZZ*BROKER         "
        f"*{utc_now().strftime('%y%m%d')}*{utc_now().strftime('%H%M')}*U*00401*{control_number}*0*P*:~"
        f"GS*GF*CARRIER*BROKER*{utc_now().strftime('%Y%m%d')}*{utc_now().strftime('%H%M')}*{control_number}*X*004010~"
        f"ST*990*{control_number}~"
        f"B1*{shipment_ref}*{response_code}*{utc_now().strftime('%Y%m%d')}~"
    )

    if data.response_type == "counter" and data.counter_rate:
        edi_990_content += f"L1*1*{data.counter_rate:.2f}*FR~"

    if data.decline_reason:
        edi_990_content += f"K1*{data.decline_reason[:80]}~"

    segment_count = 4 + (1 if data.counter_rate else 0) + (1 if data.decline_reason else 0)
    edi_990_content += (
        f"SE*{segment_count}*{control_number}~"
        f"GE*1*{control_number}~"
        f"IEA*1*{control_number}~"
    )

    message = EDIMessage(
        message_type=EDIMessageType.RESPONSE_TO_LOAD_TENDER,
        direction=EDIDirection.OUTBOUND,
        status=EDIMessageStatus.SENT,
        raw_content=edi_990_content,
        parsed_data={
            "transaction_type": "990",
            "response_code": response_code,
            "response_type": data.response_type,
            "tender_id": str(tender["_id"]),
            "shipment_reference": shipment_ref,
            "counter_rate": data.counter_rate,
            "decline_reason": data.decline_reason,
            "notes": data.notes,
        },
        trading_partner_id=trading_partner_id,
        shipment_id=ObjectId(shipment_id) if shipment_id else None,
        isa_control_number=control_number,
        gs_control_number=control_number,
        st_control_number=control_number,
        error_messages=[],
        processed_at=utc_now(),
        processing_notes=f"990 {data.response_type} response generated for tender {tender_id}",
    )

    await db.edi_messages.insert_one(message.model_dump_mongo())

    # Update tender with EDI 990 tracking
    tender_update: dict = {
        "edi_990_message_id": str(message.id),
        "edi_990_status": "sent",
        "edi_990_response_type": data.response_type,
        "updated_at": utc_now(),
    }

    # Also update tender status based on response
    if data.response_type == "accept":
        tender_update["status"] = "accepted"
        tender_update["responded_at"] = utc_now()
    elif data.response_type == "decline":
        tender_update["status"] = "declined"
        tender_update["responded_at"] = utc_now()
        if data.decline_reason:
            tender_update["decline_reason"] = data.decline_reason

    await db.tenders.update_one(
        {"_id": ObjectId(tender_id)},
        {"$set": tender_update},
    )

    doc = await db.edi_messages.find_one({"_id": message.id})
    return await message_to_response(doc)


@router.get("/990-status", response_model=List[EDI990StatusResponse])
async def get_edi_990_status(
    tender_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
):
    """Get EDI 990 transmission status for tender responses."""
    db = get_database()

    query: dict = {"message_type": "990", "direction": "outbound"}
    if status:
        query["status"] = status
    if tender_id:
        query["parsed_data.tender_id"] = tender_id

    cursor = db.edi_messages.find(query).sort("created_at", -1).limit(limit)
    messages = await cursor.to_list(limit)

    results = []
    for msg in messages:
        partner_name = None
        if msg.get("trading_partner_id"):
            partner = await db.edi_trading_partners.find_one({"_id": msg["trading_partner_id"]})
            if partner:
                partner_name = partner.get("partner_name")

        parsed = msg.get("parsed_data", {})
        results.append(EDI990StatusResponse(
            tender_id=parsed.get("tender_id", ""),
            edi_message_id=str(msg["_id"]),
            response_type=parsed.get("response_type", "accept"),
            status=msg["status"],
            trading_partner_name=partner_name,
            generated_at=msg.get("created_at"),
            sent_at=msg.get("processed_at"),
            error_messages=msg.get("error_messages", []),
        ))

    return results


# ============================================================================
# EDI 204 - Load Tender Acceptance Workflow
# ============================================================================


class EDI204TenderResponse(BaseModel):
    """Response model for an EDI 204 load tender."""
    id: str
    message_id: str
    trading_partner_name: Optional[str] = None
    status: str
    shipper_name: Optional[str] = None
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    total_charge: Optional[float] = None
    reference_number: Optional[str] = None
    stops: list[dict] = []
    raw_content: str = ""
    parsed_data: Optional[dict] = None
    shipment_id: Optional[str] = None
    created_at: datetime
    auto_accept_eligible: bool = False


class EDI204AcceptRequest(BaseModel):
    notes: Optional[str] = None
    carrier_id: Optional[str] = None


class EDI204RejectRequest(BaseModel):
    reason: Optional[str] = None


class AutoAcceptRule(BaseModel):
    trading_partner_id: Optional[str] = None
    origin_states: list[str] = []
    destination_states: list[str] = []
    min_rate: Optional[float] = None
    max_weight_lbs: Optional[int] = None
    equipment_types: list[str] = []
    is_active: bool = True


def _extract_204_shipment_data(parsed_data: dict) -> dict:
    """Extract shipment data from parsed EDI 204."""
    data = parsed_data or {}
    stops_data = data.get("stops", [])
    shipment_details = data.get("shipment_details", {})
    origin = stops_data[0] if stops_data else {}
    destination = stops_data[-1] if len(stops_data) > 1 else {}
    return {
        "shipper_name": data.get("shipper", {}).get("name"),
        "origin_city": origin.get("city"),
        "origin_state": origin.get("state"),
        "destination_city": destination.get("city"),
        "destination_state": destination.get("state"),
        "pickup_date": origin.get("date"),
        "delivery_date": destination.get("date"),
        "equipment_type": shipment_details.get("equipment_type"),
        "weight_lbs": shipment_details.get("weight"),
        "total_charge": shipment_details.get("total_charge"),
        "reference_number": data.get("reference_number") or shipment_details.get("bol_number"),
        "stops": stops_data,
    }


@router.post("/receive-204", response_model=EDI204TenderResponse)
async def receive_edi_204(data: EDIMessageCreate):
    """Receive and process an EDI 204 load tender."""
    db = get_database()

    element_sep = "*"
    segment_term = "~"
    if data.trading_partner_id:
        partner = await db.edi_trading_partners.find_one({"_id": ObjectId(data.trading_partner_id)})
        if partner:
            element_sep = partner.get("element_separator", "*")
            segment_term = partner.get("segment_terminator", "~")

    parsed = parse_edi_message(data.raw_content, message_type="204",
                                element_separator=element_sep, segment_terminator=segment_term)

    error_messages = []
    if "error" in parsed:
        error_messages.append(parsed["error"])

    envelope = parsed.get("envelope", {})

    message = EDIMessage(
        message_type=EDIMessageType.MOTOR_CARRIER_LOAD_TENDER,
        direction=EDIDirection.INBOUND,
        status=EDIMessageStatus.PARSED if not error_messages else EDIMessageStatus.ERROR,
        raw_content=data.raw_content,
        parsed_data=parsed,
        trading_partner_id=ObjectId(data.trading_partner_id) if data.trading_partner_id else None,
        isa_control_number=envelope.get("isa_control_number"),
        gs_control_number=envelope.get("gs_control_number"),
        st_control_number=envelope.get("st_control_number"),
        error_messages=error_messages,
    )
    await db.edi_messages.insert_one(message.model_dump_mongo())

    shipment_data = _extract_204_shipment_data(parsed)

    tender_record = {
        "_id": ObjectId(),
        "message_id": message.id,
        "trading_partner_id": ObjectId(data.trading_partner_id) if data.trading_partner_id else None,
        "status": "pending",
        "created_at": utc_now(),
        "updated_at": utc_now(),
        **shipment_data,
    }

    # Check auto-accept rules
    auto_accept = False
    rules = await db.edi_auto_accept_rules.find({"is_active": True}).to_list(100)
    for rule in rules:
        matches = True
        if rule.get("trading_partner_id") and str(rule["trading_partner_id"]) != (data.trading_partner_id or ""):
            matches = False
        if rule.get("origin_states") and shipment_data.get("origin_state") not in rule["origin_states"]:
            matches = False
        if rule.get("destination_states") and shipment_data.get("destination_state") not in rule["destination_states"]:
            matches = False
        if rule.get("equipment_types") and shipment_data.get("equipment_type") not in rule["equipment_types"]:
            matches = False
        if rule.get("max_weight_lbs") and (shipment_data.get("weight_lbs") or 0) > rule["max_weight_lbs"]:
            matches = False
        if rule.get("min_rate") and (shipment_data.get("total_charge") or 0) < rule["min_rate"]:
            matches = False
        if matches:
            auto_accept = True
            break

    tender_record["auto_accept_eligible"] = auto_accept
    await db.edi_204_tenders.insert_one(tender_record)

    partner_name = None
    if data.trading_partner_id:
        p = await db.edi_trading_partners.find_one({"_id": ObjectId(data.trading_partner_id)})
        if p:
            partner_name = p.get("partner_name")

    return EDI204TenderResponse(
        id=str(tender_record["_id"]),
        message_id=str(message.id),
        trading_partner_name=partner_name,
        status="pending",
        **{k: v for k, v in shipment_data.items()},
        raw_content=data.raw_content,
        parsed_data=parsed,
        created_at=message.created_at,
        auto_accept_eligible=auto_accept,
    )


@router.get("/204-tenders", response_model=List[EDI204TenderResponse])
async def list_204_tenders(status: Optional[str] = None, trading_partner_id: Optional[str] = None, limit: int = 50):
    """List EDI 204 load tenders."""
    db = get_database()
    query: dict = {}
    if status:
        query["status"] = status
    if trading_partner_id:
        query["trading_partner_id"] = ObjectId(trading_partner_id)

    tenders = await db.edi_204_tenders.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    results = []
    for t in tenders:
        pn = None
        if t.get("trading_partner_id"):
            p = await db.edi_trading_partners.find_one({"_id": t["trading_partner_id"]})
            if p:
                pn = p.get("partner_name")
        msg = await db.edi_messages.find_one({"_id": t.get("message_id")})
        results.append(EDI204TenderResponse(
            id=str(t["_id"]),
            message_id=str(t.get("message_id", "")),
            trading_partner_name=pn,
            status=t.get("status", "pending"),
            shipper_name=t.get("shipper_name"),
            origin_city=t.get("origin_city"),
            origin_state=t.get("origin_state"),
            destination_city=t.get("destination_city"),
            destination_state=t.get("destination_state"),
            pickup_date=t.get("pickup_date"),
            delivery_date=t.get("delivery_date"),
            equipment_type=t.get("equipment_type"),
            weight_lbs=t.get("weight_lbs"),
            total_charge=t.get("total_charge"),
            reference_number=t.get("reference_number"),
            stops=t.get("stops", []),
            raw_content=msg.get("raw_content", "") if msg else "",
            parsed_data=msg.get("parsed_data") if msg else None,
            shipment_id=str(t["shipment_id"]) if t.get("shipment_id") else None,
            created_at=t.get("created_at", utc_now()),
            auto_accept_eligible=t.get("auto_accept_eligible", False),
        ))
    return results


@router.post("/204/{tender_id}/accept")
async def accept_204_tender(tender_id: str, data: EDI204AcceptRequest = EDI204AcceptRequest()):
    """Accept an EDI 204 load tender and create a shipment."""
    db = get_database()
    tender = await db.edi_204_tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender:
        raise HTTPException(status_code=404, detail="204 tender not found")
    if tender.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Tender already {tender.get('status')}")

    from app.services.number_generator import NumberGenerator
    shipment_number = await NumberGenerator.get_next_shipment_number()

    stops = []
    for i, s in enumerate(tender.get("stops", [])):
        stop_type = "pickup" if i == 0 else ("delivery" if i == len(tender.get("stops", [])) - 1 else "stop")
        stops.append({"stop_number": i+1, "stop_type": stop_type, "name": s.get("name", ""),
                       "address": s.get("address", ""), "city": s.get("city", ""),
                       "state": s.get("state", ""), "zip_code": s.get("zip_code", "")})

    customer_id = None
    if tender.get("trading_partner_id"):
        p = await db.edi_trading_partners.find_one({"_id": tender["trading_partner_id"]})
        if p:
            c = await db.customers.find_one({"name": p.get("partner_name")})
            if c:
                customer_id = c["_id"]
    if not customer_id:
        c = await db.customers.find_one({"status": "active"})
        if c:
            customer_id = c["_id"]
    if not customer_id:
        raise HTTPException(status_code=400, detail="No active customer found")

    price_cents = int((tender.get("total_charge") or 0) * 100)
    shipment_doc = {
        "_id": ObjectId(), "shipment_number": shipment_number, "customer_id": customer_id,
        "carrier_id": ObjectId(data.carrier_id) if data.carrier_id else None,
        "status": "booked", "stops": stops, "equipment_type": tender.get("equipment_type", "van"),
        "weight_lbs": tender.get("weight_lbs"), "bol_number": tender.get("reference_number"),
        "customer_price": price_cents, "carrier_cost": 0,
        "internal_notes": f"Created from EDI 204. {data.notes or ''}",
        "created_at": utc_now(), "updated_at": utc_now(),
    }
    if tender.get("pickup_date"):
        try:
            shipment_doc["pickup_date"] = datetime.fromisoformat(tender["pickup_date"])
        except (ValueError, TypeError):
            pass
    if tender.get("delivery_date"):
        try:
            shipment_doc["delivery_date"] = datetime.fromisoformat(tender["delivery_date"])
        except (ValueError, TypeError):
            pass

    await db.shipments.insert_one(shipment_doc)
    await db.edi_204_tenders.update_one({"_id": ObjectId(tender_id)},
        {"$set": {"status": "accepted", "shipment_id": shipment_doc["_id"],
                  "accepted_at": utc_now(), "updated_at": utc_now()}})
    if tender.get("message_id"):
        await db.edi_messages.update_one({"_id": tender["message_id"]},
            {"$set": {"status": "processed", "shipment_id": shipment_doc["_id"],
                      "processed_at": utc_now(), "processing_notes": f"Accepted. Shipment {shipment_number} created.",
                      "updated_at": utc_now()}})

    ctrl = str(int(utc_now().timestamp()))[-9:]
    edi_990 = EDIMessage(
        message_type=EDIMessageType.RESPONSE_TO_LOAD_TENDER, direction=EDIDirection.OUTBOUND,
        status=EDIMessageStatus.SENT,
        raw_content=f"ISA*00*          *00*          *ZZ*CARRIER        *ZZ*SHIPPER        *{utc_now().strftime('%y%m%d')}*{utc_now().strftime('%H%M')}*U*00401*{ctrl}*0*P*:~GS*GF*CARRIER*SHIPPER*{utc_now().strftime('%Y%m%d')}*{utc_now().strftime('%H%M')}*{ctrl}*X*004010~ST*990*{ctrl}~B1*{shipment_number}*A*{utc_now().strftime('%Y%m%d')}~SE*4*{ctrl}~GE*1*{ctrl}~IEA*1*{ctrl}~",
        parsed_data={"response_code": "A", "shipment_reference": shipment_number},
        trading_partner_id=tender.get("trading_partner_id"),
        shipment_id=shipment_doc["_id"],
        isa_control_number=ctrl, gs_control_number=ctrl, st_control_number=ctrl,
        processed_at=utc_now(),
    )
    await db.edi_messages.insert_one(edi_990.model_dump_mongo())

    return {"status": "accepted", "tender_id": tender_id, "shipment_id": str(shipment_doc["_id"]),
            "shipment_number": shipment_number, "edi_990_sent": True, "edi_990_message_id": str(edi_990.id)}


@router.post("/204/{tender_id}/reject")
async def reject_204_tender(tender_id: str, data: EDI204RejectRequest = EDI204RejectRequest()):
    """Reject an EDI 204 load tender and send 990 decline."""
    db = get_database()
    tender = await db.edi_204_tenders.find_one({"_id": ObjectId(tender_id)})
    if not tender:
        raise HTTPException(status_code=404, detail="204 tender not found")
    if tender.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Tender already {tender.get('status')}")

    await db.edi_204_tenders.update_one({"_id": ObjectId(tender_id)},
        {"$set": {"status": "rejected", "reject_reason": data.reason,
                  "rejected_at": utc_now(), "updated_at": utc_now()}})
    if tender.get("message_id"):
        await db.edi_messages.update_one({"_id": tender["message_id"]},
            {"$set": {"status": "rejected",
                      "processing_notes": f"Rejected. Reason: {data.reason or 'No reason'}",
                      "updated_at": utc_now()}})

    ctrl = str(int(utc_now().timestamp()))[-9:]
    reason_seg = f"K1*{data.reason[:80]}~" if data.reason else ""
    seg_count = 4 + (1 if data.reason else 0)
    edi_990 = EDIMessage(
        message_type=EDIMessageType.RESPONSE_TO_LOAD_TENDER, direction=EDIDirection.OUTBOUND,
        status=EDIMessageStatus.SENT,
        raw_content=f"ISA*00*          *00*          *ZZ*CARRIER        *ZZ*SHIPPER        *{utc_now().strftime('%y%m%d')}*{utc_now().strftime('%H%M')}*U*00401*{ctrl}*0*P*:~GS*GF*CARRIER*SHIPPER*{utc_now().strftime('%Y%m%d')}*{utc_now().strftime('%H%M')}*{ctrl}*X*004010~ST*990*{ctrl}~B1**D*{utc_now().strftime('%Y%m%d')}~{reason_seg}SE*{seg_count}*{ctrl}~GE*1*{ctrl}~IEA*1*{ctrl}~",
        parsed_data={"response_code": "D", "decline_reason": data.reason},
        trading_partner_id=tender.get("trading_partner_id"),
        isa_control_number=ctrl, gs_control_number=ctrl, st_control_number=ctrl,
        processed_at=utc_now(),
    )
    await db.edi_messages.insert_one(edi_990.model_dump_mongo())

    return {"status": "rejected", "tender_id": tender_id, "reason": data.reason,
            "edi_990_sent": True, "edi_990_message_id": str(edi_990.id)}


@router.post("/auto-accept-rules")
async def create_auto_accept_rule(data: AutoAcceptRule):
    """Create an auto-accept rule for EDI 204 tenders."""
    db = get_database()
    rule = {"_id": ObjectId(), "trading_partner_id": ObjectId(data.trading_partner_id) if data.trading_partner_id else None,
            "origin_states": data.origin_states, "destination_states": data.destination_states,
            "min_rate": data.min_rate, "max_weight_lbs": data.max_weight_lbs,
            "equipment_types": data.equipment_types, "is_active": data.is_active, "created_at": utc_now()}
    await db.edi_auto_accept_rules.insert_one(rule)
    return {"id": str(rule["_id"]), "status": "created"}


@router.get("/auto-accept-rules")
async def list_auto_accept_rules():
    """List auto-accept rules for EDI 204 tenders."""
    db = get_database()
    rules = await db.edi_auto_accept_rules.find({"is_active": True}).to_list(100)
    return [{"id": str(r["_id"]),
             "trading_partner_id": str(r["trading_partner_id"]) if r.get("trading_partner_id") else None,
             "origin_states": r.get("origin_states", []), "destination_states": r.get("destination_states", []),
             "min_rate": r.get("min_rate"), "max_weight_lbs": r.get("max_weight_lbs"),
             "equipment_types": r.get("equipment_types", []), "is_active": r.get("is_active", True)}
            for r in rules]
