"""Voice profile management routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.core.database import get_collection
from app.core.security import get_current_user, require_admin
from app.schemas.voice_profile import (
    VoiceProfileCreate,
    VoiceProfileResponse,
    VoiceProfileUpdate,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_voice_profile(doc: dict) -> dict:
    """Convert a MongoDB voice-profile document to a serializable dict."""
    return {
        "voiceProfileId": str(doc["_id"]),
        "accountId": str(doc["accountId"]),
        "voiceProfileName": doc["voiceProfileName"],
        "vapiVoiceId": doc["vapiVoiceId"],
        "notes": doc.get("notes"),
        "isEnabled": doc.get("isEnabled", True),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/voiceProfiles", response_model=list[VoiceProfileResponse])
async def list_voice_profiles(
    current_user: dict = Depends(get_current_user),
    isEnabled: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """List voice profiles for the current account.

    Optionally filter by ``isEnabled``.
    """
    collection = get_collection("voice_profiles")

    query: dict = {"accountId": current_user["accountId"]}
    if isEnabled is not None:
        query["isEnabled"] = isEnabled

    if cursor:
        try:
            query["_id"] = {"$gt": ObjectId(cursor)}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor",
            )

    docs = (
        await collection.find(query).sort("_id", 1).limit(limit).to_list(length=limit)
    )
    return [VoiceProfileResponse(**_serialize_voice_profile(d)) for d in docs]


@router.post(
    "/voiceProfiles",
    response_model=VoiceProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_voice_profile(
    body: VoiceProfileCreate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Create a new voice profile (admin only)."""
    collection = get_collection("voice_profiles")

    now = datetime.now(timezone.utc)
    doc = {
        "accountId": current_user["accountId"],
        "voiceProfileName": body.voice_profile_name,
        "vapiVoiceId": body.vapi_voice_id,
        "notes": body.notes,
        "isEnabled": body.is_enabled,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    return VoiceProfileResponse(**_serialize_voice_profile(doc))


@router.get("/voiceProfiles/{voiceProfileId}", response_model=VoiceProfileResponse)
async def get_voice_profile(
    voiceProfileId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a single voice profile by ID."""
    collection = get_collection("voice_profiles")

    try:
        oid = ObjectId(voiceProfileId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid voice profile ID",
        )

    doc = await collection.find_one(
        {"_id": oid, "accountId": current_user["accountId"]}
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice profile not found",
        )

    return VoiceProfileResponse(**_serialize_voice_profile(doc))


@router.patch("/voiceProfiles/{voiceProfileId}", response_model=VoiceProfileResponse)
async def update_voice_profile(
    voiceProfileId: str,
    body: VoiceProfileUpdate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Partially update a voice profile (admin only)."""
    collection = get_collection("voice_profiles")

    try:
        oid = ObjectId(voiceProfileId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid voice profile ID",
        )

    updates: dict = {}
    if body.voice_profile_name is not None:
        updates["voiceProfileName"] = body.voice_profile_name
    if body.vapi_voice_id is not None:
        updates["vapiVoiceId"] = body.vapi_voice_id
    if body.notes is not None:
        updates["notes"] = body.notes
    if body.is_enabled is not None:
        updates["isEnabled"] = body.is_enabled

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    updates["updatedAt"] = datetime.now(timezone.utc)

    updated = await collection.find_one_and_update(
        {"_id": oid, "accountId": current_user["accountId"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice profile not found",
        )

    return VoiceProfileResponse(**_serialize_voice_profile(updated))
