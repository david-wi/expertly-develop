"""Follow-up plan management routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.follow_up import (
    FollowUpCreate,
    FollowUpResponse,
    FollowUpStatus,
)
from app.schemas.common import ResponseEnvelope

router = APIRouter()


def _doc_to_response(doc: dict) -> FollowUpResponse:
    """Convert a MongoDB follow_up document to a response model."""
    return FollowUpResponse(
        followUpId=str(doc["_id"]),
        intakeId=doc["intakeId"],
        accountId=doc["accountId"],
        createdFromSessionId=doc.get("createdFromSessionId"),
        status=doc["status"],
        nextContactAt=doc["nextContactAt"],
        nextContactWindowText=doc.get("nextContactWindowText"),
        contactMethod=doc["contactMethod"],
        contactPersonId=doc.get("contactPersonId"),
        focusSectionInstanceIds=doc.get("focusSectionInstanceIds"),
        completedSessionId=doc.get("completedSessionId"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/followUps
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/followUps",
    response_model=ResponseEnvelope[FollowUpResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a follow-up plan",
)
async def create_follow_up(
    intakeId: str,
    body: FollowUpCreate,
    current_user: dict = Depends(get_current_user),
):
    """Schedule a new follow-up contact for an intake."""
    intakes_col = get_collection("intakes")
    follow_ups_col = get_collection("follow_ups")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)

    follow_up_doc = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "createdFromSessionId": body.created_from_session_id,
        "status": FollowUpStatus.SCHEDULED.value,
        "nextContactAt": body.next_contact_at,
        "nextContactWindowText": body.next_contact_window_text,
        "contactMethod": body.contact_method.value,
        "contactPersonId": body.contact_person_id,
        "focusSectionInstanceIds": body.focus_section_instance_ids,
        "completedSessionId": None,
        "createdBy": current_user["userId"],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await follow_ups_col.insert_one(follow_up_doc)
    follow_up_doc["_id"] = result.inserted_id

    return ResponseEnvelope(data=_doc_to_response(follow_up_doc))


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/followUps
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/followUps",
    response_model=ResponseEnvelope[list[FollowUpResponse]],
    summary="List follow-up plans",
)
async def list_follow_ups(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all follow-up plans for an intake."""
    follow_ups_col = get_collection("follow_ups")

    cursor = follow_ups_col.find({"intakeId": intakeId}).sort("nextContactAt", 1)

    items = []
    async for doc in cursor:
        items.append(_doc_to_response(doc))

    return ResponseEnvelope(data=items)


# ---------------------------------------------------------------------------
# POST /followUps/{followUpPlanId}/markDone
# ---------------------------------------------------------------------------

@router.post(
    "/followUps/{followUpPlanId}/markDone",
    response_model=ResponseEnvelope[FollowUpResponse],
    summary="Mark follow-up as completed",
)
async def mark_done(
    followUpPlanId: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a follow-up plan as completed."""
    follow_ups_col = get_collection("follow_ups")

    follow_up = await follow_ups_col.find_one({"_id": ObjectId(followUpPlanId)})
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up plan not found")

    if follow_up["status"] in (
        FollowUpStatus.COMPLETED.value,
        FollowUpStatus.CANCELLED.value,
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Follow-up is already {follow_up['status']}",
        )

    now = datetime.now(timezone.utc)
    await follow_ups_col.update_one(
        {"_id": ObjectId(followUpPlanId)},
        {
            "$set": {
                "status": FollowUpStatus.COMPLETED.value,
                "completedAt": now,
                "updatedAt": now,
            }
        },
    )

    updated = await follow_ups_col.find_one({"_id": ObjectId(followUpPlanId)})
    return ResponseEnvelope(data=_doc_to_response(updated))


# ---------------------------------------------------------------------------
# POST /followUps/{followUpPlanId}/markSkipped
# ---------------------------------------------------------------------------

@router.post(
    "/followUps/{followUpPlanId}/markSkipped",
    response_model=ResponseEnvelope[FollowUpResponse],
    summary="Mark follow-up as skipped",
)
async def mark_skipped(
    followUpPlanId: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Mark a follow-up plan as skipped with a reason.

    Expects a JSON body with a ``reason`` field.
    """
    follow_ups_col = get_collection("follow_ups")

    follow_up = await follow_ups_col.find_one({"_id": ObjectId(followUpPlanId)})
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up plan not found")

    reason = body.get("reason", "")
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required")

    if follow_up["status"] in (
        FollowUpStatus.COMPLETED.value,
        FollowUpStatus.CANCELLED.value,
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Follow-up is already {follow_up['status']}",
        )

    now = datetime.now(timezone.utc)
    await follow_ups_col.update_one(
        {"_id": ObjectId(followUpPlanId)},
        {
            "$set": {
                "status": FollowUpStatus.CANCELLED.value,
                "skipReason": reason,
                "updatedAt": now,
            }
        },
    )

    updated = await follow_ups_col.find_one({"_id": ObjectId(followUpPlanId)})
    return ResponseEnvelope(data=_doc_to_response(updated))
