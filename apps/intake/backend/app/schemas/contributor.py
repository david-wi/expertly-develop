"""Contributor schemas -- external people who provide information for intakes."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ContactMethod(str, Enum):
    """Preferred contact method for a contributor."""

    PHONE = "phone"
    EMAIL = "email"
    SMS = "sms"


class AssignmentPolicy(str, Enum):
    """How the agent should handle questions already answered."""

    ASK_ONLY_IF_MISSING = "askOnlyIfMissing"
    ASK_TO_CONFIRM = "askToConfirm"
    ASK_ANYWAY = "askAnyway"


# ---------------------------------------------------------------------------
# Contributor
# ---------------------------------------------------------------------------

class ContributorCreate(BaseModel):
    """Register a new contributor for an intake."""

    display_name: str = Field(
        alias="displayName",
        min_length=1,
        max_length=300,
        description="Name shown in the UI and spoken by the agent",
    )
    email: Optional[EmailStr] = Field(
        default=None,
        description="Contributor email address",
    )
    phone: Optional[str] = Field(
        default=None,
        max_length=30,
        description="Contributor phone number",
    )
    preferred_contact_method: Optional[ContactMethod] = Field(
        default=None,
        alias="preferredContactMethod",
    )
    is_primary_point_person: bool = Field(
        default=False,
        alias="isPrimaryPointPerson",
        description="Whether this contributor is the main point of contact",
    )

    model_config = ConfigDict(populate_by_name=True)


class ContributorResponse(BaseModel):
    """Full contributor representation."""

    intake_contributor_id: str = Field(alias="intakeContributorId")
    intake_id: str = Field(alias="intakeId")
    display_name: str = Field(alias="displayName")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    preferred_contact_method: Optional[ContactMethod] = Field(
        default=None, alias="preferredContactMethod"
    )
    is_primary_point_person: bool = Field(alias="isPrimaryPointPerson")
    pin: Optional[str] = Field(
        default=None,
        description="PIN for phone authentication (shown once on create)",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Assignment
# ---------------------------------------------------------------------------

class AssignmentCreate(BaseModel):
    """Assign a contributor to a section instance."""

    intake_contributor_id: str = Field(
        alias="intakeContributorId",
        description="Contributor being assigned",
    )
    intake_section_instance_id: str = Field(
        alias="intakeSectionInstanceId",
        description="Section instance the contributor is responsible for",
    )
    assignment_policy: AssignmentPolicy = Field(
        default=AssignmentPolicy.ASK_ONLY_IF_MISSING,
        alias="assignmentPolicy",
        description="How the agent should handle already-answered questions",
    )

    model_config = ConfigDict(populate_by_name=True)


class AssignmentResponse(BaseModel):
    """Full assignment representation."""

    assignment_id: str = Field(alias="assignmentId")
    intake_contributor_id: str = Field(alias="intakeContributorId")
    intake_section_instance_id: str = Field(alias="intakeSectionInstanceId")
    assignment_policy: AssignmentPolicy = Field(alias="assignmentPolicy")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
