"""Voice call schemas -- real-time voice agent interaction protocol."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .session import TranscriptSegmentData
from .template import AnswerType


# ---------------------------------------------------------------------------
# Call Start
# ---------------------------------------------------------------------------

class CallStartRequest(BaseModel):
    """Webhook payload when a new call is initiated."""

    external_call_id: str = Field(
        alias="externalCallId",
        description="Call ID from the telephony provider (e.g. VAPI)",
    )
    from_phone: str = Field(
        alias="fromPhone",
        description="Caller phone number (E.164 format)",
    )
    to_phone: str = Field(
        alias="toPhone",
        description="Called phone number (E.164 format)",
    )

    model_config = ConfigDict(populate_by_name=True)


class CallStartResponse(BaseModel):
    """Response after a call session is created."""

    session_id: str = Field(alias="sessionId")
    initial_prompt: str = Field(
        alias="initialPrompt",
        description="Opening prompt for the voice agent to speak",
    )

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

class AuthenticateRequest(BaseModel):
    """Caller provides intake code and PIN to authenticate."""

    intake_code: str = Field(
        alias="intakeCode",
        description="Short code identifying the intake",
    )
    pin: str = Field(
        description="Contributor PIN for verification",
    )

    model_config = ConfigDict(populate_by_name=True)


class AuthenticateResponse(BaseModel):
    """Successful authentication response."""

    intake_id: str = Field(alias="intakeId")
    intake_name: str = Field(alias="intakeName")
    contributor_id: str = Field(alias="contributorId")
    next_prompt: str = Field(
        alias="nextPrompt",
        description="Next prompt for the voice agent to speak after authentication",
    )

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Conversation Flow
# ---------------------------------------------------------------------------

class NextStepRequest(BaseModel):
    """Agent requests the next action after processing a response."""

    last_question_answered: Optional[str] = Field(
        default=None,
        alias="lastQuestionAnswered",
        description="intakeQuestionInstanceId of the question just answered",
    )
    section_choice: Optional[str] = Field(
        default=None,
        alias="sectionChoice",
        description="intakeSectionInstanceId chosen by the caller (for section selection)",
    )

    model_config = ConfigDict(populate_by_name=True)


class NextStepResponse(BaseModel):
    """Instructions for the voice agent on what to do next."""

    say: str = Field(
        description="Text for the voice agent to speak",
    )
    expected_answer_type: Optional[AnswerType] = Field(
        default=None,
        alias="expectedAnswerType",
        description="Expected format of the caller's response",
    )
    intake_question_instance_id: Optional[str] = Field(
        default=None,
        alias="intakeQuestionInstanceId",
        description="Question instance the agent is asking about (null for navigation prompts)",
    )
    is_end_of_section: bool = Field(
        default=False,
        alias="isEndOfSection",
        description="Whether this is the last question in the current section",
    )
    is_end_of_intake: bool = Field(
        default=False,
        alias="isEndOfIntake",
        description="Whether all sections are complete",
    )

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Answer Submission
# ---------------------------------------------------------------------------

class AnswerSubmitRequest(BaseModel):
    """Submit an answer captured during the voice call."""

    intake_question_instance_id: str = Field(
        alias="intakeQuestionInstanceId",
        description="Question being answered",
    )
    raw_utterance_text: str = Field(
        alias="rawUtteranceText",
        description="Raw transcribed text of the caller's response",
    )
    transcript_segment: Optional[TranscriptSegmentData] = Field(
        default=None,
        alias="transcriptSegment",
        description="Timestamped segment of the transcript for this answer",
    )

    model_config = ConfigDict(populate_by_name=True)


class AnswerSubmitResponse(BaseModel):
    """Response after an answer is submitted during a call."""

    next_prompt: str = Field(
        alias="nextPrompt",
        description="Next prompt for the agent to speak",
    )
    answer_revision_id: str = Field(
        alias="answerRevisionId",
        description="ID of the answer revision created from this utterance",
    )
    parsed_answer_text: Optional[str] = Field(
        default=None,
        alias="parsedAnswerText",
        description="Cleaned/parsed version of the answer",
    )
    confidence_score: Optional[float] = Field(
        default=None,
        alias="confidenceScore",
        ge=0.0,
        le=1.0,
    )

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Call End
# ---------------------------------------------------------------------------

class CallEndRequest(BaseModel):
    """Payload when the call is ending."""

    duration_seconds: int = Field(
        alias="durationSeconds",
        ge=0,
        description="Total call duration in seconds",
    )
    final_transcript: Optional[str] = Field(
        default=None,
        alias="finalTranscript",
        description="Complete transcript of the call",
    )
    wants_to_continue_later: bool = Field(
        default=False,
        alias="wantsToContinueLater",
        description="Whether the caller wants to schedule a follow-up",
    )
    preferred_next_contact_at: Optional[datetime] = Field(
        default=None,
        alias="preferredNextContactAt",
        description="Caller's preferred time for the next call",
    )
    preferred_next_contact_person: Optional[str] = Field(
        default=None,
        alias="preferredNextContactPerson",
        description="Who should be called next (contributor ID or name)",
    )

    model_config = ConfigDict(populate_by_name=True)


class CallEndResponse(BaseModel):
    """Response after a call is ended and summarized."""

    summary: str = Field(
        description="Human-readable summary of what was accomplished during the call",
    )
    questions_answered: int = Field(
        alias="questionsAnswered",
        description="Number of questions answered during this call",
    )
    follow_up_plan_id: Optional[str] = Field(
        default=None,
        alias="followUpPlanId",
        description="ID of the follow-up created (if caller wants to continue later)",
    )

    model_config = ConfigDict(populate_by_name=True)
