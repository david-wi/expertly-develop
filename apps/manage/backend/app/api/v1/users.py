from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import User, UserCreate, UserUpdate, UserType
from app.models.queue import Queue, ScopeType
from app.api.deps import get_current_user
from app.utils.auth import generate_api_key, hash_api_key

router = APIRouter()


# Personal queues created for each new user
PERSONAL_QUEUES = [
    ("My Todos", "inbox", "Default queue for incoming tasks"),
    ("My Urgent Todos", "urgent", "High-priority tasks requiring immediate attention"),
    ("My Followups", "followup", "Tasks that need follow-up or are waiting on something"),
]


async def create_personal_queues(db, organization_id, user_id):
    """Create personal queues for a new user."""
    for purpose, system_type, description in PERSONAL_QUEUES:
        queue = Queue(
            organization_id=organization_id,
            purpose=purpose,
            description=description,
            scope_type=ScopeType.USER,
            scope_id=user_id,
            is_system=False,
            system_type=system_type
        )
        await db.queues.insert_one(queue.model_dump_mongo())


@router.get("")
async def list_users(
    user_type: str | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List users in the current organization."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}
    if user_type:
        query["user_type"] = user_type

    cursor = db.users.find(query)
    users = await cursor.to_list(1000)

    # Remove sensitive fields
    return [
        {
            **{k: v for k, v in user.items() if k not in ["api_key_hash", "password_hash"]},
            "_id": str(user["_id"]),
            "organization_id": str(user["organization_id"])
        }
        for user in users
    ]


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get current user information."""
    user_dict = current_user.model_dump(exclude={"api_key_hash", "password_hash"})
    user_dict["id"] = str(current_user.id)
    user_dict["organization_id"] = str(current_user.organization_id)
    return user_dict


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific user."""
    db = get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = await db.users.find_one({
        "_id": ObjectId(user_id),
        "organization_id": current_user.organization_id
    })

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        **{k: v for k, v in user.items() if k not in ["api_key_hash", "password_hash"]},
        "_id": str(user["_id"]),
        "organization_id": str(user["organization_id"])
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new user."""
    db = get_database()

    # Verify permission (admin or owner)
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can create users")

    # Check for duplicate email
    existing = await db.users.find_one({
        "organization_id": current_user.organization_id,
        "email": data.email
    })
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Generate API key
    api_key = generate_api_key()

    user = User(
        organization_id=current_user.organization_id,
        email=data.email,
        name=data.name,
        user_type=data.user_type,
        role=data.role,
        avatar_url=data.avatar_url,
        bot_config=data.bot_config if data.user_type == UserType.VIRTUAL else None,
        api_key_hash=hash_api_key(api_key)
    )

    await db.users.insert_one(user.model_dump_mongo())

    # Create personal queues for the new user
    await create_personal_queues(db, current_user.organization_id, user.id)

    result = {
        **{k: v for k, v in user.model_dump_mongo().items() if k not in ["api_key_hash", "password_hash"]},
        "_id": str(user.id),
        "organization_id": str(user.organization_id),
        "api_key": api_key  # Only returned on creation
    }

    return result


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a user."""
    db = get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # Can update self or must be admin
    is_self = str(current_user.id) == user_id
    is_admin = current_user.role in ["admin", "owner"]

    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Non-admins can't change role
    if "role" in update_data and not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can change roles")

    result = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        **{k: v for k, v in result.items() if k not in ["api_key_hash", "password_hash"]},
        "_id": str(result["_id"]),
        "organization_id": str(result["organization_id"])
    }


@router.post("/{user_id}/regenerate-api-key")
async def regenerate_api_key(
    user_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Regenerate API key for a user."""
    db = get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # Can regenerate own key or must be admin
    is_self = str(current_user.id) == user_id
    is_admin = current_user.role in ["admin", "owner"]

    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Access denied")

    api_key = generate_api_key()

    result = await db.users.find_one_and_update(
        {"_id": ObjectId(user_id), "organization_id": current_user.organization_id},
        {"$set": {"api_key_hash": hash_api_key(api_key)}},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return {"api_key": api_key}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a user (hard delete - also removes their personal queues)."""
    db = get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    # Verify permission
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    # Cannot delete yourself
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Check user exists
    user = await db.users.find_one({
        "_id": ObjectId(user_id),
        "organization_id": current_user.organization_id
    })
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Cannot delete the default user
    if user.get("is_default"):
        raise HTTPException(status_code=400, detail="Cannot delete the default user")

    # Delete user's personal queues
    await db.queues.delete_many({
        "scope_type": "user",
        "scope_id": ObjectId(user_id),
        "organization_id": current_user.organization_id
    })

    # Delete the user
    await db.users.delete_one({"_id": ObjectId(user_id)})
