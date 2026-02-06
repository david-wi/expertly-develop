from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from app.database import get_database
from app.models.facility import Facility, FacilityHours

router = APIRouter()


class CustomerFacilityCreate(BaseModel):
    name: str
    facility_type: str = "warehouse"
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
    dock_hours: Optional[str] = None
    special_instructions: Optional[str] = None
    appointment_required: bool = False
    has_dock: bool = True
    has_forklift: bool = True


class CustomerFacilityUpdate(BaseModel):
    name: Optional[str] = None
    facility_type: Optional[str] = None
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
    dock_hours: Optional[str] = None
    special_instructions: Optional[str] = None
    appointment_required: Optional[bool] = None
    has_dock: Optional[bool] = None
    has_forklift: Optional[bool] = None


class CustomerFacilityResponse(BaseModel):
    id: str
    customer_id: Optional[str] = None
    name: str
    facility_type: str
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
    dock_hours: Optional[str] = None
    special_instructions: Optional[str] = None
    appointment_required: bool
    has_dock: bool
    has_forklift: bool
    created_at: str
    updated_at: str


def facility_to_response(facility: Facility) -> CustomerFacilityResponse:
    return CustomerFacilityResponse(
        id=str(facility.id),
        customer_id=str(facility.customer_id) if facility.customer_id else None,
        name=facility.name,
        facility_type=facility.facility_type,
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
        dock_hours=facility.dock_hours,
        special_instructions=facility.special_instructions,
        appointment_required=facility.appointment_required,
        has_dock=facility.has_dock,
        has_forklift=facility.has_forklift,
        created_at=facility.created_at.isoformat(),
        updated_at=facility.updated_at.isoformat(),
    )


@router.get("/{customer_id}/facilities", response_model=List[CustomerFacilityResponse])
async def list_customer_facilities(customer_id: str):
    """List all facilities for a customer."""
    db = get_database()

    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    cursor = db.facilities.find({"customer_id": ObjectId(customer_id)}).sort("name", 1)
    facilities = await cursor.to_list(1000)

    return [facility_to_response(Facility(**f)) for f in facilities]


@router.post("/{customer_id}/facilities", response_model=CustomerFacilityResponse)
async def create_customer_facility(customer_id: str, data: CustomerFacilityCreate):
    """Create a facility for a customer."""
    db = get_database()

    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    facility_data = data.model_dump()
    facility_data["customer_id"] = ObjectId(customer_id)
    facility = Facility(**facility_data)
    await db.facilities.insert_one(facility.model_dump_mongo())

    return facility_to_response(facility)


@router.patch("/{customer_id}/facilities/{facility_id}", response_model=CustomerFacilityResponse)
async def update_customer_facility(customer_id: str, facility_id: str, data: CustomerFacilityUpdate):
    """Update a customer facility."""
    db = get_database()

    facility_doc = await db.facilities.find_one({
        "_id": ObjectId(facility_id),
        "customer_id": ObjectId(customer_id),
    })
    if not facility_doc:
        raise HTTPException(status_code=404, detail="Facility not found")

    facility = Facility(**facility_doc)
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(facility, field, value)

    facility.mark_updated()

    await db.facilities.update_one(
        {"_id": ObjectId(facility_id)},
        {"$set": facility.model_dump_mongo()},
    )

    return facility_to_response(facility)


@router.delete("/{customer_id}/facilities/{facility_id}")
async def delete_customer_facility(customer_id: str, facility_id: str):
    """Delete a customer facility."""
    db = get_database()

    result = await db.facilities.delete_one({
        "_id": ObjectId(facility_id),
        "customer_id": ObjectId(customer_id),
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Facility not found")

    return {"success": True}
