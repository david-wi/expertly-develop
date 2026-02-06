"""Communication service for sending SMS, making voice calls, and managing templates."""

import logging
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from bson import ObjectId

from app.database import get_database
from app.models.communication import (
    CommunicationLog,
    CommunicationChannel,
    CommunicationDirection,
    CommunicationStatus,
)
from app.models.communication_template import CommunicationTemplate
from app.models.base import utc_now

logger = logging.getLogger(__name__)


# ============================================================================
# Template Variable Substitution
# ============================================================================


async def substitute_template_variables(
    template_body: str,
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    extra_variables: Optional[Dict[str, str]] = None,
) -> str:
    """
    Replace {{variable}} placeholders in a template with actual values.

    Looks up shipment, carrier, and customer data to fill in variables.
    """
    db = get_database()
    variables: Dict[str, str] = {}

    # Shipment variables
    if shipment_id:
        shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
        if shipment:
            variables["shipment_number"] = shipment.get("shipment_number", "")
            stops = shipment.get("stops", [])
            if stops:
                origin = stops[0]
                variables["origin_city"] = origin.get("city", "")
                variables["origin_state"] = origin.get("state", "")
            if len(stops) > 1:
                dest = stops[-1]
                variables["destination_city"] = dest.get("city", "")
                variables["destination_state"] = dest.get("state", "")
            variables["pickup_date"] = str(shipment.get("pickup_date", ""))
            variables["delivery_date"] = str(shipment.get("delivery_date", ""))

            # Look up carrier if not provided but assigned
            if not carrier_id and shipment.get("carrier_id"):
                carrier_id = str(shipment["carrier_id"])
            if not customer_id and shipment.get("customer_id"):
                customer_id = str(shipment["customer_id"])

    # Carrier variables
    if carrier_id:
        carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
        if carrier:
            variables["carrier_name"] = carrier.get("name", "")
            contacts = carrier.get("contacts", [])
            primary = next((c for c in contacts if c.get("is_primary")), contacts[0] if contacts else {})
            variables["driver_name"] = primary.get("name", "")
            variables["driver_phone"] = primary.get("phone", "")

    # Customer variables
    if customer_id:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if customer:
            variables["customer_name"] = customer.get("name", "")

    # Override/add extra variables
    if extra_variables:
        variables.update(extra_variables)

    # Do the substitution
    result = template_body
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", str(value))

    return result


# ============================================================================
# Mock Twilio SMS
# ============================================================================


async def send_sms(
    to_number: str,
    message_body: str,
    from_number: str = "+15551234567",
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    template_id: Optional[str] = None,
) -> CommunicationLog:
    """
    Send an SMS message (mock Twilio).

    In production, this would call Twilio's API. For now, it stores the message
    in the database and returns a success status.
    """
    db = get_database()

    # Create communication log
    comm = CommunicationLog(
        channel=CommunicationChannel.SMS,
        direction=CommunicationDirection.OUTBOUND,
        phone_number=to_number,
        to_number=to_number,
        from_number=from_number,
        message_body=message_body,
        status=CommunicationStatus.SENT,
        shipment_id=ObjectId(shipment_id) if shipment_id else None,
        carrier_id=ObjectId(carrier_id) if carrier_id else None,
        customer_id=ObjectId(customer_id) if customer_id else None,
        template_id=ObjectId(template_id) if template_id else None,
        provider_message_id=f"mock_sms_{uuid.uuid4().hex[:12]}",
        provider="mock_twilio",
        sent_at=utc_now(),
    )

    await db.communication_logs.insert_one(comm.model_dump_mongo())

    logger.info(
        "SMS sent (mock) to %s: %s",
        to_number,
        message_body[:50] + "..." if len(message_body) > 50 else message_body,
    )

    # Simulate delivery after a moment (mark as delivered immediately for mock)
    await db.communication_logs.update_one(
        {"_id": comm.id},
        {"$set": {
            "status": CommunicationStatus.DELIVERED.value,
            "delivered_at": utc_now(),
        }},
    )
    comm.status = CommunicationStatus.DELIVERED
    comm.delivered_at = utc_now()

    return comm


# ============================================================================
# Mock Twilio Voice
# ============================================================================


async def make_voice_call(
    to_number: str,
    from_number: str = "+15551234567",
    message_body: Optional[str] = None,
    shipment_id: Optional[str] = None,
    carrier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> CommunicationLog:
    """
    Initiate a voice call (mock Twilio).

    In production, this would use Twilio's Programmable Voice. For now, it
    stores the call record in the database.
    """
    db = get_database()

    comm = CommunicationLog(
        channel=CommunicationChannel.VOICE,
        direction=CommunicationDirection.OUTBOUND,
        phone_number=to_number,
        to_number=to_number,
        from_number=from_number,
        message_body=message_body,
        status=CommunicationStatus.COMPLETED,
        call_duration_seconds=0,  # Mock - no actual call
        shipment_id=ObjectId(shipment_id) if shipment_id else None,
        carrier_id=ObjectId(carrier_id) if carrier_id else None,
        customer_id=ObjectId(customer_id) if customer_id else None,
        provider_message_id=f"mock_call_{uuid.uuid4().hex[:12]}",
        provider="mock_twilio",
        sent_at=utc_now(),
        delivered_at=utc_now(),
    )

    await db.communication_logs.insert_one(comm.model_dump_mongo())

    logger.info("Voice call initiated (mock) to %s", to_number)

    return comm


# ============================================================================
# Check-Call Reminders
# ============================================================================


async def get_check_call_schedule() -> List[Dict[str, Any]]:
    """
    Get upcoming check calls for in-transit shipments.

    Returns shipments that need check calls based on their status and
    last communication time.
    """
    db = get_database()
    now = utc_now()

    # Find in-transit shipments
    in_transit = await db.shipments.find(
        {"status": {"$in": ["in_transit", "pending_pickup"]}}
    ).sort("pickup_date", 1).to_list(100)

    schedule = []
    for shipment in in_transit:
        shipment_id = str(shipment["_id"])

        # Find last outbound communication for this shipment
        last_comm = await db.communication_logs.find_one(
            {
                "shipment_id": shipment["_id"],
                "direction": CommunicationDirection.OUTBOUND.value,
            },
            sort=[("created_at", -1)],
        )

        last_contact = last_comm["created_at"] if last_comm else None
        hours_since_contact = None
        if last_contact:
            delta = now - last_contact
            hours_since_contact = delta.total_seconds() / 3600

        # Determine next check call time (every 4 hours during transit)
        next_check_call = None
        is_overdue = False
        if last_contact:
            next_check_call = last_contact + timedelta(hours=4)
            is_overdue = now > next_check_call
        else:
            # Never contacted - overdue
            is_overdue = True
            next_check_call = now

        # Get carrier info
        carrier_name = None
        carrier_phone = None
        if shipment.get("carrier_id"):
            carrier = await db.carriers.find_one({"_id": shipment["carrier_id"]})
            if carrier:
                carrier_name = carrier.get("name")
                contacts = carrier.get("contacts", [])
                primary = next((c for c in contacts if c.get("is_primary")), contacts[0] if contacts else {})
                carrier_phone = primary.get("phone")

        schedule.append({
            "shipment_id": shipment_id,
            "shipment_number": shipment.get("shipment_number", ""),
            "status": shipment.get("status", ""),
            "carrier_id": str(shipment["carrier_id"]) if shipment.get("carrier_id") else None,
            "carrier_name": carrier_name,
            "carrier_phone": carrier_phone,
            "last_contact": last_contact.isoformat() if last_contact else None,
            "hours_since_contact": round(hours_since_contact, 1) if hours_since_contact else None,
            "next_check_call": next_check_call.isoformat() if next_check_call else None,
            "is_overdue": is_overdue,
        })

    # Sort: overdue first, then by next check call time
    schedule.sort(key=lambda x: (not x["is_overdue"], x["next_check_call"] or ""))

    return schedule


async def send_check_call_reminder(
    shipment_id: str,
    template_id: Optional[str] = None,
) -> Optional[CommunicationLog]:
    """
    Send a check call SMS to the carrier for a shipment.

    Uses the check_call template if no template_id is specified.
    """
    db = get_database()

    # Get shipment
    shipment = await db.shipments.find_one({"_id": ObjectId(shipment_id)})
    if not shipment:
        logger.warning("Shipment %s not found for check call", shipment_id)
        return None

    carrier_id = shipment.get("carrier_id")
    if not carrier_id:
        logger.warning("No carrier assigned for shipment %s", shipment_id)
        return None

    # Get carrier phone
    carrier = await db.carriers.find_one({"_id": carrier_id})
    if not carrier:
        logger.warning("Carrier not found for shipment %s", shipment_id)
        return None

    contacts = carrier.get("contacts", [])
    primary = next((c for c in contacts if c.get("is_primary")), contacts[0] if contacts else {})
    phone = primary.get("phone")
    if not phone:
        logger.warning("No phone for carrier %s", carrier.get("name"))
        return None

    # Get or build message
    if template_id:
        template_doc = await db.communication_templates.find_one({"_id": ObjectId(template_id)})
        if template_doc:
            message = await substitute_template_variables(
                template_doc["template_body"],
                shipment_id=shipment_id,
                carrier_id=str(carrier_id),
            )
        else:
            message = f"Check call for shipment {shipment.get('shipment_number', shipment_id)}: Please provide a status update."
    else:
        # Default check call message
        message = await substitute_template_variables(
            "Hi {{carrier_name}}, this is a check call for shipment {{shipment_number}}. "
            "Please reply with your current location and ETA. Thank you!",
            shipment_id=shipment_id,
            carrier_id=str(carrier_id),
        )

    return await send_sms(
        to_number=phone,
        message_body=message,
        shipment_id=shipment_id,
        carrier_id=str(carrier_id),
        template_id=template_id,
    )


# ============================================================================
# Bulk Send
# ============================================================================


async def bulk_send_sms(
    messages: List[Dict[str, str]],
    template_id: Optional[str] = None,
) -> List[CommunicationLog]:
    """
    Send multiple SMS messages at once.

    Each item in messages should have:
    - to_number: recipient phone number
    - message_body: text to send (or will use template)
    - shipment_id (optional)
    - carrier_id (optional)
    - customer_id (optional)
    """
    results = []
    for msg in messages:
        body = msg.get("message_body", "")

        # If template, substitute
        if template_id and not body:
            db = get_database()
            template_doc = await db.communication_templates.find_one({"_id": ObjectId(template_id)})
            if template_doc:
                body = await substitute_template_variables(
                    template_doc["template_body"],
                    shipment_id=msg.get("shipment_id"),
                    carrier_id=msg.get("carrier_id"),
                    customer_id=msg.get("customer_id"),
                )

        comm = await send_sms(
            to_number=msg["to_number"],
            message_body=body,
            shipment_id=msg.get("shipment_id"),
            carrier_id=msg.get("carrier_id"),
            customer_id=msg.get("customer_id"),
            template_id=template_id,
        )
        results.append(comm)

    return results
