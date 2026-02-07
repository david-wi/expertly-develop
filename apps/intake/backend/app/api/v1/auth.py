"""Authentication and user management routes."""

import secrets
import string
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.core.database import get_collection
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from app.schemas.auth import (
    AccountResponse,
    CreateUserRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEMP_PW_ALPHABET = string.ascii_letters + string.digits + "!@#$%"
_TEMP_PW_LENGTH = 12


def _generate_temp_password() -> str:
    """Generate a random temporary password."""
    return "".join(secrets.choice(_TEMP_PW_ALPHABET) for _ in range(_TEMP_PW_LENGTH))


def _serialize_user(doc: dict) -> dict:
    """Convert a MongoDB user document to a serializable dict."""
    return {
        "userId": str(doc["_id"]),
        "accountId": str(doc["accountId"]),
        "email": doc["email"],
        "name": doc["name"],
        "phone": doc.get("phone"),
        "role": doc["role"],
        "createdAt": doc["createdAt"],
        "lastLoginAt": doc.get("lastLoginAt"),
    }


def _serialize_account(doc: dict) -> dict:
    """Convert a MongoDB account document to a serializable dict."""
    return {
        "accountId": str(doc["_id"]),
        "accountName": doc["accountName"],
        "isActive": doc.get("isActive", True),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/auth/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Validate email/password and return a JWT token with user info."""
    users = get_collection("users")
    user_doc = await users.find_one({"email": body.email.lower()})

    if not user_doc or not verify_password(body.password, user_doc["passwordHash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login timestamp
    now = datetime.now(timezone.utc)
    await users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"lastLoginAt": now, "updatedAt": now}},
    )
    user_doc["lastLoginAt"] = now

    # Build JWT claims
    from app.config import settings

    token_data = {
        "sub": str(user_doc["_id"]),
        "accountId": str(user_doc["accountId"]),
        "email": user_doc["email"],
        "role": user_doc["role"],
        "name": user_doc["name"],
    }
    token = create_access_token(token_data)

    from datetime import timedelta

    expires_at = now + timedelta(minutes=settings.access_token_expire_minutes)

    return LoginResponse(
        token=token,
        tokenType="bearer",
        expiresAt=expires_at,
        user=UserResponse(**_serialize_user(user_doc)),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    users = get_collection("users")

    try:
        oid = ObjectId(current_user["userId"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID",
        )

    user_doc = await users.find_one({"_id": oid})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(**_serialize_user(user_doc))


@router.get("/accounts/current", response_model=AccountResponse)
async def get_current_account(current_user: dict = Depends(get_current_user)):
    """Return the current user's account information."""
    accounts = get_collection("accounts")

    try:
        oid = ObjectId(current_user["accountId"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid account ID",
        )

    account_doc = await accounts.find_one({"_id": oid})
    if not account_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    return AccountResponse(**_serialize_account(account_doc))


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Create a new user in the current account (admin only).

    A random temporary password is generated and hashed. The caller should
    arrange for the new user to set their own password via a reset flow.
    """
    users = get_collection("users")

    # Check for duplicate email
    existing = await users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    temp_password = _generate_temp_password()
    now = datetime.now(timezone.utc)

    doc = {
        "accountId": current_user["accountId"],
        "email": body.email.lower(),
        "name": body.name,
        "role": body.role,
        "passwordHash": hash_password(temp_password),
        "mustResetPassword": True,
        "createdAt": now,
        "updatedAt": now,
        "lastLoginAt": None,
    }

    result = await users.insert_one(doc)
    doc["_id"] = result.inserted_id

    return UserResponse(**_serialize_user(doc))


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """List users belonging to the current account."""
    users = get_collection("users")

    query: dict = {"accountId": current_user["accountId"]}

    if cursor:
        try:
            query["_id"] = {"$gt": ObjectId(cursor)}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )

    docs = await users.find(query).sort("_id", 1).limit(limit).to_list(length=limit)
    return [UserResponse(**_serialize_user(d)) for d in docs]
