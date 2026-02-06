"""Communications API endpoints for SMS/Voice messaging and templates."""

from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.communication import CommunicationLog, CommunicationChannel, CommunicationDirection, CommunicationStatus
from app.models.communication_template import CommunicationTemplate, TemplateChannel, TemplateCategory
from app.services.communication_service import (
    send_sms,
    make_voice_call,
    substitute_template_variables,
    get_check_call_schedule,
    send_check_call_reminder,
    bulk_send_sms,
)
from app.services.websocket_manager import manager
from app.models.base import utc_now

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class SendSMSRequest(BaseModel):
    """Send an SMS message."""
    to_number: str
    message_body: str
    shipment_id: Optional[str] = None
    carrier_id: Optional[str] = None
    customer_id: Optional[str] = None
    template_id: Optional[str] = None


class MakeCallRequest(BaseModel):
    """Initiate a voice call."""
    to_number: str
    message_body: Optional[str] = None
    shipment_id: Optional[str] = None
    carrier_id: Optional[str] = None
    customer_id: Optional[str] = None


class BulkSendRequest(BaseModel):
    """Send multiple SMS messages."""
    messages: List[SendSMSRequest]
    template_id: Optional[str] = None


class TemplateCreateRequest(BaseModel):
    """Create a communication template."""
    name: str
    channel: str = "sms"
    category: str = "custom"
    template_body: str
    subject: Optional[str] = None
    description: Optional[str] = None


class TemplateUpdateRequest(BaseModel):
    """Update a communication template."""
    name: Optional[str] = None
    channel: Optional[str] = None
    category: Optional[str] = None
    template_body: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TemplatePreviewRequest(BaseModel):
    """Preview a template with variable substitution."""
    template_body: str
    shipment_id: Optional[str] = None
    carrier_id: Optional[str] = None
    customer_id: Optional[str] = None


class CheckCallReminderRequest(BaseModel):
    """Send check call reminder for a shipment."""
    shipment_id: str
    template_id: Optional[str] = None


class CommunicationResponse(BaseModel):
    """Response model for a communication log entry."""
    id: str
    channel: str
    direction: str
    phone_number: Optional[str] = None
    to_number: Optional[str] = None
    from_number: Optional[str] = None
    message_body: Optional[str] = None
    subject: Optional[str] = None
    call_duration_seconds: Optional[int] = None
    recording_url: Optional[str] = None
    status: str
    shipment_id: Optional[str] = None
    carrier_id: Optional[str] = None
    customer_id: Optional[str] = None
    template_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Enriched
    shipment_number: Optional[str] = None
    carrier_name: Optional[str] = None
    customer_name: Optional[str] = None
    template_name: Optional[str] = None


class TemplateResponse(BaseModel):
    """Response model for a communication template."""
    id: str
    name: str
    channel: str
    category: str
    template_body: str
    subject: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    available_variables: List[str]
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Helpers
# ============================================================================


async def comm_to_response(doc: dict) -> CommunicationResponse:
    """Convert a MongoDB document to a CommunicationResponse with enrichment."""
    db = get_database()

    shipment_number = None
    carrier_name = None
    customer_name = None
    template_name = None

    if doc.get("shipment_id"):
        shipment = await db.shipments.find_one({"_id": doc["shipment_id"]})
        if shipment:
            shipment_number = shipment.get("shipment_number")

    if doc.get("carrier_id"):
        carrier = await db.carriers.find_one({"_id": doc["carrier_id"]})
        if carrier:
            carrier_name = carrier.get("name")

    if doc.get("customer_id"):
        customer = await db.customers.find_one({"_id": doc["customer_id"]})
        if customer:
            customer_name = customer.get("name")

    if doc.get("template_id"):
        template = await db.communication_templates.find_one({"_id": doc["template_id"]})
        if template:
            template_name = template.get("name")

    return CommunicationResponse(
        id=str(doc["_id"]),
        channel=doc.get("channel", "sms"),
        direction=doc.get("direction", "outbound"),
        phone_number=doc.get("phone_number"),
        to_number=doc.get("to_number"),
        from_number=doc.get("from_number"),
        message_body=doc.get("message_body"),
        subject=doc.get("subject"),
        call_duration_seconds=doc.get("call_duration_seconds"),
        recording_url=doc.get("recording_url"),
        status=doc.get("status", "queued"),
        shipment_id=str(doc["shipment_id"]) if doc.get("shipment_id") else None,
        carrier_id=str(doc["carrier_id"]) if doc.get("carrier_id") else None,
        customer_id=str(doc["customer_id"]) if doc.get("customer_id") else None,
        template_id=str(doc["template_id"]) if doc.get("template_id") else None,
        provider_message_id=doc.get("provider_message_id"),
        error_message=doc.get("error_message"),
        sent_at=doc.get("sent_at"),
        delivered_at=doc.get("delivered_at"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
        shipment_number=shipment_number,
        carrier_name=carrier_name,
        customer_name=customer_name,
        template_name=template_name,
    )


def template_to_response(doc: dict) -> TemplateResponse:
    """Convert a MongoDB document to a TemplateResponse."""
    return TemplateResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        channel=doc.get("channel", "sms"),
        category=doc.get("category", "custom"),
        template_body=doc["template_body"],
        subject=doc.get("subject"),
        description=doc.get("description"),
        is_active=doc.get("is_active", True),
        available_variables=doc.get("available_variables", []),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at", datetime.utcnow()),
    )


# ============================================================================
# Communication Log
# ============================================================================


@router.get("/log", response_model=List[CommunicationResponse])
async def get_communication_log(
    channel: Optional[str] = None,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """Get communication log with filters."""
    db = get_database()

    query: dict = {}
    if channel:
        query["channel"] = channel
    if direction:
        query["direction"] = direction
    if status:
        query["status"] = status
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)
    if carrier_id:
        query["carrier_id"] = ObjectId(carrier_id)
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)

    cursor = db.communication_logs.find(query).sort("created_at", -1).skip(offset).limit(limit)
    docs = await cursor.to_list(limit)

    return [await comm_to_response(doc) for doc in docs]


# ============================================================================
# Send SMS
# ============================================================================


@router.post("/send-sms", response_model=CommunicationResponse)
async def send_sms_endpoint(data: SendSMSRequest):
    """Send an SMS message."""
    comm = await send_sms(
        to_number=data.to_number,
        message_body=data.message_body,
        shipment_id=data.shipment_id,
        carrier_id=data.carrier_id,
        customer_id=data.customer_id,
        template_id=data.template_id,
    )

    doc = await get_database().communication_logs.find_one({"_id": comm.id})

    await manager.broadcast("communication:sms_sent", {
        "id": str(comm.id),
        "to_number": data.to_number,
        "channel": "sms",
    })

    return await comm_to_response(doc)


# ============================================================================
# Make Voice Call
# ============================================================================


@router.post("/make-call", response_model=CommunicationResponse)
async def make_call_endpoint(data: MakeCallRequest):
    """Initiate a voice call."""
    comm = await make_voice_call(
        to_number=data.to_number,
        message_body=data.message_body,
        shipment_id=data.shipment_id,
        carrier_id=data.carrier_id,
        customer_id=data.customer_id,
    )

    doc = await get_database().communication_logs.find_one({"_id": comm.id})

    await manager.broadcast("communication:call_initiated", {
        "id": str(comm.id),
        "to_number": data.to_number,
        "channel": "voice",
    })

    return await comm_to_response(doc)


# ============================================================================
# Bulk Send
# ============================================================================


@router.post("/bulk-send", response_model=List[CommunicationResponse])
async def bulk_send_endpoint(data: BulkSendRequest):
    """Send multiple SMS messages at once."""
    messages = [
        {
            "to_number": msg.to_number,
            "message_body": msg.message_body,
            "shipment_id": msg.shipment_id,
            "carrier_id": msg.carrier_id,
            "customer_id": msg.customer_id,
        }
        for msg in data.messages
    ]

    results = await bulk_send_sms(messages, template_id=data.template_id)

    db = get_database()
    responses = []
    for comm in results:
        doc = await db.communication_logs.find_one({"_id": comm.id})
        responses.append(await comm_to_response(doc))

    await manager.broadcast("communication:bulk_sent", {
        "count": len(results),
    })

    return responses


# ============================================================================
# Template Preview
# ============================================================================


@router.post("/preview-template")
async def preview_template(data: TemplatePreviewRequest):
    """Preview a template with variable substitution."""
    result = await substitute_template_variables(
        data.template_body,
        shipment_id=data.shipment_id,
        carrier_id=data.carrier_id,
        customer_id=data.customer_id,
    )
    return {"preview": result}


# ============================================================================
# Check-Call Schedule
# ============================================================================


@router.get("/check-call-schedule")
async def check_call_schedule():
    """Get upcoming check call schedule for in-transit shipments."""
    return await get_check_call_schedule()


@router.post("/send-check-call", response_model=CommunicationResponse)
async def send_check_call(data: CheckCallReminderRequest):
    """Send a check call reminder for a shipment."""
    comm = await send_check_call_reminder(
        shipment_id=data.shipment_id,
        template_id=data.template_id,
    )

    if not comm:
        raise HTTPException(status_code=400, detail="Could not send check call. Check that the shipment has an assigned carrier with a phone number.")

    doc = await get_database().communication_logs.find_one({"_id": comm.id})

    await manager.broadcast("communication:check_call_sent", {
        "shipment_id": data.shipment_id,
    })

    return await comm_to_response(doc)


# ============================================================================
# Template CRUD
# ============================================================================


@router.get("/templates", response_model=List[TemplateResponse])
async def list_templates(
    channel: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """List communication templates."""
    db = get_database()

    query: dict = {}
    if channel:
        query["channel"] = channel
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active

    docs = await db.communication_templates.find(query).sort("name", 1).to_list(100)
    return [template_to_response(doc) for doc in docs]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str):
    """Get a single template by ID."""
    db = get_database()
    doc = await db.communication_templates.find_one({"_id": ObjectId(template_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return template_to_response(doc)


@router.post("/templates", response_model=TemplateResponse)
async def create_template(data: TemplateCreateRequest):
    """Create a new communication template."""
    db = get_database()

    template = CommunicationTemplate(
        name=data.name,
        channel=TemplateChannel(data.channel),
        category=TemplateCategory(data.category),
        template_body=data.template_body,
        subject=data.subject,
        description=data.description,
    )

    await db.communication_templates.insert_one(template.model_dump_mongo())
    doc = await db.communication_templates.find_one({"_id": template.id})

    return template_to_response(doc)


@router.patch("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, data: TemplateUpdateRequest):
    """Update an existing template."""
    db = get_database()

    doc = await db.communication_templates.find_one({"_id": ObjectId(template_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data: dict = {"updated_at": utc_now()}
    if data.name is not None:
        update_data["name"] = data.name
    if data.channel is not None:
        update_data["channel"] = data.channel
    if data.category is not None:
        update_data["category"] = data.category
    if data.template_body is not None:
        update_data["template_body"] = data.template_body
    if data.subject is not None:
        update_data["subject"] = data.subject
    if data.description is not None:
        update_data["description"] = data.description
    if data.is_active is not None:
        update_data["is_active"] = data.is_active

    await db.communication_templates.update_one(
        {"_id": ObjectId(template_id)},
        {"$set": update_data},
    )

    updated = await db.communication_templates.find_one({"_id": ObjectId(template_id)})
    return template_to_response(updated)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    """Delete a communication template."""
    db = get_database()

    result = await db.communication_templates.delete_one({"_id": ObjectId(template_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"status": "deleted", "id": template_id}
