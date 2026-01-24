from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_user, require_role
from ...schemas.staff import (
    StaffCreate,
    StaffUpdate,
    StaffResponse,
    StaffScheduleUpdate,
    ScheduleOverrideCreate,
)

router = APIRouter()


@router.get("", response_model=list[StaffResponse])
async def list_staff(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    """List all staff members for the current salon."""
    staff_collection = get_collection("staff")

    query = {"salon_id": current_user["salon_id"]}
    if not include_inactive:
        query["$or"] = [{"deleted_at": None}, {"deleted_at": {"$exists": False}}]
        query["is_active"] = True

    cursor = staff_collection.find(query).sort("sort_order", 1)
    staff_list = await cursor.to_list(length=None)

    return [StaffResponse.from_mongo(s) for s in staff_list]


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
async def create_staff(
    request: StaffCreate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Create a new staff member."""
    staff_collection = get_collection("staff")

    now = datetime.now(timezone.utc)
    staff_data = {
        "salon_id": current_user["salon_id"],
        "first_name": request.first_name,
        "last_name": request.last_name,
        "email": request.email,
        "phone": request.phone,
        "display_name": request.display_name,
        "color": request.color,
        "working_hours": (
            request.working_hours.model_dump() if request.working_hours else {}
        ),
        "service_ids": [ObjectId(sid) for sid in request.service_ids],
        "is_active": True,
        "sort_order": 0,
        "created_at": now,
        "updated_at": now,
    }

    result = await staff_collection.insert_one(staff_data)
    staff_data["_id"] = result.inserted_id

    return StaffResponse.from_mongo(staff_data)


@router.get("/{staff_id}", response_model=StaffResponse)
async def get_staff(
    staff_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a staff member by ID."""
    staff_collection = get_collection("staff")

    staff = await staff_collection.find_one({
        "_id": ObjectId(staff_id),
        "salon_id": current_user["salon_id"],
    })

    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found",
        )

    return StaffResponse.from_mongo(staff)


@router.put("/{staff_id}", response_model=StaffResponse)
async def update_staff(
    staff_id: str,
    request: StaffUpdate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Update a staff member."""
    staff_collection = get_collection("staff")

    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    # Convert service_ids to ObjectIds
    if "service_ids" in update_data:
        update_data["service_ids"] = [ObjectId(sid) for sid in update_data["service_ids"]]

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await staff_collection.find_one_and_update(
        {"_id": ObjectId(staff_id), "salon_id": current_user["salon_id"]},
        {"$set": update_data},
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found",
        )

    return StaffResponse.from_mongo(result)


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    staff_id: str,
    current_user: dict = Depends(require_role("owner", "admin")),
):
    """Soft delete a staff member."""
    staff_collection = get_collection("staff")

    result = await staff_collection.find_one_and_update(
        {"_id": ObjectId(staff_id), "salon_id": current_user["salon_id"]},
        {
            "$set": {
                "deleted_at": datetime.now(timezone.utc),
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found",
        )


@router.put("/{staff_id}/schedule", response_model=StaffResponse)
async def update_staff_schedule(
    staff_id: str,
    request: StaffScheduleUpdate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Update staff working hours."""
    staff_collection = get_collection("staff")

    result = await staff_collection.find_one_and_update(
        {"_id": ObjectId(staff_id), "salon_id": current_user["salon_id"]},
        {
            "$set": {
                "working_hours": request.working_hours.model_dump(),
                "updated_at": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found",
        )

    return StaffResponse.from_mongo(result)


@router.post("/{staff_id}/schedule/override", status_code=status.HTTP_201_CREATED)
async def create_schedule_override(
    staff_id: str,
    request: ScheduleOverrideCreate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Create a schedule override (vacation, custom hours)."""
    staff_collection = get_collection("staff")
    overrides_collection = get_collection("staff_schedule_overrides")

    # Verify staff exists
    staff = await staff_collection.find_one({
        "_id": ObjectId(staff_id),
        "salon_id": current_user["salon_id"],
    })

    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff member not found",
        )

    # Upsert override for the date
    override_data = {
        "staff_id": ObjectId(staff_id),
        "date": datetime.combine(request.date, datetime.min.time()),
        "override_type": request.override_type,
        "custom_slots": [s.model_dump() for s in request.custom_slots],
        "note": request.note,
    }

    await overrides_collection.update_one(
        {"staff_id": ObjectId(staff_id), "date": override_data["date"]},
        {"$set": override_data},
        upsert=True,
    )

    return {"message": "Schedule override created"}


@router.get("/{staff_id}/schedule/overrides")
async def list_schedule_overrides(
    staff_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user),
):
    """List schedule overrides for a staff member."""
    overrides_collection = get_collection("staff_schedule_overrides")

    query = {"staff_id": ObjectId(staff_id)}

    if start_date:
        query["date"] = {"$gte": datetime.combine(start_date, datetime.min.time())}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = datetime.combine(end_date, datetime.min.time())
        else:
            query["date"] = {"$lte": datetime.combine(end_date, datetime.min.time())}

    cursor = overrides_collection.find(query).sort("date", 1)
    overrides = await cursor.to_list(length=None)

    return [
        {
            "id": str(o["_id"]),
            "staff_id": str(o["staff_id"]),
            "date": o["date"].date().isoformat(),
            "override_type": o["override_type"],
            "custom_slots": o.get("custom_slots", []),
            "note": o.get("note"),
        }
        for o in overrides
    ]


@router.delete("/{staff_id}/schedule/override/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_override(
    staff_id: str,
    override_id: str,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Delete a schedule override."""
    overrides_collection = get_collection("staff_schedule_overrides")

    result = await overrides_collection.delete_one({
        "_id": ObjectId(override_id),
        "staff_id": ObjectId(staff_id),
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule override not found",
        )
