"""Intake schemas -- an individual intake instance and its progress."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class IntakeStatus(str, Enum):
    """Lifecycle status of an intake."""

    DRAFT = "draft"
    IN_PROGRESS = "inProgress"
    UNDER_REVIEW = "underReview"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class QuestionInstanceStatus(str, Enum):
    """Status of an individual question within an intake."""

    UNANSWERED = "unanswered"
    ANSWERED = "answered"
    SKIPPED = "skipped"
    LATER = "later"
    NOT_APPLICABLE = "notApplicable"


class SectionInstanceStatus(str, Enum):
    """Status of a section instance within an intake."""

    NOT_STARTED = "notStarted"
    IN_PROGRESS = "inProgress"
    COMPLETE = "complete"
    NOT_APPLICABLE = "notApplicable"


# ---------------------------------------------------------------------------
# Intake
# ---------------------------------------------------------------------------

class IntakeCreate(BaseModel):
    """Create a new intake."""

    intake_name: str = Field(
        alias="intakeName",
        min_length=1,
        max_length=400,
        description="Human-readable name for the intake (e.g. client name + date)",
    )
    intake_type_id: str = Field(
        alias="intakeTypeId",
        description="Type of intake being created",
    )
    template_version_id: Optional[str] = Field(
        default=None,
        alias="templateVersionId",
        description="Specific template version to use; falls back to the intake type default",
    )
    timezone: str = Field(
        default="UTC",
        max_length=60,
        description="IANA timezone for display and scheduling (e.g. 'America/New_York')",
    )
    voice_profile_id_override: Optional[str] = Field(
        default=None,
        alias="voiceProfileIdOverride",
        description="Override the intake type default voice profile",
    )

    model_config = ConfigDict(populate_by_name=True)


class IntakeUpdate(BaseModel):
    """Partial update for an intake."""

    intake_name: Optional[str] = Field(
        default=None,
        alias="intakeName",
        min_length=1,
        max_length=400,
    )
    intake_status: Optional[IntakeStatus] = Field(
        default=None,
        alias="intakeStatus",
    )
    voice_profile_id_override: Optional[str] = Field(
        default=None,
        alias="voiceProfileIdOverride",
    )

    model_config = ConfigDict(populate_by_name=True)


class IntakeProgressSummary(BaseModel):
    """Aggregate progress statistics for an intake."""

    total_questions: int = Field(alias="totalQuestions")
    answered: int = Field(default=0)
    skipped: int = Field(default=0)
    later: int = Field(default=0)
    not_applicable: int = Field(default=0, alias="notApplicable")
    unanswered: int = Field(default=0)
    percent_complete: float = Field(
        default=0.0,
        alias="percentComplete",
        ge=0.0,
        le=100.0,
        description="Percentage of required questions that are answered",
    )

    model_config = ConfigDict(populate_by_name=True)


class IntakeResponse(BaseModel):
    """Full intake representation."""

    intake_id: str = Field(alias="intakeId")
    account_id: str = Field(alias="accountId")
    intake_name: str = Field(alias="intakeName")
    intake_type_id: str = Field(alias="intakeTypeId")
    template_version_id: str = Field(alias="templateVersionId")
    intake_status: IntakeStatus = Field(alias="intakeStatus")
    timezone: str
    voice_profile_id_override: Optional[str] = Field(
        default=None, alias="voiceProfileIdOverride"
    )
    intake_code: Optional[str] = Field(
        default=None,
        alias="intakeCode",
        description="Short code for phone authentication; shown only once on create",
    )
    intake_portal_url: Optional[str] = Field(
        default=None,
        alias="intakePortalUrl",
        description="URL for the contributor self-service portal",
    )
    progress: Optional[IntakeProgressSummary] = Field(
        default=None,
        description="Aggregate progress summary",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Section Instance
# ---------------------------------------------------------------------------

class IntakeSectionInstanceResponse(BaseModel):
    """A section instance within an intake (one per repeat index)."""

    intake_section_instance_id: str = Field(alias="intakeSectionInstanceId")
    intake_id: str = Field(alias="intakeId")
    template_section_id: str = Field(alias="templateSectionId")
    section_name: str = Field(alias="sectionName")
    status: SectionInstanceStatus
    total_questions: int = Field(alias="totalQuestions")
    answered_questions: int = Field(default=0, alias="answeredQuestions")
    percent_complete: float = Field(
        default=0.0,
        alias="percentComplete",
        ge=0.0,
        le=100.0,
    )
    marked_complete_at: Optional[datetime] = Field(
        default=None, alias="markedCompleteAt"
    )
    repeat_index: int = Field(default=0, alias="repeatIndex")
    instance_label: Optional[str] = Field(
        default=None,
        alias="instanceLabel",
        description="User-supplied label for this repeat instance (e.g. 'Vehicle 1')",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Question Instance
# ---------------------------------------------------------------------------

class IntakeQuestionInstanceResponse(BaseModel):
    """A question instance within an intake section instance."""

    intake_question_instance_id: str = Field(alias="intakeQuestionInstanceId")
    intake_section_instance_id: str = Field(alias="intakeSectionInstanceId")
    template_question_id: str = Field(alias="templateQuestionId")
    question_text: str = Field(alias="questionText")
    question_key: str = Field(alias="questionKey")
    answer_type: str = Field(alias="answerType")
    is_required: bool = Field(alias="isRequired")
    status: QuestionInstanceStatus
    current_answer: Optional[str] = Field(
        default=None,
        alias="currentAnswer",
        description="The currently chosen answer text (if any)",
    )
    current_answer_revision_id: Optional[str] = Field(
        default=None,
        alias="currentAnswerRevisionId",
    )
    last_answered_at: Optional[datetime] = Field(
        default=None, alias="lastAnsweredAt"
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
