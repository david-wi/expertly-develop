"""File asset schemas -- uploaded documents and images."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FileProcessingStatus(str, Enum):
    """Status of file processing (OCR, parsing, etc.)."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FileUploadRequest(BaseModel):
    """Request a pre-signed upload URL for a file."""

    file_name: str = Field(
        alias="fileName",
        min_length=1,
        max_length=500,
        description="Original file name",
    )
    file_type: str = Field(
        alias="fileType",
        min_length=1,
        max_length=200,
        description="MIME type of the file (e.g. 'application/pdf')",
    )
    file_size_bytes: int = Field(
        alias="fileSizeBytes",
        gt=0,
        description="Size of the file in bytes",
    )

    model_config = ConfigDict(populate_by_name=True)


class FileUploadResponse(BaseModel):
    """Response with pre-signed upload URL and asset metadata."""

    file_asset_id: str = Field(alias="fileAssetId")
    upload_url: str = Field(
        alias="uploadUrl",
        description="Pre-signed URL to upload the file via PUT",
    )
    file_name: str = Field(alias="fileName")
    file_type: str = Field(alias="fileType")
    file_size_bytes: int = Field(alias="fileSizeBytes")
    processing_status: FileProcessingStatus = Field(alias="processingStatus")
    created_at: datetime = Field(alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class FileAssetResponse(BaseModel):
    """Full file asset representation."""

    file_asset_id: str = Field(alias="fileAssetId")
    intake_id: str = Field(alias="intakeId")
    account_id: str = Field(alias="accountId")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    file_name: str = Field(alias="fileName")
    file_type: str = Field(alias="fileType")
    file_size_bytes: int = Field(alias="fileSizeBytes")
    storage_path: Optional[str] = Field(
        default=None,
        alias="storagePath",
        description="Internal storage path (not exposed to clients in most contexts)",
    )
    processing_status: FileProcessingStatus = Field(alias="processingStatus")
    page_count: Optional[int] = Field(
        default=None,
        alias="pageCount",
        description="Number of pages (for documents)",
    )
    download_url: Optional[str] = Field(
        default=None,
        alias="downloadUrl",
        description="Pre-signed download URL (generated on request)",
    )
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)


class FileListResponse(BaseModel):
    """List of file assets."""

    files: list[FileAssetResponse] = Field(description="List of file assets")
    total_count: int = Field(alias="totalCount")

    model_config = ConfigDict(populate_by_name=True)
