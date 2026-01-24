from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_user, require_role
from ...schemas.salon import SalonCreate, SalonUpdate, SalonResponse

router = APIRouter()


@router.get("/current", response_model=SalonResponse)
async def get_current_salon(current_user: dict = Depends(get_current_user)):
    """Get the current user's salon."""
    salons = get_collection("salons")
    salon = await salons.find_one({"_id": current_user["salon_id"]})

    if not salon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Salon not found",
        )

    return SalonResponse.from_mongo(salon)


@router.put("/current", response_model=SalonResponse)
async def update_current_salon(
    request: SalonUpdate,
    current_user: dict = Depends(require_role("owner", "admin")),
):
    """Update the current user's salon."""
    salons = get_collection("salons")

    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await salons.find_one_and_update(
        {"_id": current_user["salon_id"]},
        {"$set": update_data},
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Salon not found",
        )

    return SalonResponse.from_mongo(result)


@router.post("", response_model=SalonResponse, status_code=status.HTTP_201_CREATED)
async def create_salon(request: SalonCreate):
    """Create a new salon (admin endpoint for onboarding)."""
    salons = get_collection("salons")

    # Check if slug exists
    existing = await salons.find_one({"slug": request.slug})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Salon slug already exists",
        )

    now = datetime.now(timezone.utc)
    salon_data = {
        **request.model_dump(),
        "stripe_account_id": None,
        "stripe_onboarding_complete": False,
        "settings": {},
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    result = await salons.insert_one(salon_data)
    salon_data["_id"] = result.inserted_id

    return SalonResponse.from_mongo(salon_data)
