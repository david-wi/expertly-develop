"""Session management routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.session import (
    SessionCreate,
    SessionResponse,
    SessionStatus,
    SessionUpdate,
)
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/sessions
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/sessions",
    response_model=ResponseEnvelope[SessionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new session",
)
async def create_session(
    intakeId: str,
    body: SessionCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new data-gathering session for an intake."""
    intakes_col = get_collection("intakes")
    sessions_col = get_collection("sessions")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)

    session_doc = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "sessionType": body.session_type.value,
        "status": SessionStatus.ACTIVE.value,
        "externalProviderId": body.external_provider_id,
        "startedAt": now,
        "endedAt": None,
        "durationSeconds": None,
        "notes": None,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await sessions_col.insert_one(session_doc)
    session_doc["_id"] = result.inserted_id

    return ResponseEnvelope(
        data=SessionResponse(
            sessionId=str(result.inserted_id),
            intakeId=intakeId,
            accountId=current_user["accountId"],
            sessionType=body.session_type,
            status=SessionStatus.ACTIVE,
            externalProviderId=body.external_provider_id,
            startedAt=now,
            endedAt=None,
            durationSeconds=None,
            notes=None,
            createdAt=now,
            updatedAt=now,
        )
    )


# ---------------------------------------------------------------------------
# PATCH /sessions/{sessionId}
# ---------------------------------------------------------------------------

@router.patch(
    "/sessions/{sessionId}",
    response_model=ResponseEnvelope[SessionResponse],
    summary="End or update a session",
)
async def update_session(
    sessionId: str,
    body: SessionUpdate,
    current_user: dict = Depends(get_current_user),
):
    """End a session by setting endedAt and durationSeconds.

    Also creates a usage_ledger entry for callSeconds when the session
    has a duration.
    """
    sessions_col = get_collection("sessions")
    usage_col = get_collection("usage_ledger")

    session = await sessions_col.find_one({"_id": ObjectId(sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    update_fields: dict = {"updatedAt": now}

    if body.ended_at is not None:
        update_fields["endedAt"] = body.ended_at
    elif session.get("endedAt") is None:
        # Default to now if not already ended and no explicit value given
        update_fields["endedAt"] = now

    if body.duration_seconds is not None:
        update_fields["durationSeconds"] = body.duration_seconds
    elif "endedAt" in update_fields and session.get("startedAt"):
        # Compute duration from timestamps
        ended = update_fields["endedAt"]
        started = session["startedAt"]
        update_fields["durationSeconds"] = int((ended - started).total_seconds())

    if body.notes is not None:
        update_fields["notes"] = body.notes

    if body.status is not None:
        update_fields["status"] = body.status.value
    elif session.get("status") == SessionStatus.ACTIVE.value:
        update_fields["status"] = SessionStatus.COMPLETED.value

    await sessions_col.update_one(
        {"_id": ObjectId(sessionId)},
        {"$set": update_fields},
    )

    # Create usage ledger entry for call seconds if we have a duration
    duration = update_fields.get("durationSeconds") or body.duration_seconds
    if duration and duration > 0:
        await usage_col.insert_one(
            {
                "intakeId": session["intakeId"],
                "accountId": session["accountId"],
                "sessionId": sessionId,
                "metricType": "callSeconds",
                "quantity": duration,
                "createdAt": now,
            }
        )

    # Re-fetch for response
    updated = await sessions_col.find_one({"_id": ObjectId(sessionId)})

    return ResponseEnvelope(
        data=SessionResponse(
            sessionId=str(updated["_id"]),
            intakeId=updated["intakeId"],
            accountId=updated["accountId"],
            sessionType=updated["sessionType"],
            status=updated["status"],
            externalProviderId=updated.get("externalProviderId"),
            startedAt=updated["startedAt"],
            endedAt=updated.get("endedAt"),
            durationSeconds=updated.get("durationSeconds"),
            notes=updated.get("notes"),
            createdAt=updated["createdAt"],
            updatedAt=updated["updatedAt"],
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/sessions
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/sessions",
    response_model=ResponseEnvelope[list[SessionResponse]],
    summary="List sessions for an intake",
)
async def list_sessions(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all sessions for an intake, sorted by startedAt descending."""
    sessions_col = get_collection("sessions")

    cursor = sessions_col.find({"intakeId": intakeId}).sort("startedAt", -1)

    sessions = []
    async for doc in cursor:
        sessions.append(
            SessionResponse(
                sessionId=str(doc["_id"]),
                intakeId=doc["intakeId"],
                accountId=doc["accountId"],
                sessionType=doc["sessionType"],
                status=doc["status"],
                externalProviderId=doc.get("externalProviderId"),
                startedAt=doc["startedAt"],
                endedAt=doc.get("endedAt"),
                durationSeconds=doc.get("durationSeconds"),
                notes=doc.get("notes"),
                createdAt=doc["createdAt"],
                updatedAt=doc["updatedAt"],
            )
        )

    return ResponseEnvelope(data=sessions)
