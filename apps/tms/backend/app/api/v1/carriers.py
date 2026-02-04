from typing import List, Optional
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.database import get_database
from app.models.carrier import Carrier, CarrierStatus, EquipmentType
from app.schemas.carrier import CarrierCreate, CarrierUpdate, CarrierResponse

router = APIRouter()


def carrier_to_response(carrier: Carrier) -> CarrierResponse:
    """Convert Carrier model to response schema."""
    return CarrierResponse(
        id=str(carrier.id),
        name=carrier.name,
        mc_number=carrier.mc_number,
        dot_number=carrier.dot_number,
        status=carrier.status,
        contacts=carrier.contacts,
        dispatch_email=carrier.dispatch_email,
        dispatch_phone=carrier.dispatch_phone,
        equipment_types=carrier.equipment_types,
        address_line1=carrier.address_line1,
        city=carrier.city,
        state=carrier.state,
        zip_code=carrier.zip_code,
        insurance_expiration=carrier.insurance_expiration,
        authority_active=carrier.authority_active,
        safety_rating=carrier.safety_rating,
        payment_terms=carrier.payment_terms,
        factoring_company=carrier.factoring_company,
        quickpay_available=carrier.quickpay_available,
        quickpay_discount_percent=carrier.quickpay_discount_percent,
        preferred_lanes=carrier.preferred_lanes,
        total_loads=carrier.total_loads,
        on_time_deliveries=carrier.on_time_deliveries,
        on_time_percentage=carrier.on_time_percentage,
        claims_count=carrier.claims_count,
        last_load_at=carrier.last_load_at,
        avg_rating=carrier.avg_rating,
        is_insurance_expiring=carrier.is_insurance_expiring,
        notes=carrier.notes,
        created_at=carrier.created_at,
        updated_at=carrier.updated_at,
    )


@router.get("", response_model=List[CarrierResponse])
async def list_carriers(
    status: Optional[CarrierStatus] = None,
    equipment_type: Optional[EquipmentType] = None,
    search: Optional[str] = None,
):
    """List all carriers with optional filters."""
    db = get_database()

    query = {}
    if status:
        query["status"] = status
    if equipment_type:
        query["equipment_types"] = equipment_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"mc_number": {"$regex": search, "$options": "i"}},
            {"dot_number": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.carriers.find(query).sort("name", 1)
    carriers = await cursor.to_list(1000)

    return [carrier_to_response(Carrier(**c)) for c in carriers]


@router.get("/{carrier_id}", response_model=CarrierResponse)
async def get_carrier(carrier_id: str):
    """Get a carrier by ID."""
    db = get_database()

    carrier = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier:
        raise HTTPException(status_code=404, detail="Carrier not found")

    return carrier_to_response(Carrier(**carrier))


@router.post("", response_model=CarrierResponse)
async def create_carrier(data: CarrierCreate):
    """Create a new carrier."""
    db = get_database()

    carrier = Carrier(**data.model_dump())
    await db.carriers.insert_one(carrier.model_dump_mongo())

    return carrier_to_response(carrier)


@router.patch("/{carrier_id}", response_model=CarrierResponse)
async def update_carrier(carrier_id: str, data: CarrierUpdate):
    """Update a carrier."""
    db = get_database()

    carrier_doc = await db.carriers.find_one({"_id": ObjectId(carrier_id)})
    if not carrier_doc:
        raise HTTPException(status_code=404, detail="Carrier not found")

    carrier = Carrier(**carrier_doc)

    # Apply updates
    update_data = data.model_dump(exclude_unset=True)

    # Handle status transitions
    if "status" in update_data:
        new_status = update_data.pop("status")
        if new_status and new_status != carrier.status:
            carrier.transition_to(new_status)

    for field, value in update_data.items():
        setattr(carrier, field, value)

    carrier.mark_updated()

    await db.carriers.update_one(
        {"_id": ObjectId(carrier_id)},
        {"$set": carrier.model_dump_mongo()}
    )

    return carrier_to_response(carrier)


@router.delete("/{carrier_id}")
async def delete_carrier(carrier_id: str):
    """Delete a carrier."""
    db = get_database()

    result = await db.carriers.delete_one({"_id": ObjectId(carrier_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Carrier not found")

    return {"success": True}
