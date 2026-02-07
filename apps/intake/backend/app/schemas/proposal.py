"""Proposal schemas -- AI-proposed answers awaiting review."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProposalStatus(str, Enum):
    """Review status of a proposed answer."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class ProposalResponse(BaseModel):
    """A proposed answer for review."""

    proposal_id: str = Field(alias="proposalId")
    intake_id: str = Field(alias="intakeId")
    intake_question_instance_id: str = Field(alias="intakeQuestionInstanceId")
    answer_revision_id: str = Field(alias="answerRevisionId")

    # Question context
    question_text: str = Field(alias="questionText")
    question_key: str = Field(alias="questionKey")
    section_name: str = Field(alias="sectionName")

    # Proposed answer
    answer_text: Optional[str] = Field(default=None, alias="answerText")
    answer_structured_data: Optional[dict[str, Any]] = Field(
        default=None, alias="answerStructuredData"
    )
    confidence_score: Optional[float] = Field(
        default=None,
        alias="confidenceScore",
        ge=0.0,
        le=1.0,
    )

    # Evidence
    source_session_id: Optional[str] = Field(default=None, alias="sourceSessionId")
    source_evidence_item_id: Optional[str] = Field(
        default=None, alias="sourceEvidenceItemId"
    )
    evidence_excerpt: Optional[str] = Field(
        default=None,
        alias="evidenceExcerpt",
        description="Excerpt from the evidence supporting this proposal",
    )

    # Status
    status: ProposalStatus
    reviewed_at: Optional[datetime] = Field(default=None, alias="reviewedAt")
    reviewed_by: Optional[str] = Field(default=None, alias="reviewedBy")
    rejection_reason: Optional[str] = Field(default=None, alias="rejectionReason")

    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


class ProposalRejectRequest(BaseModel):
    """Reject a proposed answer."""

    reason: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Reason for rejecting the proposal",
    )

    model_config = ConfigDict(populate_by_name=True)
