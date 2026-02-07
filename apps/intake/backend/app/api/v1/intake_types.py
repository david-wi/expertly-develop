"""Intake type management routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.core.database import get_collection
from app.core.security import get_current_user, require_admin
from app.schemas.intake_type import (
    IntakeTypeCreate,
    IntakeTypeResponse,
    IntakeTypeUpdate,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize_intake_type(doc: dict) -> dict:
    """Convert a MongoDB intake-type document to a serializable dict."""
    return {
        "intakeTypeId": str(doc["_id"]),
        "accountId": str(doc["accountId"]),
        "intakeTypeName": doc["intakeTypeName"],
        "description": doc.get("description"),
        "defaultTemplateVersionId": doc.get("defaultTemplateVersionId"),
        "defaultVoiceProfileId": doc.get("defaultVoiceProfileId"),
        "defaultsRecordingEnabled": doc.get("defaultsRecordingEnabled", True),
        "defaultsTranscriptionEnabled": doc.get("defaultsTranscriptionEnabled", True),
        "defaultsContinueRecordingAfterTransfer": doc.get(
            "defaultsContinueRecordingAfterTransfer", False
        ),
        "createdAt": doc["createdAt"],
        "updatedAt": doc["updatedAt"],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/intakeTypes", response_model=list[IntakeTypeResponse])
async def list_intake_types(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """List intake types for the current account."""
    collection = get_collection("intake_types")

    query: dict = {"accountId": current_user["accountId"]}

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
    return [IntakeTypeResponse(**_serialize_intake_type(d)) for d in docs]


@router.post(
    "/intakeTypes",
    response_model=IntakeTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_intake_type(
    body: IntakeTypeCreate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Create a new intake type (admin only)."""
    collection = get_collection("intake_types")

    now = datetime.now(timezone.utc)
    doc = {
        "accountId": current_user["accountId"],
        "intakeTypeName": body.intake_type_name,
        "description": body.description,
        "defaultTemplateVersionId": body.default_template_version_id,
        "defaultVoiceProfileId": body.default_voice_profile_id,
        "defaultsRecordingEnabled": body.defaults_recording_enabled,
        "defaultsTranscriptionEnabled": body.defaults_transcription_enabled,
        "defaultsContinueRecordingAfterTransfer": body.defaults_continue_recording_after_transfer,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await collection.insert_one(doc)
    doc["_id"] = result.inserted_id

    return IntakeTypeResponse(**_serialize_intake_type(doc))


@router.get("/intakeTypes/{intakeTypeId}", response_model=IntakeTypeResponse)
async def get_intake_type(
    intakeTypeId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a single intake type by ID."""
    collection = get_collection("intake_types")

    try:
        oid = ObjectId(intakeTypeId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid intake type ID",
        )

    doc = await collection.find_one(
        {"_id": oid, "accountId": current_user["accountId"]}
    )
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Intake type not found",
        )

    return IntakeTypeResponse(**_serialize_intake_type(doc))


@router.patch("/intakeTypes/{intakeTypeId}", response_model=IntakeTypeResponse)
async def update_intake_type(
    intakeTypeId: str,
    body: IntakeTypeUpdate,
    current_user: dict = Depends(get_current_user),
    _: dict = Depends(require_admin),
):
    """Partially update an intake type (admin only)."""
    collection = get_collection("intake_types")

    try:
        oid = ObjectId(intakeTypeId)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid intake type ID",
        )

    updates: dict = {}
    if body.intake_type_name is not None:
        updates["intakeTypeName"] = body.intake_type_name
    if body.description is not None:
        updates["description"] = body.description
    if body.default_template_version_id is not None:
        updates["defaultTemplateVersionId"] = body.default_template_version_id
    if body.default_voice_profile_id is not None:
        updates["defaultVoiceProfileId"] = body.default_voice_profile_id
    if body.defaults_recording_enabled is not None:
        updates["defaultsRecordingEnabled"] = body.defaults_recording_enabled
    if body.defaults_transcription_enabled is not None:
        updates["defaultsTranscriptionEnabled"] = body.defaults_transcription_enabled
    if body.defaults_continue_recording_after_transfer is not None:
        updates["defaultsContinueRecordingAfterTransfer"] = (
            body.defaults_continue_recording_after_transfer
        )

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
            detail="Intake type not found",
        )

    return IntakeTypeResponse(**_serialize_intake_type(updated))
