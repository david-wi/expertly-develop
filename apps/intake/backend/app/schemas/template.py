"""Template schemas -- versioned question templates for intakes."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AnswerType(str, Enum):
    """Allowed answer types for template questions."""

    SHORT_TEXT = "shortText"
    LONG_TEXT = "longText"
    YES_NO = "yesNo"
    LIST = "list"
    NUMBER = "number"
    DATE = "date"
    URL = "url"
    UPLOAD_REQUESTED = "uploadRequested"


# ---------------------------------------------------------------------------
# Template Version
# ---------------------------------------------------------------------------

class TemplateVersionCreate(BaseModel):
    """Create a new template version."""

    template_name: str = Field(
        alias="templateName",
        min_length=1,
        max_length=300,
        description="Human-readable template name",
    )
    version_label: str = Field(
        alias="versionLabel",
        min_length=1,
        max_length=100,
        description="Version label (e.g. 'v1.0', '2024-Q2 draft')",
    )
    intake_type_id: str = Field(
        alias="intakeTypeId",
        description="Intake type this template version belongs to",
    )

    model_config = ConfigDict(populate_by_name=True)


class TemplateVersionResponse(BaseModel):
    """Full template version representation."""

    template_version_id: str = Field(alias="templateVersionId")
    account_id: str = Field(alias="accountId")
    template_name: str = Field(alias="templateName")
    version_label: str = Field(alias="versionLabel")
    intake_type_id: str = Field(alias="intakeTypeId")
    is_published: bool = Field(default=False, alias="isPublished")
    sections: Optional[list["TemplateSectionResponse"]] = Field(
        default=None,
        description="Nested sections (included when requested via expand parameter)",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Template Section
# ---------------------------------------------------------------------------

class TemplateSectionCreate(BaseModel):
    """Create a new section within a template version."""

    section_name: str = Field(
        alias="sectionName",
        min_length=1,
        max_length=300,
        description="Display name for the section",
    )
    section_order: int = Field(
        alias="sectionOrder",
        ge=0,
        description="Ordering index within the template",
    )
    is_repeatable: bool = Field(
        default=False,
        alias="isRepeatable",
        description="Whether the section can have multiple instances (e.g. per-vehicle)",
    )
    repeat_key_name: Optional[str] = Field(
        default=None,
        alias="repeatKeyName",
        max_length=200,
        description="Label for repeat instances (e.g. 'Vehicle', 'Property')",
    )
    applicability_rule_text: Optional[str] = Field(
        default=None,
        alias="applicabilityRuleText",
        max_length=2000,
        description="Human-readable rule describing when this section applies",
    )

    model_config = ConfigDict(populate_by_name=True)


class TemplateSectionResponse(BaseModel):
    """Full template section representation."""

    template_section_id: str = Field(alias="templateSectionId")
    template_version_id: str = Field(alias="templateVersionId")
    section_name: str = Field(alias="sectionName")
    section_order: int = Field(alias="sectionOrder")
    is_repeatable: bool = Field(alias="isRepeatable")
    repeat_key_name: Optional[str] = Field(default=None, alias="repeatKeyName")
    applicability_rule_text: Optional[str] = Field(
        default=None, alias="applicabilityRuleText"
    )
    questions: Optional[list["TemplateQuestionResponse"]] = Field(
        default=None,
        description="Nested questions (included when requested via expand parameter)",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# Template Question
# ---------------------------------------------------------------------------

class TemplateQuestionCreate(BaseModel):
    """Create a new question within a template section."""

    question_key: str = Field(
        alias="questionKey",
        min_length=1,
        max_length=200,
        description="Stable machine-readable key for this question (e.g. 'insured_name')",
    )
    question_text: str = Field(
        alias="questionText",
        min_length=1,
        max_length=2000,
        description="The question as presented to the user or spoken by the agent",
    )
    question_help_text: Optional[str] = Field(
        default=None,
        alias="questionHelpText",
        max_length=2000,
        description="Additional guidance shown alongside the question",
    )
    question_order: int = Field(
        alias="questionOrder",
        ge=0,
        description="Ordering index within the section",
    )
    is_required: bool = Field(
        default=True,
        alias="isRequired",
        description="Whether an answer is required to mark the section complete",
    )
    answer_type: AnswerType = Field(
        alias="answerType",
        description="Expected answer format",
    )
    applicability_rule_text: Optional[str] = Field(
        default=None,
        alias="applicabilityRuleText",
        max_length=2000,
        description="Human-readable rule describing when this question applies",
    )

    model_config = ConfigDict(populate_by_name=True)


class TemplateQuestionResponse(BaseModel):
    """Full template question representation."""

    template_question_id: str = Field(alias="templateQuestionId")
    template_section_id: str = Field(alias="templateSectionId")
    question_key: str = Field(alias="questionKey")
    question_text: str = Field(alias="questionText")
    question_help_text: Optional[str] = Field(default=None, alias="questionHelpText")
    question_order: int = Field(alias="questionOrder")
    is_required: bool = Field(alias="isRequired")
    answer_type: AnswerType = Field(alias="answerType")
    applicability_rule_text: Optional[str] = Field(
        default=None, alias="applicabilityRuleText"
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
