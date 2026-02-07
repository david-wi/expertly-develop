"""URL source and snapshot schemas -- monitored URLs for data extraction."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RefreshPolicy(str, Enum):
    """How often the URL should be re-fetched."""

    MANUAL = "manual"
    DAILY = "daily"
    WEEKLY = "weekly"


class UrlFetchStatus(str, Enum):
    """Status of the most recent URL fetch."""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# URL Source
# ---------------------------------------------------------------------------

class UrlSourceCreate(BaseModel):
    """Register a URL to monitor for data extraction."""

    url: str = Field(
        min_length=1,
        max_length=2000,
        description="Full URL to monitor",
    )
    label: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Human-readable label for this URL source",
    )
    refresh_policy: RefreshPolicy = Field(
        default=RefreshPolicy.MANUAL,
        alias="refreshPolicy",
        description="How often the URL should be re-fetched",
    )

    model_config = ConfigDict(populate_by_name=True)


class UrlSourceResponse(BaseModel):
    """Full URL source representation."""

    url_source_id: str = Field(alias="urlSourceId")
    intake_id: str = Field(alias="intakeId")
    account_id: str = Field(alias="accountId")
    url: str
    label: Optional[str] = None
    refresh_policy: RefreshPolicy = Field(alias="refreshPolicy")
    is_active: bool = Field(default=True, alias="isActive")
    last_fetched_at: Optional[datetime] = Field(
        default=None,
        alias="lastFetchedAt",
        description="Timestamp of the most recent fetch",
    )
    last_fetch_status: Optional[UrlFetchStatus] = Field(
        default=None,
        alias="lastFetchStatus",
    )
    last_diff_summary: Optional[str] = Field(
        default=None,
        alias="lastDiffSummary",
        description="Human-readable summary of changes since the prior fetch",
    )
    snapshot_count: int = Field(
        default=0,
        alias="snapshotCount",
        description="Total number of snapshots stored",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# URL Snapshot
# ---------------------------------------------------------------------------

class UrlSnapshotResponse(BaseModel):
    """A point-in-time snapshot of a URL's content."""

    url_snapshot_id: str = Field(alias="urlSnapshotId")
    url_source_id: str = Field(alias="urlSourceId")
    fetched_at: datetime = Field(alias="fetchedAt")
    fetch_status: UrlFetchStatus = Field(alias="fetchStatus")
    http_status_code: Optional[int] = Field(
        default=None,
        alias="httpStatusCode",
    )
    content_hash: Optional[str] = Field(
        default=None,
        alias="contentHash",
        description="SHA-256 hash of the fetched content",
    )
    diff_summary: Optional[str] = Field(
        default=None,
        alias="diffSummary",
        description="Summary of changes from the previous snapshot",
    )
    extracted_text_preview: Optional[str] = Field(
        default=None,
        alias="extractedTextPreview",
        description="First portion of extracted text content",
    )
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)
