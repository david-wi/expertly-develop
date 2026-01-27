"""
Authentication endpoints using Identity service.

Most authentication operations (login, logout, password reset) are handled by the
Identity service at https://identity.ai.devintensive.com. This module provides:
- Session validation endpoint (/auth/me)
- User management endpoints for staff (list, create, update, delete)
- Identity redirect URLs

Note: Login/logout are now handled by the Identity frontend.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import (
    get_password_hash,
    get_current_user,
    require_role,
)
from ...schemas.auth import (
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
)
from ...config import settings

router = APIRouter()


# Identity service URLs for frontend to redirect to
IDENTITY_LOGIN_URL = f"{settings.identity_api_url}/login"
IDENTITY_LOGOUT_URL = f"{settings.identity_api_url}/logout"
IDENTITY_USERS_URL = f"{settings.identity_api_url}/users"


@router.get("/identity-urls")
async def get_identity_urls():
    """Get Identity service URLs for frontend redirects."""
    return {
        "login_url": IDENTITY_LOGIN_URL,
        "logout_url": IDENTITY_LOGOUT_URL,
        "users_management_url": IDENTITY_USERS_URL,
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(request: Request):
    """Get current user's profile from Identity session."""
    current_user = await get_current_user(request)
    return UserResponse.from_mongo(current_user)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    include_inactive: bool = False,
    request: Request = None,
):
    """
    List all users in the salon (admin/manager only).

    These are salon-specific user records that link Identity users to salon roles.
    """
    current_user = await require_role("owner", "admin", "manager")(request)
    users = get_collection("users")

    query = {"salon_id": current_user["salon_id"]}
    if not include_inactive:
        query["is_active"] = True

    cursor = users.find(query)
    results = []
    async for user in cursor:
        results.append(UserResponse.from_mongo(user))

    return results


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: CreateUserRequest,
    request: Request = None,
):
    """
    Create a new user account for a staff member (admin only).

    This creates a salon-specific user record that can be linked to an Identity user.
    The user should log in via Identity service.
    """
    current_user = await require_role("owner", "admin")(request)
    users = get_collection("users")
    staff = get_collection("staff")

    # Check if email already exists
    existing = await users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # If staff_id provided, verify it exists and belongs to this salon
    if data.staff_id:
        staff_member = await staff.find_one({
            "_id": ObjectId(data.staff_id),
            "salon_id": current_user["salon_id"],
        })
        if not staff_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found",
            )

        # Check if staff already has a user account
        existing_user = await users.find_one({"staff_id": ObjectId(data.staff_id)})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Staff member already has a user account",
            )

    # Validate role
    valid_roles = ["staff", "manager", "admin"]
    if current_user.get("role") != "owner":
        valid_roles = ["staff", "manager"]  # Non-owners can't create admins

    if data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    # Create user (password is stored but not used for auth - Identity handles that)
    user_data = {
        "email": data.email.lower(),
        "password_hash": get_password_hash(data.password),  # Kept for legacy support
        "first_name": data.first_name,
        "last_name": data.last_name,
        "salon_id": current_user["salon_id"],
        "role": data.role,
        "staff_id": ObjectId(data.staff_id) if data.staff_id else None,
        "is_active": True,
    }

    result = await users.insert_one(user_data)
    user_data["_id"] = result.inserted_id

    # Update staff record with user_id if linked
    if data.staff_id:
        await staff.update_one(
            {"_id": ObjectId(data.staff_id)},
            {"$set": {"user_id": result.inserted_id}},
        )

    return UserResponse.from_mongo(user_data)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    request: Request = None,
):
    """Get a specific user by ID."""
    current_user = await require_role("owner", "admin", "manager")(request)
    users = get_collection("users")

    user = await users.find_one({
        "_id": ObjectId(user_id),
        "salon_id": current_user["salon_id"],
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.from_mongo(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UpdateUserRequest,
    request: Request = None,
):
    """Update a user account (admin only)."""
    current_user = await require_role("owner", "admin")(request)
    users = get_collection("users")

    user = await users.find_one({
        "_id": ObjectId(user_id),
        "salon_id": current_user["salon_id"],
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Build update data
    update_data = {}

    if data.email is not None:
        # Check if email is already taken
        existing = await users.find_one({
            "email": data.email.lower(),
            "_id": {"$ne": ObjectId(user_id)},
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        update_data["email"] = data.email.lower()

    if data.first_name is not None:
        update_data["first_name"] = data.first_name

    if data.last_name is not None:
        update_data["last_name"] = data.last_name

    if data.role is not None:
        # Validate role change permissions
        if data.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role to owner",
            )
        if data.role == "admin" and current_user.get("role") != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can create admins",
            )
        update_data["role"] = data.role

    if data.is_active is not None:
        # Can't deactivate yourself
        if str(current_user["_id"]) == user_id and not data.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account",
            )
        update_data["is_active"] = data.is_active

    if update_data:
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
        )

    updated_user = await users.find_one({"_id": ObjectId(user_id)})
    return UserResponse.from_mongo(updated_user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    request: Request = None,
):
    """Delete a user account (admin only)."""
    current_user = await require_role("owner", "admin")(request)
    users = get_collection("users")
    staff = get_collection("staff")

    user = await users.find_one({
        "_id": ObjectId(user_id),
        "salon_id": current_user["salon_id"],
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Can't delete yourself
    if str(current_user["_id"]) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    # Can't delete the owner
    if user.get("role") == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the owner account",
        )

    # Remove user_id from linked staff record
    if user.get("staff_id"):
        await staff.update_one(
            {"_id": user["staff_id"]},
            {"$unset": {"user_id": ""}},
        )

    await users.delete_one({"_id": ObjectId(user_id)})
