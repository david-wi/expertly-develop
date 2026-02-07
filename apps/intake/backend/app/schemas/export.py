"""Export schemas -- generating downloadable reports from intakes."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ExportFormat(str, Enum):
    """Supported export file formats."""

    DOCX = "docx"
    PDF = "pdf"
    JSON = "json"


class ExportStatus(str, Enum):
    """Lifecycle status of an export job."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ExportRequest(BaseModel):
    """Request to generate an export of the intake."""

    format: ExportFormat = Field(
        description="Desired output format",
    )
    include_evidence: bool = Field(
        default=False,
        alias="includeEvidence",
        description="Whether to include supporting evidence excerpts in the export",
    )

    model_config = ConfigDict(populate_by_name=True)


class ExportResponse(BaseModel):
    """Status and download link for an export."""

    export_id: str = Field(alias="exportId")
    intake_id: str = Field(alias="intakeId")
    account_id: str = Field(alias="accountId")
    format: ExportFormat
    include_evidence: bool = Field(alias="includeEvidence")
    status: ExportStatus
    download_url: Optional[str] = Field(
        default=None,
        alias="downloadUrl",
        description="Pre-signed URL to download the export (available when status is completed)",
    )
    file_size_bytes: Optional[int] = Field(
        default=None,
        alias="fileSizeBytes",
        description="Size of the exported file in bytes",
    )
    error_message: Optional[str] = Field(
        default=None,
        alias="errorMessage",
        description="Error details if the export failed",
    )
    requested_at: datetime = Field(alias="requestedAt")
    completed_at: Optional[datetime] = Field(default=None, alias="completedAt")

    model_config = ConfigDict(populate_by_name=True)
