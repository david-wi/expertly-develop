"""Answer revision schemas -- versioned answers to intake questions."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class RevisionType(str, Enum):
    """How the answer revision was produced."""

    PROPOSED_FROM_CALL = "proposedFromCall"
    PROPOSED_FROM_UPLOAD = "proposedFromUpload"
    PROPOSED_FROM_URL_REFRESH = "proposedFromUrlRefresh"
    CONFIRMED = "confirmed"
    MANUAL_EDIT = "manualEdit"


class AnswerRevisionCreate(BaseModel):
    """Create a new answer revision for a question instance."""

    intake_question_instance_id: str = Field(
        alias="intakeQuestionInstanceId",
        description="Question instance this revision belongs to",
    )
    revision_type: RevisionType = Field(
        alias="revisionType",
        description="How this answer was produced",
    )
    answer_text: Optional[str] = Field(
        default=None,
        alias="answerText",
        description="Plain-text representation of the answer",
    )
    answer_structured_data: Optional[dict[str, Any]] = Field(
        default=None,
        alias="answerStructuredData",
        description="Structured/typed representation of the answer (e.g. list items, dates)",
    )
    confidence_score: Optional[float] = Field(
        default=None,
        alias="confidenceScore",
        ge=0.0,
        le=1.0,
        description="AI confidence score (0-1); null for manual edits",
    )
    source_session_id: Optional[str] = Field(
        default=None,
        alias="sourceSessionId",
        description="Session that produced this answer (call, upload, etc.)",
    )
    source_evidence_item_id: Optional[str] = Field(
        default=None,
        alias="sourceEvidenceItemId",
        description="Evidence item that supports this answer",
    )
    make_current: bool = Field(
        default=False,
        alias="makeCurrent",
        description="If true, immediately mark this revision as the current answer",
    )

    model_config = ConfigDict(populate_by_name=True)


class AnswerRevisionResponse(BaseModel):
    """Full answer revision representation."""

    answer_revision_id: str = Field(alias="answerRevisionId")
    intake_question_instance_id: str = Field(alias="intakeQuestionInstanceId")
    revision_type: RevisionType = Field(alias="revisionType")
    answer_text: Optional[str] = Field(default=None, alias="answerText")
    answer_structured_data: Optional[dict[str, Any]] = Field(
        default=None, alias="answerStructuredData"
    )
    confidence_score: Optional[float] = Field(default=None, alias="confidenceScore")
    source_session_id: Optional[str] = Field(default=None, alias="sourceSessionId")
    source_evidence_item_id: Optional[str] = Field(
        default=None, alias="sourceEvidenceItemId"
    )
    is_current: bool = Field(
        default=False,
        alias="isCurrent",
        description="Whether this revision is the currently chosen answer",
    )
    created_at: datetime = Field(alias="createdAt")
    created_by: Optional[str] = Field(
        default=None,
        alias="createdBy",
        description="User ID of the person who created this revision",
    )

    model_config = ConfigDict(populate_by_name=True)


class CurrentAnswerResponse(BaseModel):
    """The currently chosen answer for a question instance."""

    answer_revision_id: str = Field(alias="answerRevisionId")
    answer_text: Optional[str] = Field(default=None, alias="answerText")
    answer_structured_data: Optional[dict[str, Any]] = Field(
        default=None, alias="answerStructuredData"
    )
    chosen_at: datetime = Field(alias="chosenAt")
    chosen_by: Optional[str] = Field(
        default=None,
        alias="chosenBy",
        description="User ID of the person who chose this answer",
    )

    model_config = ConfigDict(populate_by_name=True)


class ChooseCurrentRequest(BaseModel):
    """Request to set a specific revision as the current answer."""

    intake_question_instance_id: str = Field(
        alias="intakeQuestionInstanceId",
        description="Question instance to update",
    )
    answer_revision_id: str = Field(
        alias="answerRevisionId",
        description="Revision to promote to current",
    )

    model_config = ConfigDict(populate_by_name=True)
