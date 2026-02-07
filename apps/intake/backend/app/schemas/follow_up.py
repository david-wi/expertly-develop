"""Follow-up schemas -- scheduled follow-up contacts for intakes."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FollowUpStatus(str, Enum):
    """Lifecycle status of a follow-up."""

    SCHEDULED = "scheduled"
    IN_PROGRESS = "inProgress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    MISSED = "missed"


class FollowUpContactMethod(str, Enum):
    """How the follow-up will be conducted."""

    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"


class FollowUpCreate(BaseModel):
    """Schedule a new follow-up contact."""

    created_from_session_id: Optional[str] = Field(
        default=None,
        alias="createdFromSessionId",
        description="Session that triggered this follow-up",
    )
    next_contact_at: datetime = Field(
        alias="nextContactAt",
        description="Scheduled date/time for the follow-up",
    )
    next_contact_window_text: Optional[str] = Field(
        default=None,
        alias="nextContactWindowText",
        max_length=500,
        description="Human-readable description of preferred time window (e.g. 'mornings are best')",
    )
    contact_method: FollowUpContactMethod = Field(
        default=FollowUpContactMethod.PHONE,
        alias="contactMethod",
    )
    contact_person_id: Optional[str] = Field(
        default=None,
        alias="contactPersonId",
        description="Contributor to contact during this follow-up",
    )
    focus_section_instance_ids: Optional[list[str]] = Field(
        default=None,
        alias="focusSectionInstanceIds",
        description="Section instances to prioritize during this follow-up",
    )

    model_config = ConfigDict(populate_by_name=True)


class FollowUpResponse(BaseModel):
    """Full follow-up representation."""

    follow_up_id: str = Field(alias="followUpId")
    intake_id: str = Field(alias="intakeId")
    account_id: str = Field(alias="accountId")
    created_from_session_id: Optional[str] = Field(
        default=None, alias="createdFromSessionId"
    )
    status: FollowUpStatus
    next_contact_at: datetime = Field(alias="nextContactAt")
    next_contact_window_text: Optional[str] = Field(
        default=None, alias="nextContactWindowText"
    )
    contact_method: FollowUpContactMethod = Field(alias="contactMethod")
    contact_person_id: Optional[str] = Field(default=None, alias="contactPersonId")
    focus_section_instance_ids: Optional[list[str]] = Field(
        default=None, alias="focusSectionInstanceIds"
    )
    completed_session_id: Optional[str] = Field(
        default=None,
        alias="completedSessionId",
        description="Session that fulfilled this follow-up",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
