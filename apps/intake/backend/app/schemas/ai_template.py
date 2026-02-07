"""Schemas for AI-powered template suggestion generation."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .template import AnswerType


# ---------------------------------------------------------------------------
# Suggested structures (returned by AI, reviewed by admin)
# ---------------------------------------------------------------------------


class SuggestedQuestion(BaseModel):
    """A question suggested by AI, matching TemplateQuestion fields."""

    question_key: str = Field(alias="questionKey")
    question_text: str = Field(alias="questionText")
    question_help_text: Optional[str] = Field(default=None, alias="questionHelpText")
    question_order: int = Field(alias="questionOrder")
    is_required: bool = Field(default=True, alias="isRequired")
    answer_type: AnswerType = Field(alias="answerType")
    applicability_rule_text: Optional[str] = Field(
        default=None, alias="applicabilityRuleText"
    )

    model_config = ConfigDict(populate_by_name=True)


class SuggestedSection(BaseModel):
    """A section suggested by AI, matching TemplateSection fields."""

    section_name: str = Field(alias="sectionName")
    section_order: int = Field(alias="sectionOrder")
    is_repeatable: bool = Field(default=False, alias="isRepeatable")
    repeat_key_name: Optional[str] = Field(default=None, alias="repeatKeyName")
    applicability_rule_text: Optional[str] = Field(
        default=None, alias="applicabilityRuleText"
    )
    questions: list[SuggestedQuestion] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Response / Request
# ---------------------------------------------------------------------------


class AITemplateSuggestionsResponse(BaseModel):
    """Response from the AI suggestion endpoint."""

    sections: list[SuggestedSection]
    document_names: list[str] = Field(alias="documentNames")
    mode: str = Field(description="'generate' or 'improve'")

    model_config = ConfigDict(populate_by_name=True)


class AITemplateBulkAcceptRequest(BaseModel):
    """Request body to accept (some) AI-suggested sections and questions."""

    sections: list[SuggestedSection]

    model_config = ConfigDict(populate_by_name=True)
