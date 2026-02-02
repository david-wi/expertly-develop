"""
Authentication endpoints using Identity service.

Authentication is handled by Identity service. This module provides:
- Session validation endpoint (/auth/me)
- Salon membership management endpoints
- Identity redirect URLs

Note: Login/logout are handled by the Identity frontend.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Request
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import (
    get_current_user,
    get_salon_membership,
    require_role,
    require_salon_role,
)
from ...schemas.auth import (
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
)
from ...config import settings
from identity_client.models import User as IdentityUser

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


@router.get("/me")
async def get_current_user_profile(request: Request):
    """Get current user's profile from Identity session with salon membership."""
    current_user: IdentityUser = await get_current_user(request)
    membership = await get_salon_membership(current_user)

    response = {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.name.split()[0] if current_user.name else "",
        "last_name": " ".join(current_user.name.split()[1:]) if current_user.name and len(current_user.name.split()) > 1 else "",
        "is_active": current_user.is_active,
        "organization_id": current_user.organization_id,
    }

    if membership:
        response.update({
            "membership_id": str(membership["_id"]),
            "salon_id": str(membership["salon_id"]),
            "role": membership.get("role", "staff"),
            "staff_id": str(membership["staff_id"]) if membership.get("staff_id") else None,
        })
    else:
        response.update({
            "membership_id": None,
            "salon_id": None,
            "role": None,
            "staff_id": None,
        })

    return response


@router.get("/memberships", response_model=list[UserResponse])
async def list_salon_memberships(
    include_inactive: bool = False,
    request: Request = None,
):
    """
    List all salon memberships (admin/manager only).

    These are salon membership records that link Identity users to salon roles.
    """
    current_user: IdentityUser = await require_role("owner", "admin", "manager")(request)
    membership = await get_salon_membership(current_user)

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No salon membership found",
        )

    memberships = get_collection("salon_memberships")
    query = {"salon_id": membership["salon_id"]}
    if not include_inactive:
        query["is_active"] = True

    cursor = memberships.find(query)
    results = []
    async for m in cursor:
        results.append(UserResponse.from_mongo(m))

    return results


# Legacy alias for backward compatibility
@router.get("/users", response_model=list[UserResponse])
async def list_users(
    include_inactive: bool = False,
    request: Request = None,
):
    """List all users in the salon (admin/manager only). Alias for /memberships."""
    return await list_salon_memberships(include_inactive, request)


@router.post("/memberships", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_salon_membership(
    data: CreateUserRequest,
    request: Request = None,
):
    """
    Create a new salon membership for a staff member (admin only).

    This creates a salon membership record that links an Identity user to a salon.
    The user should log in via Identity service.
    """
    current_user: IdentityUser = await require_role("owner", "admin")(request)
    current_membership = await get_salon_membership(current_user)

    if not current_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No salon membership found",
        )

    memberships = get_collection("salon_memberships")
    staff = get_collection("staff")

    # Check if email already has a membership in this salon
    existing = await memberships.find_one({
        "email": data.email.lower(),
        "salon_id": current_membership["salon_id"],
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already has a membership in this salon",
        )

    # If staff_id provided, verify it exists and belongs to this salon
    if data.staff_id:
        staff_member = await staff.find_one({
            "_id": ObjectId(data.staff_id),
            "salon_id": current_membership["salon_id"],
        })
        if not staff_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found",
            )

        # Check if staff already has a membership
        existing_membership = await memberships.find_one({"staff_id": ObjectId(data.staff_id)})
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Staff member already has a membership",
            )

    # Validate role
    valid_roles = ["staff", "manager", "admin"]
    if current_membership.get("role") != "owner":
        valid_roles = ["staff", "manager"]  # Non-owners can't create admins

    if data.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    # Create salon membership record
    membership_data = {
        "email": data.email.lower(),
        "first_name": data.first_name,
        "last_name": data.last_name,
        "salon_id": current_membership["salon_id"],
        "role": data.role,
        "staff_id": ObjectId(data.staff_id) if data.staff_id else None,
        "is_active": True,
        # Identity fields will be set when user logs in via Identity
        "identity_user_id": None,
        "organization_id": current_user.organization_id,
    }

    result = await memberships.insert_one(membership_data)
    membership_data["_id"] = result.inserted_id

    # Update staff record with membership_id if linked
    if data.staff_id:
        await staff.update_one(
            {"_id": ObjectId(data.staff_id)},
            {"$set": {"user_id": result.inserted_id}},
        )

    return UserResponse.from_mongo(membership_data)


# Legacy alias
@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(data: CreateUserRequest, request: Request = None):
    """Create a new user account. Alias for /memberships."""
    return await create_salon_membership(data, request)


@router.get("/memberships/{membership_id}", response_model=UserResponse)
async def get_salon_membership_by_id(
    membership_id: str,
    request: Request = None,
):
    """Get a specific salon membership by ID."""
    current_user: IdentityUser = await require_role("owner", "admin", "manager")(request)
    current_membership = await get_salon_membership(current_user)

    if not current_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No salon membership found",
        )

    memberships = get_collection("salon_memberships")
    membership = await memberships.find_one({
        "_id": ObjectId(membership_id),
        "salon_id": current_membership["salon_id"],
    })

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    return UserResponse.from_mongo(membership)


# Legacy alias
@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, request: Request = None):
    """Get a specific user. Alias for /memberships/{id}."""
    return await get_salon_membership_by_id(user_id, request)


@router.put("/memberships/{membership_id}", response_model=UserResponse)
async def update_salon_membership(
    membership_id: str,
    data: UpdateUserRequest,
    request: Request = None,
):
    """Update a salon membership (admin only)."""
    current_user: IdentityUser = await require_role("owner", "admin")(request)
    current_membership = await get_salon_membership(current_user)

    if not current_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No salon membership found",
        )

    memberships = get_collection("salon_memberships")
    membership = await memberships.find_one({
        "_id": ObjectId(membership_id),
        "salon_id": current_membership["salon_id"],
    })

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    # Build update data
    update_data = {}

    if data.email is not None:
        # Check if email is already taken in this salon
        existing = await memberships.find_one({
            "email": data.email.lower(),
            "salon_id": current_membership["salon_id"],
            "_id": {"$ne": ObjectId(membership_id)},
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered in this salon",
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
        if data.role == "admin" and current_membership.get("role") != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can create admins",
            )
        update_data["role"] = data.role

    if data.is_active is not None:
        # Can't deactivate yourself
        if str(current_membership["_id"]) == membership_id and not data.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own membership",
            )
        update_data["is_active"] = data.is_active

    if update_data:
        await memberships.update_one(
            {"_id": ObjectId(membership_id)},
            {"$set": update_data},
        )

    updated_membership = await memberships.find_one({"_id": ObjectId(membership_id)})
    return UserResponse.from_mongo(updated_membership)


# Legacy alias
@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, data: UpdateUserRequest, request: Request = None):
    """Update a user. Alias for /memberships/{id}."""
    return await update_salon_membership(user_id, data, request)


@router.delete("/memberships/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_salon_membership(
    membership_id: str,
    request: Request = None,
):
    """Delete a salon membership (admin only)."""
    current_user: IdentityUser = await require_role("owner", "admin")(request)
    current_membership = await get_salon_membership(current_user)

    if not current_membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No salon membership found",
        )

    memberships = get_collection("salon_memberships")
    staff = get_collection("staff")

    membership = await memberships.find_one({
        "_id": ObjectId(membership_id),
        "salon_id": current_membership["salon_id"],
    })

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found",
        )

    # Can't delete yourself
    if str(current_membership["_id"]) == membership_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own membership",
        )

    # Can't delete the owner
    if membership.get("role") == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the owner membership",
        )

    # Remove user_id from linked staff record
    if membership.get("staff_id"):
        await staff.update_one(
            {"_id": membership["staff_id"]},
            {"$unset": {"user_id": ""}},
        )

    await memberships.delete_one({"_id": ObjectId(membership_id)})


# Legacy alias
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, request: Request = None):
    """Delete a user. Alias for /memberships/{id}."""
    return await delete_salon_membership(user_id, request)
