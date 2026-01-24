from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_user
from ...config import settings
from ...schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    SlotLockRequest,
    SlotLockResponse,
)
from ...models.appointment import AppointmentStatus, STATUS_TRANSITIONS
from ...services.websocket_manager import broadcast_appointment_event, EventType

router = APIRouter()


@router.post("/lock", response_model=SlotLockResponse)
async def acquire_slot_lock(
    request: SlotLockRequest,
    current_user: dict = Depends(get_current_user),
):
    """Acquire a temporary lock on a time slot."""
    locks = get_collection("appointment_locks")
    appointments = get_collection("appointments")

    # Check for existing appointment in this slot
    existing_appt = await appointments.find_one({
        "salon_id": current_user["salon_id"],
        "staff_id": ObjectId(request.staff_id),
        "status": {"$nin": ["cancelled", "no_show"]},
        "$or": [
            {
                "start_time": {"$lt": request.end_time},
                "end_time": {"$gt": request.start_time},
            }
        ],
    })

    if existing_appt:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot is already booked",
        )

    # Try to acquire lock (upsert with unique constraint will fail if locked)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.slot_lock_ttl_seconds)

    try:
        lock_data = {
            "salon_id": current_user["salon_id"],
            "staff_id": ObjectId(request.staff_id),
            "start_time": request.start_time,
            "end_time": request.end_time,
            "locked_by": str(current_user["_id"]),
            "expires_at": expires_at,
        }

        result = await locks.insert_one(lock_data)

        return SlotLockResponse(
            lock_id=str(result.inserted_id),
            expires_at=expires_at,
        )
    except Exception:
        # Check if locked by someone else
        existing_lock = await locks.find_one({
            "salon_id": current_user["salon_id"],
            "staff_id": ObjectId(request.staff_id),
            "start_time": request.start_time,
        })

        if existing_lock and existing_lock["locked_by"] == str(current_user["_id"]):
            # Extend own lock
            await locks.update_one(
                {"_id": existing_lock["_id"]},
                {"$set": {"expires_at": expires_at}},
            )
            return SlotLockResponse(
                lock_id=str(existing_lock["_id"]),
                expires_at=expires_at,
            )

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot is currently locked",
        )


@router.delete("/lock/{lock_id}", status_code=status.HTTP_204_NO_CONTENT)
async def release_slot_lock(
    lock_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Release a slot lock."""
    locks = get_collection("appointment_locks")

    await locks.delete_one({
        "_id": ObjectId(lock_id),
        "locked_by": str(current_user["_id"]),
    })


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    request: AppointmentCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new appointment."""
    appointments = get_collection("appointments")
    services = get_collection("services")
    clients = get_collection("clients")
    staff_collection = get_collection("staff")
    salons = get_collection("salons")
    locks = get_collection("appointment_locks")

    # Get service details
    service = await services.find_one({
        "_id": ObjectId(request.service_id),
        "salon_id": current_user["salon_id"],
    })
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Get client
    client = await clients.find_one({
        "_id": ObjectId(request.client_id),
        "salon_id": current_user["salon_id"],
    })
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get staff
    staff = await staff_collection.find_one({
        "_id": ObjectId(request.staff_id),
        "salon_id": current_user["salon_id"],
    })
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Get salon settings
    salon = await salons.find_one({"_id": current_user["salon_id"]})

    # Calculate end time
    duration = service["duration_minutes"] + service.get("buffer_minutes", 0)
    end_time = request.start_time + timedelta(minutes=duration)

    # Check for conflicts
    conflict = await appointments.find_one({
        "salon_id": current_user["salon_id"],
        "staff_id": ObjectId(request.staff_id),
        "status": {"$nin": ["cancelled", "no_show"]},
        "start_time": {"$lt": end_time},
        "end_time": {"$gt": request.start_time},
    })

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Time slot conflicts with existing appointment",
        )

    # Calculate deposit
    salon_settings = salon.get("settings", {})
    deposit_percent = service.get("deposit_override") or salon_settings.get("deposit_percent", 50)
    deposit_amount = int(service["price"] * deposit_percent / 100)

    now = datetime.now(timezone.utc)
    appointment_data = {
        "salon_id": current_user["salon_id"],
        "client_id": ObjectId(request.client_id),
        "staff_id": ObjectId(request.staff_id),
        "service_id": ObjectId(request.service_id),
        "start_time": request.start_time,
        "end_time": end_time,
        "duration_minutes": duration,
        "status": AppointmentStatus.CONFIRMED.value,  # Skip deposit for now
        "payment": {
            "service_price": service["price"],
            "deposit_amount": deposit_amount,
            "deposit_percent": deposit_percent,
        },
        "stripe_payment_intent_id": None,
        "stripe_payment_method_id": request.payment_method_id,
        "deposit_captured": False,
        "notes": request.notes,
        "internal_notes": None,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }

    result = await appointments.insert_one(appointment_data)
    appointment_data["_id"] = result.inserted_id

    # Clear any locks for this slot
    await locks.delete_many({
        "salon_id": current_user["salon_id"],
        "staff_id": ObjectId(request.staff_id),
        "start_time": request.start_time,
    })

    # Update client stats
    await clients.update_one(
        {"_id": ObjectId(request.client_id)},
        {"$inc": {"stats.total_appointments": 1}},
    )

    response = AppointmentResponse.from_mongo(
        appointment_data,
        client_name=f"{client['first_name']} {client['last_name']}",
        staff_name=f"{staff['first_name']} {staff['last_name']}",
        service_name=service["name"],
    )

    # Broadcast WebSocket event
    await broadcast_appointment_event(
        str(current_user["salon_id"]),
        EventType.APPOINTMENT_CREATED,
        response.model_dump(mode="json"),
    )

    return response


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get an appointment by ID."""
    appointments = get_collection("appointments")

    appointment = await appointments.find_one({
        "_id": ObjectId(appointment_id),
        "salon_id": current_user["salon_id"],
    })

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return AppointmentResponse.from_mongo(appointment)


@router.put("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: str,
    request: AppointmentUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update appointment notes."""
    appointments = get_collection("appointments")

    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await appointments.find_one_and_update(
        {"_id": ObjectId(appointment_id), "salon_id": current_user["salon_id"]},
        {"$set": update_data, "$inc": {"version": 1}},
        return_document=True,
    )

    if not result:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return AppointmentResponse.from_mongo(result)


@router.post("/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    appointment_id: str,
    new_start_time: datetime = Query(...),
    new_staff_id: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Reschedule an appointment to a new time and/or staff member."""
    appointments = get_collection("appointments")
    services = get_collection("services")
    staff_collection = get_collection("staff")

    appointment = await appointments.find_one({
        "_id": ObjectId(appointment_id),
        "salon_id": current_user["salon_id"],
    })

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Can only reschedule pending or confirmed appointments
    if appointment["status"] not in ["pending_deposit", "confirmed"]:
        raise HTTPException(
            status_code=400,
            detail="Can only reschedule pending or confirmed appointments",
        )

    # Use new staff or keep existing
    staff_id = ObjectId(new_staff_id) if new_staff_id else appointment["staff_id"]

    # Verify staff exists
    staff = await staff_collection.find_one({
        "_id": staff_id,
        "salon_id": current_user["salon_id"],
    })
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Get service to calculate end time
    service = await services.find_one({"_id": appointment["service_id"]})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    duration = service["duration_minutes"] + service.get("buffer_minutes", 0)
    new_end_time = new_start_time + timedelta(minutes=duration)

    # Check for conflicts (excluding current appointment)
    conflict = await appointments.find_one({
        "_id": {"$ne": ObjectId(appointment_id)},
        "salon_id": current_user["salon_id"],
        "staff_id": staff_id,
        "status": {"$nin": ["cancelled", "no_show"]},
        "start_time": {"$lt": new_end_time},
        "end_time": {"$gt": new_start_time},
    })

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="New time slot conflicts with existing appointment",
        )

    now = datetime.now(timezone.utc)
    update_data = {
        "staff_id": staff_id,
        "start_time": new_start_time,
        "end_time": new_end_time,
        "updated_at": now,
        "rescheduled_at": now,
        "rescheduled_from": {
            "staff_id": appointment["staff_id"],
            "start_time": appointment["start_time"],
            "end_time": appointment["end_time"],
        },
    }

    result = await appointments.find_one_and_update(
        {"_id": ObjectId(appointment_id)},
        {"$set": update_data, "$inc": {"version": 1}},
        return_document=True,
    )

    response = AppointmentResponse.from_mongo(result)

    # Broadcast WebSocket event
    await broadcast_appointment_event(
        str(current_user["salon_id"]),
        EventType.APPOINTMENT_RESCHEDULED,
        response.model_dump(mode="json"),
    )

    return response


@router.post("/{appointment_id}/check-in", response_model=AppointmentResponse)
async def check_in_appointment(
    appointment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark appointment as checked in."""
    return await _transition_status(
        appointment_id, AppointmentStatus.CHECKED_IN, current_user
    )


@router.post("/{appointment_id}/start", response_model=AppointmentResponse)
async def start_appointment(
    appointment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark appointment as in progress."""
    return await _transition_status(
        appointment_id, AppointmentStatus.IN_PROGRESS, current_user
    )


@router.post("/{appointment_id}/complete", response_model=AppointmentResponse)
async def complete_appointment(
    appointment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark appointment as completed."""
    appointments = get_collection("appointments")
    clients = get_collection("clients")

    result = await _transition_status(
        appointment_id, AppointmentStatus.COMPLETED, current_user
    )

    # Update client stats
    appointment = await appointments.find_one({"_id": ObjectId(appointment_id)})
    if appointment:
        await clients.update_one(
            {"_id": appointment["client_id"]},
            {
                "$inc": {"stats.completed_appointments": 1},
                "$set": {"stats.last_visit": datetime.now(timezone.utc)},
            },
        )

    return result


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    appointment_id: str,
    request: AppointmentStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Cancel an appointment."""
    appointments = get_collection("appointments")
    clients = get_collection("clients")

    appointment = await appointments.find_one({
        "_id": ObjectId(appointment_id),
        "salon_id": current_user["salon_id"],
    })

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    current_status = AppointmentStatus(appointment["status"])
    if AppointmentStatus.CANCELLED not in STATUS_TRANSITIONS.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel appointment in {current_status.value} status",
        )

    now = datetime.now(timezone.utc)
    update_data = {
        "status": AppointmentStatus.CANCELLED.value,
        "cancelled_at": now,
        "cancelled_by": "staff",
        "cancellation_reason": request.reason,
        "updated_at": now,
    }

    result = await appointments.find_one_and_update(
        {"_id": ObjectId(appointment_id)},
        {"$set": update_data, "$inc": {"version": 1}},
        return_document=True,
    )

    # Update client stats
    await clients.update_one(
        {"_id": appointment["client_id"]},
        {"$inc": {"stats.cancelled_appointments": 1}},
    )

    response = AppointmentResponse.from_mongo(result)

    # Broadcast WebSocket event
    await broadcast_appointment_event(
        str(current_user["salon_id"]),
        EventType.APPOINTMENT_CANCELLED,
        response.model_dump(mode="json"),
    )

    return response


@router.post("/{appointment_id}/no-show", response_model=AppointmentResponse)
async def mark_no_show(
    appointment_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark appointment as no-show."""
    appointments = get_collection("appointments")
    clients = get_collection("clients")

    result = await _transition_status(
        appointment_id, AppointmentStatus.NO_SHOW, current_user
    )

    # Update client stats
    appointment = await appointments.find_one({"_id": ObjectId(appointment_id)})
    if appointment:
        await clients.update_one(
            {"_id": appointment["client_id"]},
            {"$inc": {"stats.no_shows": 1}},
        )

    return result


async def _transition_status(
    appointment_id: str,
    new_status: AppointmentStatus,
    current_user: dict,
) -> AppointmentResponse:
    """Helper to transition appointment status."""
    appointments = get_collection("appointments")

    appointment = await appointments.find_one({
        "_id": ObjectId(appointment_id),
        "salon_id": current_user["salon_id"],
    })

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    current_status = AppointmentStatus(appointment["status"])
    if new_status not in STATUS_TRANSITIONS.get(current_status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {current_status.value} to {new_status.value}",
        )

    result = await appointments.find_one_and_update(
        {"_id": ObjectId(appointment_id)},
        {
            "$set": {
                "status": new_status.value,
                "updated_at": datetime.now(timezone.utc),
            },
            "$inc": {"version": 1},
        },
        return_document=True,
    )

    return AppointmentResponse.from_mongo(result)
