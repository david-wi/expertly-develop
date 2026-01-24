from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import get_current_user
from ...schemas.client import ClientCreate, ClientUpdate, ClientResponse

router = APIRouter()


@router.get("", response_model=list[ClientResponse])
async def list_clients(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """List clients for the current salon."""
    clients = get_collection("clients")

    query = {
        "salon_id": current_user["salon_id"],
        "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
    }

    cursor = clients.find(query).sort("last_name", 1).skip(offset).limit(limit)
    client_list = await cursor.to_list(length=None)

    return [ClientResponse.from_mongo(c) for c in client_list]


@router.get("/search", response_model=list[ClientResponse])
async def search_clients(
    q: str = Query(min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Search clients by name, email, or phone."""
    clients = get_collection("clients")

    # Use text search if available, otherwise regex
    query = {
        "salon_id": current_user["salon_id"],
        "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
    }

    # Try text search first
    try:
        text_query = {**query, "$text": {"$search": q}}
        cursor = clients.find(text_query).limit(limit)
        client_list = await cursor.to_list(length=None)
    except Exception:
        # Fall back to regex search
        regex = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"first_name": regex},
            {"last_name": regex},
            {"email": regex},
            {"phone": regex},
        ]
        cursor = clients.find(query).limit(limit)
        client_list = await cursor.to_list(length=None)

    return [ClientResponse.from_mongo(c) for c in client_list]


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    request: ClientCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new client."""
    clients = get_collection("clients")

    # Check for duplicate email in same salon
    if request.email:
        existing = await clients.find_one({
            "salon_id": current_user["salon_id"],
            "email": request.email.lower(),
            "$or": [{"deleted_at": None}, {"deleted_at": {"$exists": False}}],
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Client with this email already exists",
            )

    now = datetime.now(timezone.utc)
    client_data = {
        "salon_id": current_user["salon_id"],
        "first_name": request.first_name,
        "last_name": request.last_name,
        "email": request.email.lower() if request.email else None,
        "phone": request.phone,
        "notes": request.notes,
        "preferences": request.preferences,
        "tags": request.tags,
        "stats": {
            "total_appointments": 0,
            "completed_appointments": 0,
            "cancelled_appointments": 0,
            "no_shows": 0,
            "total_spent": 0,
            "last_visit": None,
        },
        "stripe_customer_id": None,
        "created_at": now,
        "updated_at": now,
    }

    result = await clients.insert_one(client_data)
    client_data["_id"] = result.inserted_id

    return ClientResponse.from_mongo(client_data)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a client by ID."""
    clients = get_collection("clients")

    client = await clients.find_one({
        "_id": ObjectId(client_id),
        "salon_id": current_user["salon_id"],
    })

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    return ClientResponse.from_mongo(client)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    request: ClientUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a client."""
    clients = get_collection("clients")

    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    # Lowercase email
    if "email" in update_data and update_data["email"]:
        update_data["email"] = update_data["email"].lower()

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await clients.find_one_and_update(
        {"_id": ObjectId(client_id), "salon_id": current_user["salon_id"]},
        {"$set": update_data},
        return_document=True,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    return ClientResponse.from_mongo(result)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Soft delete a client."""
    clients = get_collection("clients")

    result = await clients.find_one_and_update(
        {"_id": ObjectId(client_id), "salon_id": current_user["salon_id"]},
        {
            "$set": {
                "deleted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.get("/{client_id}/appointments")
async def get_client_appointments(
    client_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get appointments for a client."""
    appointments = get_collection("appointments")

    cursor = appointments.find({
        "client_id": ObjectId(client_id),
        "salon_id": current_user["salon_id"],
    }).sort("start_time", -1).limit(limit)

    appointment_list = await cursor.to_list(length=None)

    return [
        {
            "id": str(a["_id"]),
            "start_time": a["start_time"].isoformat(),
            "end_time": a["end_time"].isoformat(),
            "status": a["status"],
            "service_id": str(a["service_id"]),
            "staff_id": str(a["staff_id"]),
        }
        for a in appointment_list
    ]
