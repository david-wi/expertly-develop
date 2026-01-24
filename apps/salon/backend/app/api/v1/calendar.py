from datetime import datetime, date, timedelta, time, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_user
from ...schemas.calendar import (
    CalendarResponse,
    AvailabilityResponse,
    AvailableSlot,
    StaffCalendarDay,
)
from ...schemas.staff import StaffResponse
from ...schemas.appointment import AppointmentResponse

router = APIRouter()


@router.get("", response_model=CalendarResponse)
async def get_calendar(
    start_date: date = Query(...),
    end_date: date = Query(...),
    staff_ids: Optional[str] = Query(None),  # Comma-separated
    current_user: dict = Depends(get_current_user),
):
    """Get calendar view with appointments."""
    if (end_date - start_date).days > 31:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 31 days")

    staff_collection = get_collection("staff")
    appointments_collection = get_collection("appointments")
    overrides_collection = get_collection("staff_schedule_overrides")

    # Parse staff IDs
    staff_id_list = None
    if staff_ids:
        staff_id_list = [ObjectId(sid.strip()) for sid in staff_ids.split(",")]

    # Get staff
    staff_query = {
        "salon_id": current_user["salon_id"],
        "is_active": True,
        "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
    }
    if staff_id_list:
        staff_query["_id"] = {"$in": staff_id_list}

    staff_cursor = staff_collection.find(staff_query).sort("sort_order", 1)
    staff_list = await staff_cursor.to_list(length=None)
    staff_responses = [StaffResponse.from_mongo(s) for s in staff_list]

    # Get appointments in range
    start_dt = datetime.combine(start_date, time.min).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max).replace(tzinfo=timezone.utc)

    appt_query = {
        "salon_id": current_user["salon_id"],
        "start_time": {"$gte": start_dt, "$lte": end_dt},
        "status": {"$nin": ["cancelled"]},
    }
    if staff_id_list:
        appt_query["staff_id"] = {"$in": staff_id_list}

    appt_cursor = appointments_collection.find(appt_query)
    appointments = await appt_cursor.to_list(length=None)

    # Get schedule overrides
    override_query = {
        "staff_id": {"$in": [ObjectId(s.id) for s in staff_responses]},
        "date": {"$gte": start_dt, "$lte": end_dt},
    }
    override_cursor = overrides_collection.find(override_query)
    overrides = await override_cursor.to_list(length=None)

    # Build override lookup
    override_lookup = {}
    for o in overrides:
        key = (str(o["staff_id"]), o["date"].date())
        override_lookup[key] = o

    # Build response
    days = {}
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.isoformat()
        days[date_str] = []

        day_of_week = str(current_date.weekday())

        for staff in staff_list:
            staff_id = str(staff["_id"])

            # Get working hours for this day
            working_hours = staff.get("working_hours", {}).get("schedule", {})
            day_schedule = working_hours.get(day_of_week, {"is_working": False, "slots": []})

            # Check for override
            override_key = (staff_id, current_date)
            override = override_lookup.get(override_key)

            if override:
                if override["override_type"] == "off":
                    is_working = False
                    slots = []
                else:  # custom
                    is_working = True
                    slots = override.get("custom_slots", [])
            else:
                is_working = day_schedule.get("is_working", False)
                slots = day_schedule.get("slots", [])

            # Get appointments for this staff on this day
            day_start = datetime.combine(current_date, time.min).replace(tzinfo=timezone.utc)
            day_end = datetime.combine(current_date, time.max).replace(tzinfo=timezone.utc)

            staff_appointments = []
            for a in appointments:
                if str(a["staff_id"]) != staff_id:
                    continue
                # Ensure start_time is timezone-aware
                appt_start = a["start_time"]
                if appt_start.tzinfo is None:
                    appt_start = appt_start.replace(tzinfo=timezone.utc)
                if day_start <= appt_start <= day_end:
                    staff_appointments.append(AppointmentResponse.from_mongo(a))

            days[date_str].append(
                StaffCalendarDay(
                    staff_id=staff_id,
                    date=current_date,
                    working_hours=slots,
                    appointments=staff_appointments,
                    is_working=is_working,
                )
            )

        current_date += timedelta(days=1)

    return CalendarResponse(
        start_date=start_date,
        end_date=end_date,
        staff=staff_responses,
        days=days,
    )


@router.get("/availability", response_model=AvailabilityResponse)
async def get_availability(
    date: date = Query(...),
    service_id: str = Query(...),
    staff_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get available time slots for a service on a date."""
    services = get_collection("services")
    staff_collection = get_collection("staff")
    appointments_collection = get_collection("appointments")
    salons = get_collection("salons")
    overrides_collection = get_collection("staff_schedule_overrides")

    # Get service
    service = await services.find_one({
        "_id": ObjectId(service_id),
        "salon_id": current_user["salon_id"],
    })
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Get salon settings
    salon = await salons.find_one({"_id": current_user["salon_id"]})
    salon_settings = salon.get("settings", {})
    slot_duration = salon_settings.get("slot_duration_minutes", 15)

    # Get eligible staff
    staff_query = {
        "salon_id": current_user["salon_id"],
        "is_active": True,
        "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
    }

    if staff_id:
        staff_query["_id"] = ObjectId(staff_id)
    elif service.get("eligible_staff_ids"):
        staff_query["_id"] = {"$in": service["eligible_staff_ids"]}

    staff_cursor = staff_collection.find(staff_query)
    staff_list = await staff_cursor.to_list(length=None)

    if not staff_list:
        return AvailabilityResponse(
            date=date,
            service_id=service_id,
            service_name=service["name"],
            duration_minutes=service["duration_minutes"],
            slots=[],
        )

    # Get existing appointments for the day
    day_start = datetime.combine(date, time.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(date, time.max).replace(tzinfo=timezone.utc)

    appt_cursor = appointments_collection.find({
        "salon_id": current_user["salon_id"],
        "staff_id": {"$in": [s["_id"] for s in staff_list]},
        "start_time": {"$gte": day_start, "$lte": day_end},
        "status": {"$nin": ["cancelled", "no_show"]},
    })
    existing_appointments = await appt_cursor.to_list(length=None)

    # Build appointment lookup by staff
    appt_by_staff = {}
    for appt in existing_appointments:
        sid = str(appt["staff_id"])
        if sid not in appt_by_staff:
            appt_by_staff[sid] = []
        appt_by_staff[sid].append(appt)

    # Get overrides for this date
    override_cursor = overrides_collection.find({
        "staff_id": {"$in": [s["_id"] for s in staff_list]},
        "date": day_start,
    })
    overrides = {str(o["staff_id"]): o for o in await override_cursor.to_list(length=None)}

    # Calculate available slots
    service_duration = service["duration_minutes"] + service.get("buffer_minutes", 0)
    day_of_week = str(date.weekday())
    available_slots = []

    for staff in staff_list:
        staff_id = str(staff["_id"])

        # Get working hours
        override = overrides.get(staff_id)
        if override:
            if override["override_type"] == "off":
                continue
            work_slots = override.get("custom_slots", [])
        else:
            day_schedule = staff.get("working_hours", {}).get("schedule", {}).get(day_of_week, {})
            if not day_schedule.get("is_working", False):
                continue
            work_slots = day_schedule.get("slots", [])

        # Get appointments for this staff
        staff_appointments = appt_by_staff.get(staff_id, [])

        # Generate time slots
        for work_slot in work_slots:
            start_str = work_slot.get("start", "09:00")
            end_str = work_slot.get("end", "17:00")

            start_parts = start_str.split(":")
            end_parts = end_str.split(":")

            slot_start = datetime.combine(
                date,
                time(int(start_parts[0]), int(start_parts[1]))
            ).replace(tzinfo=timezone.utc)

            slot_end = datetime.combine(
                date,
                time(int(end_parts[0]), int(end_parts[1]))
            ).replace(tzinfo=timezone.utc)

            current_slot = slot_start
            while current_slot + timedelta(minutes=service_duration) <= slot_end:
                slot_end_time = current_slot + timedelta(minutes=service_duration)

                # Check for conflicts
                has_conflict = False
                for appt in staff_appointments:
                    if (current_slot < appt["end_time"] and slot_end_time > appt["start_time"]):
                        has_conflict = True
                        break

                if not has_conflict:
                    available_slots.append(
                        AvailableSlot(
                            start_time=current_slot,
                            end_time=slot_end_time,
                            staff_id=staff_id,
                            staff_name=f"{staff['first_name']} {staff['last_name']}",
                        )
                    )

                current_slot += timedelta(minutes=slot_duration)

    # Sort by time, then by staff
    available_slots.sort(key=lambda s: (s.start_time, s.staff_name))

    return AvailabilityResponse(
        date=date,
        service_id=service_id,
        service_name=service["name"],
        duration_minutes=service["duration_minutes"],
        slots=available_slots,
    )
