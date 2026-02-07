"""Voice profile schemas for VAPI voice configuration."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class VoiceProfileCreate(BaseModel):
    """Create a new voice profile."""

    voice_profile_name: str = Field(
        alias="voiceProfileName",
        min_length=1,
        max_length=200,
        description="Human-readable name for the voice profile",
    )
    vapi_voice_id: str = Field(
        alias="vapiVoiceId",
        description="Identifier of the voice in the VAPI provider",
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Internal notes about the profile",
    )
    is_enabled: bool = Field(
        default=True,
        alias="isEnabled",
        description="Whether this profile is available for use",
    )

    model_config = ConfigDict(populate_by_name=True)


class VoiceProfileUpdate(BaseModel):
    """Partial update for a voice profile."""

    voice_profile_name: Optional[str] = Field(
        default=None,
        alias="voiceProfileName",
        min_length=1,
        max_length=200,
    )
    vapi_voice_id: Optional[str] = Field(default=None, alias="vapiVoiceId")
    notes: Optional[str] = Field(default=None, max_length=2000)
    is_enabled: Optional[bool] = Field(default=None, alias="isEnabled")

    model_config = ConfigDict(populate_by_name=True)


class VoiceProfileResponse(BaseModel):
    """Full voice profile representation."""

    voice_profile_id: str = Field(alias="voiceProfileId")
    account_id: str = Field(alias="accountId")
    voice_profile_name: str = Field(alias="voiceProfileName")
    vapi_voice_id: str = Field(alias="vapiVoiceId")
    notes: Optional[str] = None
    is_enabled: bool = Field(alias="isEnabled")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
