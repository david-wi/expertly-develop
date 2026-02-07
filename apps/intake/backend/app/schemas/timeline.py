"""Timeline schemas -- chronological event log for an intake."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class TimelineEventType(str, Enum):
    """Types of events that appear on an intake timeline."""

    INTAKE_CREATED = "intakeCreated"
    INTAKE_STATUS_CHANGED = "intakeStatusChanged"
    SESSION_STARTED = "sessionStarted"
    SESSION_ENDED = "sessionEnded"
    ANSWER_PROPOSED = "answerProposed"
    ANSWER_CONFIRMED = "answerConfirmed"
    ANSWER_REJECTED = "answerRejected"
    ANSWER_EDITED = "answerEdited"
    SECTION_COMPLETED = "sectionCompleted"
    FILE_UPLOADED = "fileUploaded"
    URL_REFRESHED = "urlRefreshed"
    CONTRIBUTOR_ADDED = "contributorAdded"
    FOLLOW_UP_SCHEDULED = "followUpScheduled"
    FOLLOW_UP_COMPLETED = "followUpCompleted"
    EXPORT_GENERATED = "exportGenerated"
    NOTE_ADDED = "noteAdded"


class TimelineEvent(BaseModel):
    """A single event in the intake timeline."""

    event_id: str = Field(alias="eventId")
    intake_id: str = Field(alias="intakeId")
    event_type: TimelineEventType = Field(alias="eventType")
    timestamp: datetime
    description: str = Field(description="Human-readable event description")

    # Optional references to related entities
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    answer_revision_id: Optional[str] = Field(default=None, alias="answerRevisionId")
    intake_question_instance_id: Optional[str] = Field(
        default=None, alias="intakeQuestionInstanceId"
    )
    intake_section_instance_id: Optional[str] = Field(
        default=None, alias="intakeSectionInstanceId"
    )
    file_asset_id: Optional[str] = Field(default=None, alias="fileAssetId")
    url_source_id: Optional[str] = Field(default=None, alias="urlSourceId")
    contributor_id: Optional[str] = Field(default=None, alias="contributorId")
    follow_up_id: Optional[str] = Field(default=None, alias="followUpId")
    user_id: Optional[str] = Field(
        default=None,
        alias="userId",
        description="User who triggered the event (null for system events)",
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Additional event-specific data",
    )

    model_config = ConfigDict(populate_by_name=True)


class TimelineResponse(BaseModel):
    """Paginated list of timeline events."""

    events: list[TimelineEvent] = Field(description="Chronological list of events")
    next_cursor: Optional[str] = Field(
        default=None,
        alias="nextCursor",
        description="Cursor for fetching the next page",
    )
    total_count: Optional[int] = Field(
        default=None,
        alias="totalCount",
    )

    model_config = ConfigDict(populate_by_name=True)
