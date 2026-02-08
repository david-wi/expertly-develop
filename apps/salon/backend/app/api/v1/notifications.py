"""Notifications API endpoints."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query, Request, Response
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_salon_user
from ...services.notification_service import notification_service
from ...services.sms_service import sms_service

router = APIRouter()


@router.post("/webhook/twilio")
async def twilio_webhook(request: Request):
    """Handle incoming SMS from Twilio.

    This processes replies from clients like:
    - YES/NO for waitlist offers
    - CONFIRM for appointment confirmations
    - STOP for opt-out
    """
    form_data = await request.form()

    from_number = form_data.get("From", "")
    to_number = form_data.get("To", "")
    body = form_data.get("Body", "").strip().upper()
    message_sid = form_data.get("MessageSid", "")

    # Log incoming message
    sms_log = get_collection("sms_log")
    await sms_log.insert_one({
        "direction": "inbound",
        "from_number": from_number,
        "to_number": to_number,
        "message": form_data.get("Body", ""),
        "twilio_sid": message_sid,
        "created_at": datetime.now(timezone.utc),
    })

    # Find client by phone number
    clients_collection = get_collection("clients")
    client = await clients_collection.find_one({"phone": from_number})

    if not client:
        # Unknown number - could be formatted differently
        # Try without country code or with different formatting
        phone_variants = [
            from_number,
            from_number.replace("+1", ""),
            from_number[-10:],  # Last 10 digits
        ]
        for variant in phone_variants:
            client = await clients_collection.find_one({
                "phone": {"$regex": variant.replace("+", "\\+") + "$"}
            })
            if client:
                break

    response_message = None

    if body in ["YES", "SI", "OUI", "SIM"]:
        # Accept waitlist offer
        if client:
            response_message = await handle_waitlist_accept(client)

    elif body in ["NO", "NON", "NAO"]:
        # Decline waitlist offer
        if client:
            response_message = await handle_waitlist_decline(client)

    elif body in ["CONFIRM", "CONFIRMAR", "CONFIRMER"]:
        # Confirm appointment
        if client:
            response_message = await handle_appointment_confirm(client)

    elif body in ["STOP", "UNSUBSCRIBE", "CANCEL"]:
        # Opt out of messages
        if client:
            await clients_collection.update_one(
                {"_id": client["_id"]},
                {"$set": {"sms_opt_out": True, "updated_at": datetime.now(timezone.utc)}}
            )
            response_message = "You have been unsubscribed from SMS messages."

    elif body in ["START", "SUBSCRIBE"]:
        # Opt back in
        if client:
            await clients_collection.update_one(
                {"_id": client["_id"]},
                {"$set": {"sms_opt_out": False, "updated_at": datetime.now(timezone.utc)}}
            )
            response_message = "You have been subscribed to SMS messages."

    # Return TwiML response if we have a message to send
    if response_message:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{response_message}</Message>
</Response>"""
        return Response(content=twiml, media_type="application/xml")

    # Empty response if no action needed
    return Response(content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    media_type="application/xml")


async def handle_waitlist_accept(client: dict) -> Optional[str]:
    """Handle client accepting a waitlist offer."""
    waitlist_collection = get_collection("waitlist")
    appointments_collection = get_collection("appointments")
    services_collection = get_collection("services")
    staff_collection = get_collection("staff")
    salons_collection = get_collection("salons")

    # Find their most recent notified waitlist entry
    entry = await waitlist_collection.find_one({
        "client_id": client["_id"],
        "status": "notified",
    }, sort=[("last_notified_at", -1)])

    if not entry:
        return "We couldn't find a recent offer for you. Please call us to book."

    # Get the most recent offered slot
    offered_slots = entry.get("offered_slots", [])
    if not offered_slots:
        return "The offered slot is no longer available. We'll notify you of the next opening."

    latest_offer = offered_slots[-1]
    slot_time = datetime.fromisoformat(latest_offer["start_time"])

    # Check if slot is still available
    service = await services_collection.find_one({"_id": entry["service_id"]})
    if not service:
        return "Sorry, there was an error. Please call us to book."

    existing = await appointments_collection.find_one({
        "staff_id": ObjectId(latest_offer["staff_id"]),
        "start_time": slot_time,
        "status": {"$nin": ["cancelled", "no_show"]},
    })

    if existing:
        # Slot taken
        await waitlist_collection.update_one(
            {"_id": entry["_id"]},
            {"$set": {"status": "active", "updated_at": datetime.now(timezone.utc)}}
        )
        return "Sorry, that slot was just taken. We'll keep looking and notify you of the next opening!"

    # Create the appointment
    now = datetime.now(timezone.utc)
    duration = service["duration_minutes"] + service.get("buffer_minutes", 0)
    end_time = slot_time + timedelta(minutes=duration)

    appointment_data = {
        "salon_id": entry["salon_id"],
        "client_id": client["_id"],
        "staff_id": ObjectId(latest_offer["staff_id"]),
        "service_id": entry["service_id"],
        "start_time": slot_time,
        "end_time": end_time,
        "status": "confirmed",
        "source": "waitlist",
        "notes": f"Booked via waitlist SMS reply",
        "created_at": now,
        "updated_at": now,
    }

    await appointments_collection.insert_one(appointment_data)

    # Update waitlist entry
    await waitlist_collection.update_one(
        {"_id": entry["_id"]},
        {"$set": {"status": "booked", "updated_at": now}}
    )

    salon = await salons_collection.find_one({"_id": ObjectId(entry["salon_id"])})
    salon_name = salon["name"] if salon else "the salon"

    return f"You're booked! {service['name']} on {slot_time.strftime('%B %d at %I:%M %p')} at {salon_name}. See you then!"


async def handle_waitlist_decline(client: dict) -> Optional[str]:
    """Handle client declining a waitlist offer."""
    waitlist_collection = get_collection("waitlist")

    # Find their most recent notified waitlist entry
    entry = await waitlist_collection.find_one({
        "client_id": client["_id"],
        "status": "notified",
    }, sort=[("last_notified_at", -1)])

    if not entry:
        return None

    # Set back to active to receive future notifications
    await waitlist_collection.update_one(
        {"_id": entry["_id"]},
        {"$set": {"status": "active", "updated_at": datetime.now(timezone.utc)}}
    )

    return "No problem! We'll keep looking for an opening that works for you."


async def handle_appointment_confirm(client: dict) -> Optional[str]:
    """Handle client confirming an appointment."""
    appointments_collection = get_collection("appointments")

    now = datetime.now(timezone.utc)

    # Find their next upcoming appointment
    appointment = await appointments_collection.find_one({
        "client_id": client["_id"],
        "status": "confirmed",
        "start_time": {"$gt": now},
    }, sort=[("start_time", 1)])

    if not appointment:
        return "You don't have any upcoming appointments to confirm."

    # Mark as confirmed (could add a confirmed_at timestamp)
    await appointments_collection.update_one(
        {"_id": appointment["_id"]},
        {"$set": {"client_confirmed": True, "updated_at": now}}
    )

    return f"Your appointment on {appointment['start_time'].strftime('%B %d at %I:%M %p')} is confirmed. See you then!"


@router.get("/sms-log")
async def get_sms_log(
    client_id: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_salon_user),
):
    """Get SMS log for the salon."""
    sms_log = get_collection("sms_log")

    query = {"salon_id": current_user["salon_id"]}

    if client_id:
        clients_collection = get_collection("clients")
        client = await clients_collection.find_one({"_id": ObjectId(client_id)})
        if client and client.get("phone"):
            query["$or"] = [
                {"to_number": client["phone"]},
                {"from_number": client["phone"]},
            ]

    if direction:
        query["direction"] = direction

    cursor = sms_log.find(query).sort("created_at", -1).limit(limit)
    messages = await cursor.to_list(length=limit)

    return [
        {
            "id": str(msg["_id"]),
            "direction": msg.get("direction", "outbound"),
            "from_number": msg.get("from_number"),
            "to_number": msg.get("to_number"),
            "message": msg.get("message"),
            "status": msg.get("status"),
            "created_at": msg.get("created_at"),
        }
        for msg in messages
    ]


@router.post("/send-test")
async def send_test_sms(
    phone: str,
    message: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Send a test SMS message."""
    result = await sms_service.send_sms(
        to_number=phone,
        message=message,
        salon_id=current_user["salon_id"],
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to send SMS")
        )

    return {"success": True, "message": "Test SMS sent"}


@router.post("/process-pending")
async def process_pending_notifications(
    current_user: dict = Depends(get_current_salon_user),
):
    """Manually trigger processing of pending notifications.

    Normally this runs on a schedule, but can be triggered manually.
    """
    await notification_service.process_pending_notifications()
    return {"message": "Pending notifications processed"}


@router.get("/scheduled")
async def get_scheduled_notifications(
    status_filter: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_salon_user),
):
    """Get scheduled notifications for the salon."""
    scheduled = get_collection("scheduled_notifications")
    appointments = get_collection("appointments")

    # Get appointments for this salon
    salon_appointments = await appointments.find(
        {"salon_id": current_user["salon_id"]}
    ).to_list(length=None)

    appt_ids = [a["_id"] for a in salon_appointments]

    query = {"appointment_id": {"$in": appt_ids}}

    if status_filter:
        query["status"] = status_filter

    cursor = scheduled.find(query).sort("scheduled_for", -1).limit(limit)
    notifications = await cursor.to_list(length=limit)

    return [
        {
            "id": str(n["_id"]),
            "type": n["type"],
            "appointment_id": str(n["appointment_id"]),
            "scheduled_for": n["scheduled_for"],
            "status": n["status"],
            "error": n.get("error"),
            "sent_at": n.get("sent_at"),
        }
        for n in notifications
    ]
