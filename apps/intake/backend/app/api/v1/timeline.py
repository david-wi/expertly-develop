"""Intake timeline routes -- merged chronological event view."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.timeline import TimelineEvent, TimelineEventType, TimelineResponse
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/timeline
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/timeline",
    response_model=ResponseEnvelope[TimelineResponse],
    summary="Merged timeline of intake events",
)
async def get_timeline(
    intakeId: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Return a merged timeline of sessions, revisions, file uploads,
    URL refreshes, follow-ups, and other events for an intake.

    Queries multiple collections, merges by timestamp, and returns
    sorted events.
    """
    intakes_col = get_collection("intakes")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    events: list[dict] = []

    # --- Sessions (start and end) ---
    sessions_col = get_collection("sessions")
    async for doc in sessions_col.find({"intakeId": intakeId}):
        sid = str(doc["_id"])
        events.append(
            {
                "eventId": f"session-start-{sid}",
                "eventType": TimelineEventType.SESSION_STARTED.value,
                "timestamp": doc["startedAt"],
                "description": f"Session started ({doc.get('sessionType', 'unknown')})",
                "sessionId": sid,
                "userId": doc.get("createdBy"),
            }
        )
        if doc.get("endedAt"):
            duration = doc.get("durationSeconds", 0)
            events.append(
                {
                    "eventId": f"session-end-{sid}",
                    "eventType": TimelineEventType.SESSION_ENDED.value,
                    "timestamp": doc["endedAt"],
                    "description": (
                        f"Session ended ({duration}s)"
                        if duration
                        else "Session ended"
                    ),
                    "sessionId": sid,
                    "userId": doc.get("createdBy"),
                }
            )

    # --- Answer revisions ---
    revisions_col = get_collection("answer_revisions")
    async for doc in revisions_col.find({"intakeId": intakeId}):
        rid = str(doc["_id"])
        revision_type = doc.get("revisionType", "unknown")
        event_type = TimelineEventType.ANSWER_PROPOSED
        if revision_type in ("confirmed", "manualEdit"):
            event_type = TimelineEventType.ANSWER_CONFIRMED

        events.append(
            {
                "eventId": f"revision-{rid}",
                "eventType": event_type.value,
                "timestamp": doc["createdAt"],
                "description": f"Answer revision ({revision_type})",
                "answerRevisionId": rid,
                "intakeQuestionInstanceId": doc.get("intakeQuestionInstanceId"),
                "sessionId": doc.get("sourceSessionId"),
                "userId": doc.get("createdBy"),
            }
        )

    # --- File uploads ---
    files_col = get_collection("file_assets")
    async for doc in files_col.find({"intakeId": intakeId}):
        fid = str(doc["_id"])
        events.append(
            {
                "eventId": f"file-{fid}",
                "eventType": TimelineEventType.FILE_UPLOADED.value,
                "timestamp": doc["createdAt"],
                "description": f"File uploaded: {doc.get('fileName', 'unknown')}",
                "fileAssetId": fid,
                "userId": doc.get("uploadedBy"),
            }
        )

    # --- URL refreshes (snapshots) ---
    snapshots_col = get_collection("url_snapshots")
    async for doc in snapshots_col.find({"intakeId": intakeId}):
        snap_id = str(doc["_id"])
        events.append(
            {
                "eventId": f"url-refresh-{snap_id}",
                "eventType": TimelineEventType.URL_REFRESHED.value,
                "timestamp": doc["fetchedAt"],
                "description": doc.get("diffSummary", "URL refreshed"),
                "urlSourceId": doc.get("urlSourceId"),
            }
        )

    # --- Follow-ups ---
    follow_ups_col = get_collection("follow_ups")
    async for doc in follow_ups_col.find({"intakeId": intakeId}):
        fid = str(doc["_id"])
        events.append(
            {
                "eventId": f"followup-created-{fid}",
                "eventType": TimelineEventType.FOLLOW_UP_SCHEDULED.value,
                "timestamp": doc["createdAt"],
                "description": f"Follow-up scheduled for {doc.get('nextContactAt', 'TBD')}",
                "followUpId": fid,
                "userId": doc.get("createdBy"),
            }
        )
        if doc.get("status") in ("completed",):
            completed_at = doc.get("completedAt") or doc.get("updatedAt")
            if completed_at:
                events.append(
                    {
                        "eventId": f"followup-done-{fid}",
                        "eventType": TimelineEventType.FOLLOW_UP_COMPLETED.value,
                        "timestamp": completed_at,
                        "description": "Follow-up completed",
                        "followUpId": fid,
                    }
                )

    # --- Contributors added ---
    contributors_col = get_collection("intake_contributors")
    async for doc in contributors_col.find({"intakeId": intakeId}):
        cid = str(doc["_id"])
        events.append(
            {
                "eventId": f"contributor-{cid}",
                "eventType": TimelineEventType.CONTRIBUTOR_ADDED.value,
                "timestamp": doc["createdAt"],
                "description": f"Contributor added: {doc.get('displayName', 'unknown')}",
                "contributorId": cid,
            }
        )

    # --- Exports ---
    exports_col = get_collection("exports")
    async for doc in exports_col.find({"intakeId": intakeId}):
        eid = str(doc["_id"])
        if doc.get("status") == "completed":
            events.append(
                {
                    "eventId": f"export-{eid}",
                    "eventType": TimelineEventType.EXPORT_GENERATED.value,
                    "timestamp": doc.get("completedAt", doc["requestedAt"]),
                    "description": f"Export generated ({doc.get('format', 'unknown')})",
                    "userId": doc.get("requestedBy"),
                }
            )

    # Sort all events by timestamp descending (most recent first)
    events.sort(key=lambda e: e["timestamp"], reverse=True)

    total_count = len(events)

    # Apply pagination
    paginated = events[offset : offset + limit]

    # Convert to response models
    timeline_events = []
    for evt in paginated:
        timeline_events.append(
            TimelineEvent(
                eventId=evt["eventId"],
                intakeId=intakeId,
                eventType=evt["eventType"],
                timestamp=evt["timestamp"],
                description=evt["description"],
                sessionId=evt.get("sessionId"),
                answerRevisionId=evt.get("answerRevisionId"),
                intakeQuestionInstanceId=evt.get("intakeQuestionInstanceId"),
                intakeSectionInstanceId=evt.get("intakeSectionInstanceId"),
                fileAssetId=evt.get("fileAssetId"),
                urlSourceId=evt.get("urlSourceId"),
                contributorId=evt.get("contributorId"),
                followUpId=evt.get("followUpId"),
                userId=evt.get("userId"),
                metadata=evt.get("metadata"),
            )
        )

    return ResponseEnvelope(
        data=TimelineResponse(
            events=timeline_events,
            totalCount=total_count,
        )
    )
