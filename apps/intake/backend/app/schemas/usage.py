"""Usage and metering schemas."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UsageRollup(BaseModel):
    """Aggregated usage counters for a single intake or account."""

    call_seconds: int = Field(
        default=0,
        alias="callSeconds",
        description="Total seconds of phone call time",
    )
    transcription_seconds: int = Field(
        default=0,
        alias="transcriptionSeconds",
        description="Total seconds of audio transcribed",
    )
    ocr_pages: int = Field(
        default=0,
        alias="ocrPages",
        description="Total pages processed via OCR",
    )
    url_refresh_count: int = Field(
        default=0,
        alias="urlRefreshCount",
        description="Total URL refreshes performed",
    )

    model_config = ConfigDict(populate_by_name=True)


class UsageResponse(BaseModel):
    """Usage for a single intake."""

    intake_id: str = Field(alias="intakeId")
    usage: UsageRollup
    period_start: Optional[datetime] = Field(default=None, alias="periodStart")
    period_end: Optional[datetime] = Field(default=None, alias="periodEnd")

    model_config = ConfigDict(populate_by_name=True)


class UsageReportResponse(BaseModel):
    """Account-level usage report with date range."""

    account_id: str = Field(alias="accountId")
    date_range_start: date = Field(alias="dateRangeStart")
    date_range_end: date = Field(alias="dateRangeEnd")
    total_usage: UsageRollup = Field(alias="totalUsage")
    per_intake: Optional[list[UsageResponse]] = Field(
        default=None,
        alias="perIntake",
        description="Breakdown by intake (included when requested)",
    )
    generated_at: datetime = Field(alias="generatedAt")

    model_config = ConfigDict(populate_by_name=True)
