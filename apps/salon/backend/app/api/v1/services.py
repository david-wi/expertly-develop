from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_salon_user, require_role
from ...schemas.service import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
)

router = APIRouter()


# Service Categories
@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_salon_user),
):
    """List all service categories."""
    categories = get_collection("service_categories")

    query = {"salon_id": current_user["salon_id"]}
    if not include_inactive:
        query["is_active"] = True

    cursor = categories.find(query).sort("sort_order", 1)
    category_list = await cursor.to_list(length=None)

    return [CategoryResponse.from_mongo(c) for c in category_list]


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    request: CategoryCreate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Create a new service category."""
    categories = get_collection("service_categories")

    now = datetime.now(timezone.utc)
    category_data = {
        "salon_id": current_user["salon_id"],
        **request.model_dump(),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    result = await categories.insert_one(category_data)
    category_data["_id"] = result.inserted_id

    return CategoryResponse.from_mongo(category_data)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    request: CategoryUpdate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Update a service category."""
    categories = get_collection("service_categories")

    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await categories.find_one_and_update(
        {"_id": ObjectId(category_id), "salon_id": current_user["salon_id"]},
        {"$set": update_data},
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )

    return CategoryResponse.from_mongo(result)


# Services
@router.get("", response_model=list[ServiceResponse])
async def list_services(
    category_id: str = Query(None),
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_salon_user),
):
    """List all services."""
    services = get_collection("services")

    query = {"salon_id": current_user["salon_id"]}
    if category_id:
        query["category_id"] = ObjectId(category_id)
    if not include_inactive:
        query["$or"] = [{"deleted_at": None}, {"deleted_at": {"$exists": False}}]
        query["is_active"] = True

    cursor = services.find(query).sort("sort_order", 1)
    service_list = await cursor.to_list(length=None)

    return [ServiceResponse.from_mongo(s) for s in service_list]


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    request: ServiceCreate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Create a new service."""
    services = get_collection("services")

    now = datetime.now(timezone.utc)
    service_data = {
        "salon_id": current_user["salon_id"],
        "category_id": ObjectId(request.category_id) if request.category_id else None,
        "name": request.name,
        "description": request.description,
        "duration_minutes": request.duration_minutes,
        "buffer_minutes": request.buffer_minutes,
        "price": request.price,
        "deposit_override": request.deposit_override,
        "color": request.color,
        "eligible_staff_ids": [ObjectId(sid) for sid in request.eligible_staff_ids],
        "sort_order": 0,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    result = await services.insert_one(service_data)
    service_data["_id"] = result.inserted_id

    return ServiceResponse.from_mongo(service_data)


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: str,
    current_user: dict = Depends(get_current_salon_user),
):
    """Get a service by ID."""
    services = get_collection("services")

    service = await services.find_one({
        "_id": ObjectId(service_id),
        "salon_id": current_user["salon_id"],
    })

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )

    return ServiceResponse.from_mongo(service)


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: str,
    request: ServiceUpdate,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Update a service."""
    services = get_collection("services")

    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    # Convert IDs to ObjectIds
    if "category_id" in update_data:
        update_data["category_id"] = ObjectId(update_data["category_id"])
    if "eligible_staff_ids" in update_data:
        update_data["eligible_staff_ids"] = [
            ObjectId(sid) for sid in update_data["eligible_staff_ids"]
        ]

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await services.find_one_and_update(
        {"_id": ObjectId(service_id), "salon_id": current_user["salon_id"]},
        {"$set": update_data},
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )

    return ServiceResponse.from_mongo(result)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: str,
    current_user: dict = Depends(require_role("owner", "admin")),
):
    """Soft delete a service."""
    services = get_collection("services")

    result = await services.find_one_and_update(
        {"_id": ObjectId(service_id), "salon_id": current_user["salon_id"]},
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
            detail="Service not found",
        )
