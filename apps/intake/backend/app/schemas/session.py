"""Session schemas -- phone calls, file uploads, and URL refresh sessions."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SessionType(str, Enum):
    """Type of data-gathering session."""

    PHONE_CALL = "phoneCall"
    FILE_UPLOAD = "fileUpload"
    URL_REFRESH = "urlRefresh"


class SessionStatus(str, Enum):
    """Lifecycle status of a session."""

    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SessionCreate(BaseModel):
    """Start a new session."""

    session_type: SessionType = Field(
        alias="sessionType",
        description="Type of data-gathering session",
    )
    external_provider_id: Optional[str] = Field(
        default=None,
        alias="externalProviderId",
        description="External identifier from VAPI or other provider",
    )

    model_config = ConfigDict(populate_by_name=True)


class SessionUpdate(BaseModel):
    """Partial update for a session (e.g. when it ends)."""

    ended_at: Optional[datetime] = Field(
        default=None,
        alias="endedAt",
    )
    duration_seconds: Optional[int] = Field(
        default=None,
        alias="durationSeconds",
        ge=0,
    )
    notes: Optional[str] = Field(default=None, max_length=5000)
    status: Optional[SessionStatus] = Field(default=None)

    model_config = ConfigDict(populate_by_name=True)


class SessionResponse(BaseModel):
    """Full session representation."""

    session_id: str = Field(alias="sessionId")
    intake_id: str = Field(alias="intakeId")
    account_id: str = Field(alias="accountId")
    session_type: SessionType = Field(alias="sessionType")
    status: SessionStatus
    external_provider_id: Optional[str] = Field(
        default=None, alias="externalProviderId"
    )
    started_at: datetime = Field(alias="startedAt")
    ended_at: Optional[datetime] = Field(default=None, alias="endedAt")
    duration_seconds: Optional[int] = Field(default=None, alias="durationSeconds")
    notes: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Transcript
# ---------------------------------------------------------------------------

class TranscriptSegmentData(BaseModel):
    """A single segment of a transcript."""

    start_ms: int = Field(
        alias="startMs",
        ge=0,
        description="Start time in milliseconds from session start",
    )
    end_ms: int = Field(
        alias="endMs",
        ge=0,
        description="End time in milliseconds from session start",
    )
    speaker_label: str = Field(
        alias="speakerLabel",
        description="Identifier for the speaker (e.g. 'agent', 'caller')",
    )
    text: str = Field(description="Transcribed text for this segment")

    model_config = ConfigDict(populate_by_name=True)


class TranscriptCreate(BaseModel):
    """Create or replace the transcript for a session."""

    transcript_text: str = Field(
        alias="transcriptText",
        description="Full transcript as plain text",
    )
    segments: Optional[list[TranscriptSegmentData]] = Field(
        default=None,
        description="Time-stamped segments of the transcript",
    )

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Session Participant
# ---------------------------------------------------------------------------

class SessionParticipantResponse(BaseModel):
    """A participant in a session (agent, caller, etc.)."""

    session_participant_id: str = Field(alias="sessionParticipantId")
    session_id: str = Field(alias="sessionId")
    participant_type: str = Field(
        alias="participantType",
        description="Role in the session (e.g. 'agent', 'caller', 'contributor')",
    )
    display_name: Optional[str] = Field(default=None, alias="displayName")
    phone_number: Optional[str] = Field(default=None, alias="phoneNumber")
    intake_contributor_id: Optional[str] = Field(
        default=None, alias="intakeContributorId"
    )
    joined_at: datetime = Field(alias="joinedAt")
    left_at: Optional[datetime] = Field(default=None, alias="leftAt")

    model_config = ConfigDict(populate_by_name=True)
