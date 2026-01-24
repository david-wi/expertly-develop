from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId

from ...core.database import get_collection
from ...core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from ...schemas.auth import (
    LoginRequest,
    LoginResponse,
    TokenRefreshRequest,
    RegisterRequest,
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
)
from ...core.security import require_role

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate user and return tokens."""
    users = get_collection("users")
    user = await users.find_one({"email": request.email.lower()})

    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
        )

    token_data = {"sub": str(user["_id"]), "salon_id": str(user["salon_id"])}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.from_mongo(user),
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(request: TokenRefreshRequest):
    """Refresh access token using refresh token."""
    payload = decode_token(request.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    users = get_collection("users")
    user = await users.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    token_data = {"sub": str(user["_id"]), "salon_id": str(user["salon_id"])}
    access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return LoginResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.from_mongo(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile."""
    return UserResponse.from_mongo(current_user)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """Register a new user (must be invited to a salon)."""
    users = get_collection("users")
    salons = get_collection("salons")

    # Check if salon exists
    salon = await salons.find_one({"_id": ObjectId(request.salon_id)})
    if not salon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Salon not found",
        )

    # Check if email already exists
    existing = await users.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user_data = {
        "email": request.email.lower(),
        "password_hash": get_password_hash(request.password),
        "first_name": request.first_name,
        "last_name": request.last_name,
        "salon_id": ObjectId(request.salon_id),
        "role": "staff",  # Default role
        "is_active": True,
    }

    result = await users.insert_one(user_data)
    user_data["_id"] = result.inserted_id

    return UserResponse.from_mongo(user_data)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    include_inactive: bool = False,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """List all users in the salon (admin/manager only)."""
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
    request: CreateUserRequest,
    current_user: dict = Depends(require_role("owner", "admin")),
):
    """Create a new user account for a staff member (admin only)."""
    users = get_collection("users")
    staff = get_collection("staff")

    # Check if email already exists
    existing = await users.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # If staff_id provided, verify it exists and belongs to this salon
    if request.staff_id:
        staff_member = await staff.find_one({
            "_id": ObjectId(request.staff_id),
            "salon_id": current_user["salon_id"],
        })
        if not staff_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found",
            )

        # Check if staff already has a user account
        existing_user = await users.find_one({"staff_id": ObjectId(request.staff_id)})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Staff member already has a user account",
            )

    # Validate role
    valid_roles = ["staff", "manager", "admin"]
    if current_user.get("role") != "owner":
        valid_roles = ["staff", "manager"]  # Non-owners can't create admins

    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}",
        )

    # Create user
    user_data = {
        "email": request.email.lower(),
        "password_hash": get_password_hash(request.password),
        "first_name": request.first_name,
        "last_name": request.last_name,
        "salon_id": current_user["salon_id"],
        "role": request.role,
        "staff_id": ObjectId(request.staff_id) if request.staff_id else None,
        "is_active": True,
    }

    result = await users.insert_one(user_data)
    user_data["_id"] = result.inserted_id

    # Update staff record with user_id if linked
    if request.staff_id:
        await staff.update_one(
            {"_id": ObjectId(request.staff_id)},
            {"$set": {"user_id": result.inserted_id}},
        )

    return UserResponse.from_mongo(user_data)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: dict = Depends(require_role("owner", "admin", "manager")),
):
    """Get a specific user by ID."""
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
    request: UpdateUserRequest,
    current_user: dict = Depends(require_role("owner", "admin")),
):
    """Update a user account (admin only)."""
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

    if request.email is not None:
        # Check if email is already taken
        existing = await users.find_one({
            "email": request.email.lower(),
            "_id": {"$ne": ObjectId(user_id)},
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        update_data["email"] = request.email.lower()

    if request.first_name is not None:
        update_data["first_name"] = request.first_name

    if request.last_name is not None:
        update_data["last_name"] = request.last_name

    if request.role is not None:
        # Validate role change permissions
        if request.role == "owner":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role to owner",
            )
        if request.role == "admin" and current_user.get("role") != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owners can create admins",
            )
        update_data["role"] = request.role

    if request.is_active is not None:
        # Can't deactivate yourself
        if str(current_user["_id"]) == user_id and not request.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate your own account",
            )
        update_data["is_active"] = request.is_active

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
    current_user: dict = Depends(require_role("owner", "admin")),
):
    """Delete a user account (admin only)."""
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
