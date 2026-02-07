"""Intake type schemas -- defines a category/kind of intake."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class IntakeTypeCreate(BaseModel):
    """Create a new intake type."""

    intake_type_name: str = Field(
        alias="intakeTypeName",
        min_length=1,
        max_length=300,
        description="Display name for this intake type",
    )
    description: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Longer description of what this intake type covers",
    )
    default_template_version_id: Optional[str] = Field(
        default=None,
        alias="defaultTemplateVersionId",
        description="Template version to use by default when creating intakes of this type",
    )
    default_voice_profile_id: Optional[str] = Field(
        default=None,
        alias="defaultVoiceProfileId",
        description="Voice profile to use by default for phone calls",
    )
    defaults_recording_enabled: bool = Field(
        default=True,
        alias="defaultsRecordingEnabled",
        description="Whether call recording is enabled by default",
    )
    defaults_transcription_enabled: bool = Field(
        default=True,
        alias="defaultsTranscriptionEnabled",
        description="Whether automatic transcription is enabled by default",
    )
    defaults_continue_recording_after_transfer: bool = Field(
        default=False,
        alias="defaultsContinueRecordingAfterTransfer",
        description="Whether to keep recording after a call transfer",
    )

    model_config = ConfigDict(populate_by_name=True)


class IntakeTypeUpdate(BaseModel):
    """Partial update for an intake type."""

    intake_type_name: Optional[str] = Field(
        default=None,
        alias="intakeTypeName",
        min_length=1,
        max_length=300,
    )
    description: Optional[str] = Field(default=None, max_length=2000)
    default_template_version_id: Optional[str] = Field(
        default=None, alias="defaultTemplateVersionId"
    )
    default_voice_profile_id: Optional[str] = Field(
        default=None, alias="defaultVoiceProfileId"
    )
    defaults_recording_enabled: Optional[bool] = Field(
        default=None, alias="defaultsRecordingEnabled"
    )
    defaults_transcription_enabled: Optional[bool] = Field(
        default=None, alias="defaultsTranscriptionEnabled"
    )
    defaults_continue_recording_after_transfer: Optional[bool] = Field(
        default=None, alias="defaultsContinueRecordingAfterTransfer"
    )

    model_config = ConfigDict(populate_by_name=True)


class IntakeTypeResponse(BaseModel):
    """Full intake type representation."""

    intake_type_id: str = Field(alias="intakeTypeId")
    account_id: str = Field(alias="accountId")
    intake_type_name: str = Field(alias="intakeTypeName")
    description: Optional[str] = None
    default_template_version_id: Optional[str] = Field(
        default=None, alias="defaultTemplateVersionId"
    )
    default_voice_profile_id: Optional[str] = Field(
        default=None, alias="defaultVoiceProfileId"
    )
    defaults_recording_enabled: bool = Field(alias="defaultsRecordingEnabled")
    defaults_transcription_enabled: bool = Field(alias="defaultsTranscriptionEnabled")
    defaults_continue_recording_after_transfer: bool = Field(
        alias="defaultsContinueRecordingAfterTransfer"
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
