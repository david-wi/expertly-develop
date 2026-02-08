"""Website API endpoints for public booking pages."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_salon_user
from ...models.website import WebsiteSettings, WebsiteTheme, SocialLinks, DEFAULT_SECTIONS

router = APIRouter()


# =====================
# Request/Response Models
# =====================

class WebsiteResponse(BaseModel):
    salon_id: str
    is_published: bool
    custom_domain: Optional[str]
    subdomain: Optional[str]
    settings: WebsiteSettings
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime]

    @classmethod
    def from_mongo(cls, doc: dict) -> "WebsiteResponse":
        return cls(
            salon_id=doc["salon_id"],
            is_published=doc.get("is_published", False),
            custom_domain=doc.get("custom_domain"),
            subdomain=doc.get("subdomain"),
            settings=WebsiteSettings(**doc.get("settings", {})),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            published_at=doc.get("published_at"),
        )


class WebsiteUpdateRequest(BaseModel):
    settings: Optional[WebsiteSettings] = None
    subdomain: Optional[str] = None
    is_published: Optional[bool] = None


class PublicWebsiteResponse(BaseModel):
    """Response for public website view."""
    salon_name: str
    salon_phone: Optional[str]
    salon_email: Optional[str]
    salon_address: Optional[str]
    salon_city: Optional[str]
    salon_state: Optional[str]
    timezone: str
    business_hours: dict
    settings: WebsiteSettings
    services: list[dict]
    staff: list[dict]
    promotions: list[dict]


# =====================
# Admin Endpoints (Authenticated)
# =====================

@router.get("", response_model=WebsiteResponse)
async def get_website(
    current_user: dict = Depends(get_current_salon_user),
):
    """Get the salon's website configuration."""
    websites_collection = get_collection("websites")

    website = await websites_collection.find_one({"salon_id": current_user["salon_id"]})

    if not website:
        # Create default website
        now = datetime.now(timezone.utc)
        website = {
            "salon_id": current_user["salon_id"],
            "is_published": False,
            "settings": WebsiteSettings(sections=DEFAULT_SECTIONS).model_dump(),
            "created_at": now,
            "updated_at": now,
        }
        await websites_collection.insert_one(website)

    return WebsiteResponse.from_mongo(website)


@router.put("", response_model=WebsiteResponse)
async def update_website(
    request: WebsiteUpdateRequest,
    current_user: dict = Depends(get_current_salon_user),
):
    """Update the salon's website configuration."""
    websites_collection = get_collection("websites")

    update_data = {"updated_at": datetime.now(timezone.utc)}

    if request.settings:
        update_data["settings"] = request.settings.model_dump()

    if request.subdomain is not None:
        # Check if subdomain is available
        if request.subdomain:
            existing = await websites_collection.find_one({
                "subdomain": request.subdomain,
                "salon_id": {"$ne": current_user["salon_id"]},
            })
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="This subdomain is already taken"
                )
        update_data["subdomain"] = request.subdomain

    if request.is_published is not None:
        update_data["is_published"] = request.is_published
        if request.is_published:
            update_data["published_at"] = datetime.now(timezone.utc)

    result = await websites_collection.find_one_and_update(
        {"salon_id": current_user["salon_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
    )

    return WebsiteResponse.from_mongo(result)


@router.post("/publish")
async def publish_website(
    current_user: dict = Depends(get_current_salon_user),
):
    """Publish the website."""
    websites_collection = get_collection("websites")

    website = await websites_collection.find_one({"salon_id": current_user["salon_id"]})
    if not website:
        raise HTTPException(status_code=404, detail="Website not found")

    if not website.get("subdomain"):
        raise HTTPException(
            status_code=400,
            detail="Please set a subdomain before publishing"
        )

    now = datetime.now(timezone.utc)
    await websites_collection.update_one(
        {"salon_id": current_user["salon_id"]},
        {
            "$set": {
                "is_published": True,
                "published_at": now,
                "updated_at": now,
            }
        },
    )

    return {"message": "Website published successfully"}


@router.post("/unpublish")
async def unpublish_website(
    current_user: dict = Depends(get_current_salon_user),
):
    """Unpublish the website."""
    websites_collection = get_collection("websites")

    await websites_collection.update_one(
        {"salon_id": current_user["salon_id"]},
        {
            "$set": {
                "is_published": False,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {"message": "Website unpublished"}


# =====================
# Public Endpoints (No Auth)
# =====================

@router.get("/public/{subdomain}", response_model=PublicWebsiteResponse)
async def get_public_website(subdomain: str):
    """Get public website data for rendering."""
    websites_collection = get_collection("websites")
    salons_collection = get_collection("salons")
    services_collection = get_collection("services")
    staff_collection = get_collection("staff")
    promotions_collection = get_collection("promotions")

    # Find website by subdomain
    website = await websites_collection.find_one({
        "subdomain": subdomain,
        "is_published": True,
    })

    if not website:
        raise HTTPException(status_code=404, detail="Website not found")

    # Get salon data
    salon = await salons_collection.find_one({"_id": ObjectId(website["salon_id"])})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    # Get services
    services_cursor = services_collection.find({
        "salon_id": website["salon_id"],
        "is_active": True,
    }).sort("sort_order", 1)
    services = await services_cursor.to_list(length=100)

    # Get staff
    staff_cursor = staff_collection.find({
        "salon_id": website["salon_id"],
        "is_active": True,
        "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
    }).sort("sort_order", 1)
    staff_list = await staff_cursor.to_list(length=50)

    # Get active promotions for public display
    now = datetime.now(timezone.utc)
    promotions_cursor = promotions_collection.find({
        "salon_id": website["salon_id"],
        "is_active": True,
        "requires_code": False,  # Only show auto-apply promotions
        "$or": [
            {"end_date": None},
            {"end_date": {"$gt": now}},
        ],
    })
    promotions = await promotions_cursor.to_list(length=10)

    settings = WebsiteSettings(**website.get("settings", {}))

    return PublicWebsiteResponse(
        salon_name=salon["name"],
        salon_phone=salon.get("phone"),
        salon_email=salon.get("email"),
        salon_address=salon.get("address"),
        salon_city=salon.get("city"),
        salon_state=salon.get("state"),
        timezone=salon.get("timezone", "America/New_York"),
        business_hours=salon.get("settings", {}).get("business_hours", {}),
        settings=settings,
        services=[
            {
                "id": str(s["_id"]),
                "name": s["name"],
                "description": s.get("description"),
                "duration_minutes": s["duration_minutes"],
                "price": s["price"] if settings.show_prices else None,
                "price_display": f"${s['price'] / 100:.0f}" if settings.show_prices else None,
            }
            for s in services
        ],
        staff=[
            {
                "id": str(s["_id"]),
                "first_name": s["first_name"],
                "last_name": s.get("last_name", ""),
                "display_name": s.get("display_name"),
                "avatar_url": s.get("avatar_url"),
                "bio": s.get("bio") if settings.show_staff_bios else None,
                "color": s.get("color"),
            }
            for s in staff_list
        ],
        promotions=[
            {
                "id": str(p["_id"]),
                "name": p["name"],
                "description": p.get("description"),
                "discount_type": p["discount_type"],
                "discount_value": p["discount_value"],
                "promotion_type": p["promotion_type"],
            }
            for p in promotions
        ],
    )


@router.get("/public/{subdomain}/availability")
async def get_public_availability(
    subdomain: str,
    date: str = Query(...),
    service_id: str = Query(...),
    staff_id: Optional[str] = Query(None),
):
    """Get available slots for public booking."""
    websites_collection = get_collection("websites")
    salons_collection = get_collection("salons")

    # Find website
    website = await websites_collection.find_one({
        "subdomain": subdomain,
        "is_published": True,
    })

    if not website:
        raise HTTPException(status_code=404, detail="Website not found")

    settings = WebsiteSettings(**website.get("settings", {}))
    if not settings.allow_public_booking:
        raise HTTPException(status_code=403, detail="Public booking is disabled")

    # Import calendar endpoint logic
    from .calendar import get_availability

    # Create a mock user context for the salon
    salon = await salons_collection.find_one({"_id": ObjectId(website["salon_id"])})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    mock_user = {"salon_id": website["salon_id"]}

    # Get availability using existing logic
    from ...core.database import get_collection
    from datetime import datetime

    services_collection = get_collection("services")
    staff_collection = get_collection("staff")
    appointments_collection = get_collection("appointments")

    # Verify service exists
    service = await services_collection.find_one({
        "_id": ObjectId(service_id),
        "salon_id": website["salon_id"],
        "is_active": True,
    })

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Get available slots (simplified version)
    check_date = datetime.strptime(date, "%Y-%m-%d").date()

    # Get eligible staff
    if staff_id:
        staff_query = {"_id": ObjectId(staff_id), "is_active": True}
    elif service.get("eligible_staff_ids"):
        staff_query = {"_id": {"$in": service["eligible_staff_ids"]}, "is_active": True}
    else:
        staff_query = {"salon_id": website["salon_id"], "is_active": True}

    staff_cursor = staff_collection.find(staff_query)
    staff_list = await staff_cursor.to_list(length=20)

    slots = []
    service_duration = service["duration_minutes"] + service.get("buffer_minutes", 0)

    for staff_member in staff_list:
        working_hours = staff_member.get("working_hours", {}).get("schedule", {})
        day_schedule = working_hours.get(str(check_date.weekday()), {})

        if not day_schedule.get("is_working", False):
            continue

        for time_slot in day_schedule.get("slots", []):
            slot_start_str = time_slot.get("start", "09:00")
            slot_end_str = time_slot.get("end", "17:00")

            # Generate available times within this slot
            from datetime import timedelta

            slot_start = datetime.combine(
                check_date,
                datetime.strptime(slot_start_str, "%H:%M").time()
            )
            slot_end = datetime.combine(
                check_date,
                datetime.strptime(slot_end_str, "%H:%M").time()
            )

            current = slot_start
            while current + timedelta(minutes=service_duration) <= slot_end:
                # Check for existing appointments
                check_end = current + timedelta(minutes=service_duration)

                existing = await appointments_collection.find_one({
                    "staff_id": staff_member["_id"],
                    "status": {"$nin": ["cancelled", "no_show"]},
                    "start_time": {"$lt": check_end},
                    "end_time": {"$gt": current},
                })

                if not existing:
                    slots.append({
                        "start_time": current.isoformat(),
                        "end_time": check_end.isoformat(),
                        "staff_id": str(staff_member["_id"]),
                        "staff_name": f"{staff_member['first_name']} {staff_member.get('last_name', '')}".strip(),
                    })

                current += timedelta(minutes=15)  # 15-minute intervals

    return {
        "date": date,
        "service_id": service_id,
        "service_name": service["name"],
        "duration_minutes": service_duration,
        "slots": slots,
    }
