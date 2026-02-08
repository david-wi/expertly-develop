"""Waitlist API endpoints."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_salon_user
from ...schemas.waitlist import (
    WaitlistCreate,
    WaitlistUpdate,
    WaitlistResponse,
    AvailabilityMatch,
)
from ...models.waitlist import WaitlistStatus
from ...services.availability_parser import parse_availability_description

router = APIRouter()


@router.get("", response_model=list[WaitlistResponse])
async def list_waitlist(
    status_filter: Optional[WaitlistStatus] = Query(None),
    service_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_salon_user),
):
    """List all waitlist entries for the salon."""
    waitlist_collection = get_collection("waitlist")
    clients_collection = get_collection("clients")
    services_collection = get_collection("services")

    query = {"salon_id": current_user["salon_id"]}
    if status_filter:
        query["status"] = status_filter.value
    else:
        # Default to active entries
        query["status"] = {"$in": [WaitlistStatus.ACTIVE.value, WaitlistStatus.NOTIFIED.value]}

    if service_id:
        query["service_id"] = ObjectId(service_id)

    cursor = waitlist_collection.find(query).sort("created_at", -1)
    entries = await cursor.to_list(length=100)

    # Fetch client and service names
    results = []
    for entry in entries:
        client = await clients_collection.find_one({"_id": entry["client_id"]})
        service = await services_collection.find_one({"_id": entry["service_id"]})

        client_name = f"{client['first_name']} {client['last_name']}" if client else "Unknown"
        service_name = service["name"] if service else "Unknown"

        results.append(WaitlistResponse.from_mongo(entry, client_name, service_name))

    return results


@router.post("", response_model=WaitlistResponse, status_code=status.HTTP_201_CREATED)
async def create_waitlist_entry(
    request: WaitlistCreate,
    current_user: dict = Depends(get_current_salon_user),
):
    """Add a client to the waitlist."""
    waitlist_collection = get_collection("waitlist")
    clients_collection = get_collection("clients")
    services_collection = get_collection("services")

    # Verify client exists
    client = await clients_collection.find_one({
        "_id": ObjectId(request.client_id),
        "salon_id": current_user["salon_id"],
    })
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Verify service exists
    service = await services_collection.find_one({
        "_id": ObjectId(request.service_id),
        "salon_id": current_user["salon_id"],
    })
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Check for existing active entry for same client/service
    existing = await waitlist_collection.find_one({
        "salon_id": current_user["salon_id"],
        "client_id": ObjectId(request.client_id),
        "service_id": ObjectId(request.service_id),
        "status": {"$in": [WaitlistStatus.ACTIVE.value, WaitlistStatus.NOTIFIED.value]},
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Client already on waitlist for this service"
        )

    # Parse availability description
    preferences = await parse_availability_description(
        request.availability_description,
        current_user["salon_id"],
        request.preferred_staff_id,
        request.expires_in_days,
    )

    now = datetime.now(timezone.utc)
    entry_data = {
        "salon_id": current_user["salon_id"],
        "client_id": ObjectId(request.client_id),
        "service_id": ObjectId(request.service_id),
        "availability_description": request.availability_description,
        "preferences": preferences.model_dump(),
        "status": WaitlistStatus.ACTIVE.value,
        "notification_count": 0,
        "last_notified_at": None,
        "offered_slots": [],
        "created_at": now,
        "updated_at": now,
        "expires_at": now + timedelta(days=request.expires_in_days),
    }

    result = await waitlist_collection.insert_one(entry_data)
    entry_data["_id"] = result.inserted_id

    client_name = f"{client['first_name']} {client['last_name']}"
    return WaitlistResponse.from_mongo(entry_data, client_name, service["name"])


@router.get("/{entry_id}", response_model=WaitlistResponse)
async def get_waitlist_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Get a specific waitlist entry."""
    waitlist_collection = get_collection("waitlist")
    clients_collection = get_collection("clients")
    services_collection = get_collection("services")

    entry = await waitlist_collection.find_one({
        "_id": ObjectId(entry_id),
        "salon_id": current_user["salon_id"],
    })
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    client = await clients_collection.find_one({"_id": entry["client_id"]})
    service = await services_collection.find_one({"_id": entry["service_id"]})

    client_name = f"{client['first_name']} {client['last_name']}" if client else "Unknown"
    service_name = service["name"] if service else "Unknown"

    return WaitlistResponse.from_mongo(entry, client_name, service_name)


@router.put("/{entry_id}", response_model=WaitlistResponse)
async def update_waitlist_entry(
    entry_id: str,
    request: WaitlistUpdate,
    current_user: dict = Depends(get_current_salon_user),
):
    """Update a waitlist entry."""
    waitlist_collection = get_collection("waitlist")
    clients_collection = get_collection("clients")
    services_collection = get_collection("services")

    entry = await waitlist_collection.find_one({
        "_id": ObjectId(entry_id),
        "salon_id": current_user["salon_id"],
    })
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    update_data = {"updated_at": datetime.now(timezone.utc)}

    if request.availability_description:
        update_data["availability_description"] = request.availability_description
        # Re-parse preferences
        preferences = await parse_availability_description(
            request.availability_description,
            current_user["salon_id"],
            request.preferred_staff_id,
        )
        update_data["preferences"] = preferences.model_dump()

    if request.status:
        update_data["status"] = request.status.value

    result = await waitlist_collection.find_one_and_update(
        {"_id": ObjectId(entry_id)},
        {"$set": update_data},
        return_document=True,
    )

    client = await clients_collection.find_one({"_id": result["client_id"]})
    service = await services_collection.find_one({"_id": result["service_id"]})

    client_name = f"{client['first_name']} {client['last_name']}" if client else "Unknown"
    service_name = service["name"] if service else "Unknown"

    return WaitlistResponse.from_mongo(result, client_name, service_name)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_waitlist_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Remove a waitlist entry (mark as cancelled)."""
    waitlist_collection = get_collection("waitlist")

    result = await waitlist_collection.find_one_and_update(
        {
            "_id": ObjectId(entry_id),
            "salon_id": current_user["salon_id"],
        },
        {
            "$set": {
                "status": WaitlistStatus.CANCELLED.value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if not result:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")


@router.get("/matches/check", response_model=list[AvailabilityMatch])
async def check_waitlist_matches(
    current_user: dict = Depends(get_current_salon_user),
):
    """Check for any matching availability for active waitlist entries.

    This is called periodically or after cancellations/schedule changes
    to find potential matches for waitlist clients.
    """
    waitlist_collection = get_collection("waitlist")
    clients_collection = get_collection("clients")
    services_collection = get_collection("services")
    staff_collection = get_collection("staff")
    appointments_collection = get_collection("appointments")

    # Get active waitlist entries
    cursor = waitlist_collection.find({
        "salon_id": current_user["salon_id"],
        "status": WaitlistStatus.ACTIVE.value,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })
    entries = await cursor.to_list(length=100)

    matches = []

    for entry in entries:
        preferences = entry.get("preferences", {})
        service = await services_collection.find_one({"_id": entry["service_id"]})
        if not service:
            continue

        client = await clients_collection.find_one({"_id": entry["client_id"]})
        if not client:
            continue

        # Get eligible staff
        preferred_staff_ids = preferences.get("preferred_staff_ids", [])
        any_staff_ok = preferences.get("any_staff_ok", True)

        if preferred_staff_ids:
            staff_query = {"_id": {"$in": [ObjectId(sid) for sid in preferred_staff_ids]}}
        elif service.get("eligible_staff_ids"):
            staff_query = {"_id": {"$in": service["eligible_staff_ids"]}}
        else:
            staff_query = {"salon_id": current_user["salon_id"], "is_active": True}

        staff_cursor = staff_collection.find(staff_query)
        staff_list = await staff_cursor.to_list(length=20)

        # Check next 14 days for availability
        preferred_days = preferences.get("preferred_days", [])
        time_ranges = preferences.get("preferred_time_ranges", [])

        for day_offset in range(14):
            check_date = datetime.now(timezone.utc) + timedelta(days=day_offset)

            # Check day preference
            if preferred_days and check_date.weekday() not in preferred_days:
                continue

            # For each staff member, check if they have availability
            for staff in staff_list:
                # Check staff working hours for this day
                working_hours = staff.get("working_hours", {}).get("schedule", {})
                day_schedule = working_hours.get(str(check_date.weekday()), {})

                if not day_schedule.get("is_working", False):
                    continue

                # Check for open slots
                for slot in day_schedule.get("slots", []):
                    slot_start_str = slot.get("start", "09:00")
                    slot_end_str = slot.get("end", "17:00")

                    # Check against preferred time ranges
                    if time_ranges:
                        matches_time = False
                        for tr in time_ranges:
                            if tr["start"] <= slot_start_str and slot_end_str <= tr["end"]:
                                matches_time = True
                                break
                        if not matches_time:
                            continue

                    # Check for existing appointments blocking this slot
                    slot_start = datetime.combine(
                        check_date.date(),
                        datetime.strptime(slot_start_str, "%H:%M").time()
                    ).replace(tzinfo=timezone.utc)

                    slot_end = datetime.combine(
                        check_date.date(),
                        datetime.strptime(slot_end_str, "%H:%M").time()
                    ).replace(tzinfo=timezone.utc)

                    # Find available time within this slot
                    service_duration = service["duration_minutes"] + service.get("buffer_minutes", 0)

                    # Check appointments
                    existing = await appointments_collection.find({
                        "staff_id": staff["_id"],
                        "status": {"$nin": ["cancelled", "no_show"]},
                        "start_time": {"$lt": slot_end},
                        "end_time": {"$gt": slot_start},
                    }).to_list(length=None)

                    # Find gaps
                    if not existing:
                        # Whole slot is available
                        matches.append(AvailabilityMatch(
                            waitlist_entry_id=str(entry["_id"]),
                            client_id=str(client["_id"]),
                            client_name=f"{client['first_name']} {client['last_name']}",
                            client_phone=client.get("phone"),
                            client_language=client.get("language", "en"),
                            service_id=str(service["_id"]),
                            service_name=service["name"],
                            staff_id=str(staff["_id"]),
                            staff_name=f"{staff['first_name']} {staff['last_name']}",
                            start_time=slot_start,
                            end_time=slot_start + timedelta(minutes=service_duration),
                            match_reason="Available slot",
                        ))

                        # Only return first match per entry for now
                        break

                # Limit matches per entry
                if any(m.waitlist_entry_id == str(entry["_id"]) for m in matches):
                    break

    return matches


@router.post("/{entry_id}/notify")
async def notify_waitlist_client(
    entry_id: str,
    slot_start_time: datetime,
    staff_id: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Send notification to a waitlist client about available slot.

    This will be integrated with Twilio for SMS notifications.
    """
    waitlist_collection = get_collection("waitlist")
    clients_collection = get_collection("clients")
    services_collection = get_collection("services")
    staff_collection = get_collection("staff")

    entry = await waitlist_collection.find_one({
        "_id": ObjectId(entry_id),
        "salon_id": current_user["salon_id"],
    })
    if not entry:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    client = await clients_collection.find_one({"_id": entry["client_id"]})
    service = await services_collection.find_one({"_id": entry["service_id"]})
    staff = await staff_collection.find_one({"_id": ObjectId(staff_id)})

    if not all([client, service, staff]):
        raise HTTPException(status_code=404, detail="Related data not found")

    # Record the notification
    now = datetime.now(timezone.utc)
    offered_slot = {
        "staff_id": staff_id,
        "staff_name": f"{staff['first_name']} {staff['last_name']}",
        "start_time": slot_start_time.isoformat(),
        "offered_at": now.isoformat(),
    }

    await waitlist_collection.update_one(
        {"_id": ObjectId(entry_id)},
        {
            "$set": {
                "status": WaitlistStatus.NOTIFIED.value,
                "last_notified_at": now,
                "updated_at": now,
            },
            "$inc": {"notification_count": 1},
            "$push": {"offered_slots": offered_slot},
        },
    )

    # TODO: Send actual SMS/email via Twilio
    # For now, return the notification details
    return {
        "message": "Notification recorded",
        "client_name": f"{client['first_name']} {client['last_name']}",
        "client_phone": client.get("phone"),
        "client_language": client.get("language", "en"),
        "service": service["name"],
        "staff": f"{staff['first_name']} {staff['last_name']}",
        "slot_time": slot_start_time.isoformat(),
    }
