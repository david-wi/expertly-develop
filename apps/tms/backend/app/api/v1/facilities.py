from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.facility import Facility, FacilityHours

router = APIRouter()


class FacilityCreate(BaseModel):
    name: str
    facility_type: str = "warehouse"
    customer_id: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    zip_code: str
    country: str = "USA"
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    hours: List[FacilityHours] = []
    appointment_required: bool = False
    appointment_lead_time_hours: int = 24
    dock_hours: Optional[str] = None
    has_dock: bool = True
    has_forklift: bool = True
    driver_assist_required: bool = False
    special_instructions: Optional[str] = None
    gate_code: Optional[str] = None
    check_in_process: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FacilityUpdate(BaseModel):
    name: Optional[str] = None
    facility_type: Optional[str] = None
    customer_id: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    hours: Optional[List[FacilityHours]] = None
    appointment_required: Optional[bool] = None
    appointment_lead_time_hours: Optional[int] = None
    dock_hours: Optional[str] = None
    has_dock: Optional[bool] = None
    has_forklift: Optional[bool] = None
    driver_assist_required: Optional[bool] = None
    special_instructions: Optional[str] = None
    gate_code: Optional[str] = None
    check_in_process: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class FacilityResponse(BaseModel):
    id: str
    name: str
    facility_type: str
    customer_id: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    zip_code: str
    country: str
    full_address: str
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    hours: List[FacilityHours]
    appointment_required: bool
    appointment_lead_time_hours: int
    dock_hours: Optional[str] = None
    has_dock: bool
    has_forklift: bool
    driver_assist_required: bool
    special_instructions: Optional[str] = None
    gate_code: Optional[str] = None
    check_in_process: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def facility_to_response(facility: Facility) -> FacilityResponse:
    """Convert Facility model to response schema."""
    return FacilityResponse(
        id=str(facility.id),
        name=facility.name,
        facility_type=facility.facility_type,
        customer_id=str(facility.customer_id) if facility.customer_id else None,
        address_line1=facility.address_line1,
        address_line2=facility.address_line2,
        city=facility.city,
        state=facility.state,
        zip_code=facility.zip_code,
        country=facility.country,
        full_address=facility.full_address,
        contact_name=facility.contact_name,
        contact_phone=facility.contact_phone,
        contact_email=facility.contact_email,
        hours=facility.hours,
        appointment_required=facility.appointment_required,
        appointment_lead_time_hours=facility.appointment_lead_time_hours,
        dock_hours=facility.dock_hours,
        has_dock=facility.has_dock,
        has_forklift=facility.has_forklift,
        driver_assist_required=facility.driver_assist_required,
        special_instructions=facility.special_instructions,
        gate_code=facility.gate_code,
        check_in_process=facility.check_in_process,
        latitude=facility.latitude,
        longitude=facility.longitude,
    )


@router.get("", response_model=List[FacilityResponse])
async def list_facilities(
    customer_id: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
):
    """List all facilities with optional filters."""
    db = get_database()

    query = {}
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if state:
        query["state"] = state.upper()
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.facilities.find(query).sort("name", 1)
    facilities = await cursor.to_list(1000)

    return [facility_to_response(Facility(**f)) for f in facilities]


@router.get("/{facility_id}", response_model=FacilityResponse)
async def get_facility(facility_id: str):
    """Get a facility by ID."""
    db = get_database()

    facility = await db.facilities.find_one({"_id": ObjectId(facility_id)})
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    return facility_to_response(Facility(**facility))


@router.post("", response_model=FacilityResponse)
async def create_facility(data: FacilityCreate):
    """Create a new facility."""
    db = get_database()

    facility_data = data.model_dump()
    if facility_data.get("customer_id"):
        facility_data["customer_id"] = ObjectId(facility_data["customer_id"])

    facility = Facility(**facility_data)
    await db.facilities.insert_one(facility.model_dump_mongo())

    return facility_to_response(facility)


@router.patch("/{facility_id}", response_model=FacilityResponse)
async def update_facility(facility_id: str, data: FacilityUpdate):
    """Update a facility."""
    db = get_database()

    facility_doc = await db.facilities.find_one({"_id": ObjectId(facility_id)})
    if not facility_doc:
        raise HTTPException(status_code=404, detail="Facility not found")

    facility = Facility(**facility_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    if "customer_id" in update_data and update_data["customer_id"]:
        update_data["customer_id"] = ObjectId(update_data["customer_id"])

    for field, value in update_data.items():
        setattr(facility, field, value)

    facility.mark_updated()

    await db.facilities.update_one(
        {"_id": ObjectId(facility_id)},
        {"$set": facility.model_dump_mongo()}
    )

    return facility_to_response(facility)


@router.delete("/{facility_id}")
async def delete_facility(facility_id: str):
    """Delete a facility."""
    db = get_database()

    result = await db.facilities.delete_one({"_id": ObjectId(facility_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Facility not found")

    return {"success": True}
