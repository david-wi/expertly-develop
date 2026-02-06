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
