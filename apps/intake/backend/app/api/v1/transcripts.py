"""Transcript storage and retrieval routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.session import TranscriptCreate, TranscriptSegmentData
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# Response model (inline since session.py doesn't export a TranscriptResponse)
# ---------------------------------------------------------------------------

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class TranscriptResponse(BaseModel):
    """Full transcript representation."""

    transcript_id: str = Field(alias="transcriptId")
    session_id: str = Field(alias="sessionId")
    transcript_text: str = Field(alias="transcriptText")
    segments: list[TranscriptSegmentData] = Field(default_factory=list)
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# POST /sessions/{sessionId}/transcript
# ---------------------------------------------------------------------------

@router.post(
    "/sessions/{sessionId}/transcript",
    response_model=ResponseEnvelope[TranscriptResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Store transcript for a session",
)
async def store_transcript(
    sessionId: str,
    body: TranscriptCreate,
    current_user: dict = Depends(get_current_user),
):
    """Store transcript text and segments for a session.

    Creates a transcript document and individual transcript_segment documents.
    """
    sessions_col = get_collection("sessions")
    transcripts_col = get_collection("transcripts")
    segments_col = get_collection("transcript_segments")

    session = await sessions_col.find_one({"_id": ObjectId(sessionId)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)

    # Create the transcript document
    transcript_doc = {
        "sessionId": sessionId,
        "intakeId": session["intakeId"],
        "accountId": session["accountId"],
        "transcriptText": body.transcript_text,
        "createdAt": now,
    }

    result = await transcripts_col.insert_one(transcript_doc)
    transcript_id = str(result.inserted_id)

    # Create segment documents
    segment_docs = []
    if body.segments:
        for seg in body.segments:
            segment_docs.append(
                {
                    "transcriptId": transcript_id,
                    "sessionId": sessionId,
                    "startMs": seg.start_ms,
                    "endMs": seg.end_ms,
                    "speakerLabel": seg.speaker_label,
                    "text": seg.text,
                    "createdAt": now,
                }
            )
        if segment_docs:
            await segments_col.insert_many(segment_docs)

    return ResponseEnvelope(
        data=TranscriptResponse(
            transcriptId=transcript_id,
            sessionId=sessionId,
            transcriptText=body.transcript_text,
            segments=body.segments or [],
            createdAt=now,
        )
    )


# ---------------------------------------------------------------------------
# GET /sessions/{sessionId}/transcript
# ---------------------------------------------------------------------------

@router.get(
    "/sessions/{sessionId}/transcript",
    response_model=ResponseEnvelope[TranscriptResponse],
    summary="Get transcript for a session",
)
async def get_transcript(
    sessionId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return the transcript with segments for a session."""
    transcripts_col = get_collection("transcripts")
    segments_col = get_collection("transcript_segments")

    transcript = await transcripts_col.find_one({"sessionId": sessionId})
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    transcript_id = str(transcript["_id"])

    # Fetch segments
    segments = []
    cursor = segments_col.find({"transcriptId": transcript_id}).sort("startMs", 1)
    async for seg_doc in cursor:
        segments.append(
            TranscriptSegmentData(
                startMs=seg_doc["startMs"],
                endMs=seg_doc["endMs"],
                speakerLabel=seg_doc["speakerLabel"],
                text=seg_doc["text"],
            )
        )

    return ResponseEnvelope(
        data=TranscriptResponse(
            transcriptId=transcript_id,
            sessionId=sessionId,
            transcriptText=transcript["transcriptText"],
            segments=segments,
            createdAt=transcript["createdAt"],
        )
    )
