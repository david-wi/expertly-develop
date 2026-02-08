"""Promotions API endpoints."""

from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_salon_user
from ...schemas.promotion import (
    PromotionCreate,
    PromotionUpdate,
    PromotionResponse,
    PromotionCheckResult,
)
from ...models.promotion import PromotionType, DiscountType

router = APIRouter()


@router.get("", response_model=list[PromotionResponse])
async def list_promotions(
    is_active: Optional[bool] = Query(None),
    promotion_type: Optional[PromotionType] = Query(None),
    current_user: dict = Depends(get_current_salon_user),
):
    """List all promotions for the salon."""
    promotions_collection = get_collection("promotions")

    query = {"salon_id": current_user["salon_id"]}

    if is_active is not None:
        query["is_active"] = is_active

    if promotion_type:
        query["promotion_type"] = promotion_type.value

    cursor = promotions_collection.find(query).sort("created_at", -1)
    promotions = await cursor.to_list(length=100)

    return [PromotionResponse.from_mongo(p) for p in promotions]


@router.post("", response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    request: PromotionCreate,
    current_user: dict = Depends(get_current_salon_user),
):
    """Create a new promotion."""
    promotions_collection = get_collection("promotions")

    # Check for duplicate code if provided
    if request.code:
        existing = await promotions_collection.find_one({
            "salon_id": current_user["salon_id"],
            "code": request.code.upper(),
            "is_active": True,
        })
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Promo code already exists"
            )

    now = datetime.now(timezone.utc)
    promotion_data = {
        "salon_id": current_user["salon_id"],
        "name": request.name,
        "description": request.description,
        "promotion_type": request.promotion_type.value,
        "discount_type": request.discount_type.value,
        "discount_value": request.discount_value,
        "free_service_id": request.free_service_id,
        "applicable_service_ids": [ObjectId(sid) for sid in request.applicable_service_ids],
        "applicable_staff_ids": [ObjectId(sid) for sid in request.applicable_staff_ids],
        "min_purchase_amount": request.min_purchase_amount,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "is_active": request.is_active,
        "max_uses": request.max_uses,
        "max_uses_per_client": request.max_uses_per_client,
        "current_uses": 0,
        "code": request.code.upper() if request.code else None,
        "requires_code": request.requires_code,
        "birthday_days_before": request.birthday_days_before,
        "birthday_days_after": request.birthday_days_after,
        "created_at": now,
        "updated_at": now,
    }

    result = await promotions_collection.insert_one(promotion_data)
    promotion_data["_id"] = result.inserted_id

    return PromotionResponse.from_mongo(promotion_data)


@router.get("/{promotion_id}", response_model=PromotionResponse)
async def get_promotion(
    promotion_id: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Get a specific promotion."""
    promotions_collection = get_collection("promotions")

    promotion = await promotions_collection.find_one({
        "_id": ObjectId(promotion_id),
        "salon_id": current_user["salon_id"],
    })

    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    return PromotionResponse.from_mongo(promotion)


@router.put("/{promotion_id}", response_model=PromotionResponse)
async def update_promotion(
    promotion_id: str,
    request: PromotionUpdate,
    current_user: dict = Depends(get_current_salon_user),
):
    """Update a promotion."""
    promotions_collection = get_collection("promotions")

    promotion = await promotions_collection.find_one({
        "_id": ObjectId(promotion_id),
        "salon_id": current_user["salon_id"],
    })

    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    update_data = {"updated_at": datetime.now(timezone.utc)}

    # Only update provided fields
    update_fields = request.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        if value is not None:
            if field == "code" and value:
                # Check for duplicate code
                existing = await promotions_collection.find_one({
                    "salon_id": current_user["salon_id"],
                    "code": value.upper(),
                    "is_active": True,
                    "_id": {"$ne": ObjectId(promotion_id)},
                })
                if existing:
                    raise HTTPException(
                        status_code=400,
                        detail="Promo code already exists"
                    )
                update_data["code"] = value.upper()
            else:
                update_data[field] = value

    result = await promotions_collection.find_one_and_update(
        {"_id": ObjectId(promotion_id)},
        {"$set": update_data},
        return_document=True,
    )

    return PromotionResponse.from_mongo(result)


@router.delete("/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promotion_id: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Delete a promotion (soft delete by deactivating)."""
    promotions_collection = get_collection("promotions")

    result = await promotions_collection.find_one_and_update(
        {
            "_id": ObjectId(promotion_id),
            "salon_id": current_user["salon_id"],
        },
        {
            "$set": {
                "is_active": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if not result:
        raise HTTPException(status_code=404, detail="Promotion not found")


@router.get("/check/{client_id}", response_model=list[PromotionCheckResult])
async def check_applicable_promotions(
    client_id: str,
    service_id: Optional[str] = Query(None),
    staff_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_salon_user),
):
    """Check which promotions apply to a client for a potential booking."""
    promotions_collection = get_collection("promotions")
    clients_collection = get_collection("clients")
    appointments_collection = get_collection("appointments")
    promotion_usage_collection = get_collection("promotion_usage")

    # Get client
    client = await clients_collection.find_one({
        "_id": ObjectId(client_id),
        "salon_id": current_user["salon_id"],
    })
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    now = datetime.now(timezone.utc)
    applicable = []

    # Get active promotions
    query = {
        "salon_id": current_user["salon_id"],
        "is_active": True,
        "$or": [
            {"start_date": None},
            {"start_date": {"$lte": now}},
        ],
    }

    cursor = promotions_collection.find(query)
    promotions = await cursor.to_list(length=100)

    for promo in promotions:
        # Check end date
        if promo.get("end_date") and promo["end_date"] < now:
            continue

        # Check max uses
        if promo.get("max_uses") and promo.get("current_uses", 0) >= promo["max_uses"]:
            continue

        # Check per-client usage
        client_usage_count = await promotion_usage_collection.count_documents({
            "promotion_id": promo["_id"],
            "client_id": ObjectId(client_id),
        })
        if client_usage_count >= promo.get("max_uses_per_client", 1):
            continue

        # Check service applicability
        if promo.get("applicable_service_ids") and service_id:
            if ObjectId(service_id) not in promo["applicable_service_ids"]:
                continue

        # Check staff applicability
        if promo.get("applicable_staff_ids") and staff_id:
            if ObjectId(staff_id) not in promo["applicable_staff_ids"]:
                continue

        promotion_type = PromotionType(promo["promotion_type"])
        reason = ""
        auto_apply = False

        # Type-specific checks
        if promotion_type == PromotionType.BIRTHDAY:
            # Check if client birthday is within range
            birthday = client.get("birthday")
            if not birthday:
                continue

            # Parse birthday and check if within range
            try:
                if isinstance(birthday, str):
                    birth_date = datetime.fromisoformat(birthday.replace("Z", "+00:00"))
                else:
                    birth_date = birthday

                # Check if birthday is within the window this year
                this_year_bday = birth_date.replace(year=now.year)
                if this_year_bday.tzinfo is None:
                    this_year_bday = this_year_bday.replace(tzinfo=timezone.utc)

                days_before = promo.get("birthday_days_before", 7)
                days_after = promo.get("birthday_days_after", 7)

                window_start = this_year_bday - timedelta(days=days_before)
                window_end = this_year_bday + timedelta(days=days_after)

                if not (window_start <= now <= window_end):
                    continue

                reason = "Birthday discount - Happy Birthday!"
                auto_apply = True
            except (ValueError, AttributeError):
                continue

        elif promotion_type == PromotionType.NEW_CLIENT:
            # Check if client has any previous appointments
            prev_count = await appointments_collection.count_documents({
                "client_id": ObjectId(client_id),
                "status": {"$in": ["completed", "checked_in", "in_progress"]},
            })
            if prev_count > 0:
                continue
            reason = "New client welcome discount"
            auto_apply = True

        elif promotion_type == PromotionType.REFERRAL:
            # Check if client was referred
            if not client.get("referral_source"):
                continue
            reason = "Referral reward"
            auto_apply = False  # Requires code typically

        elif promotion_type == PromotionType.LOYALTY:
            # Could check loyalty points here
            reason = "Loyalty reward"
            auto_apply = False

        elif promotion_type == PromotionType.SEASONAL:
            reason = promo.get("description") or "Seasonal promotion"
            auto_apply = not promo.get("requires_code", False)

        elif promotion_type == PromotionType.CUSTOM:
            reason = promo.get("description") or "Special offer"
            auto_apply = False

        # Build discount display string
        discount_type = DiscountType(promo["discount_type"])
        if discount_type == DiscountType.PERCENTAGE:
            discount_display = f"{promo['discount_value']}% off"
        elif discount_type == DiscountType.FIXED:
            discount_display = f"${promo['discount_value'] / 100:.2f} off"
        else:
            discount_display = "Free service"

        applicable.append(PromotionCheckResult(
            promotion_id=str(promo["_id"]),
            promotion_name=promo["name"],
            promotion_type=promotion_type,
            discount_type=discount_type,
            discount_value=promo["discount_value"],
            discount_display=discount_display,
            reason=reason,
            auto_apply=auto_apply,
        ))

    return applicable


@router.post("/validate-code")
async def validate_promo_code(
    code: str,
    client_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_salon_user),
):
    """Validate a promo code."""
    promotions_collection = get_collection("promotions")
    promotion_usage_collection = get_collection("promotion_usage")

    now = datetime.now(timezone.utc)

    promotion = await promotions_collection.find_one({
        "salon_id": current_user["salon_id"],
        "code": code.upper(),
        "is_active": True,
    })

    if not promotion:
        raise HTTPException(status_code=404, detail="Invalid promo code")

    # Check dates
    if promotion.get("start_date") and promotion["start_date"] > now:
        raise HTTPException(status_code=400, detail="Promo code not yet active")

    if promotion.get("end_date") and promotion["end_date"] < now:
        raise HTTPException(status_code=400, detail="Promo code has expired")

    # Check max uses
    if promotion.get("max_uses") and promotion.get("current_uses", 0) >= promotion["max_uses"]:
        raise HTTPException(status_code=400, detail="Promo code usage limit reached")

    # Check per-client usage if client provided
    if client_id:
        client_usage = await promotion_usage_collection.count_documents({
            "promotion_id": promotion["_id"],
            "client_id": ObjectId(client_id),
        })
        if client_usage >= promotion.get("max_uses_per_client", 1):
            raise HTTPException(
                status_code=400,
                detail="You have already used this promo code"
            )

    return PromotionResponse.from_mongo(promotion)
