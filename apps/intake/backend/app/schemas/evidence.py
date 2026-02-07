"""Evidence schemas -- supporting evidence items extracted from sessions."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EvidenceType(str, Enum):
    """Type of evidence extracted from a session."""

    TRANSCRIPT_EXCERPT = "transcriptExcerpt"
    DOCUMENT_EXCERPT = "documentExcerpt"
    URL_CONTENT = "urlContent"
    IMAGE = "image"
    OTHER = "other"


class EvidenceCreate(BaseModel):
    """Create a new evidence item."""

    session_id: str = Field(
        alias="sessionId",
        description="Session from which this evidence was captured",
    )
    evidence_type: EvidenceType = Field(
        alias="evidenceType",
        description="Kind of evidence",
    )
    excerpt_text: Optional[str] = Field(
        default=None,
        alias="excerptText",
        description="Textual excerpt from the source material",
    )
    start_ms: Optional[int] = Field(
        default=None,
        alias="startMs",
        ge=0,
        description="Start position in transcript (milliseconds)",
    )
    end_ms: Optional[int] = Field(
        default=None,
        alias="endMs",
        ge=0,
        description="End position in transcript (milliseconds)",
    )
    file_asset_id: Optional[str] = Field(
        default=None,
        alias="fileAssetId",
        description="Reference to an uploaded file asset",
    )
    url_snapshot_id: Optional[str] = Field(
        default=None,
        alias="urlSnapshotId",
        description="Reference to a URL snapshot",
    )

    model_config = ConfigDict(populate_by_name=True)


class EvidenceResponse(BaseModel):
    """Full evidence item representation."""

    evidence_item_id: str = Field(alias="evidenceItemId")
    intake_id: str = Field(alias="intakeId")
    session_id: str = Field(alias="sessionId")
    evidence_type: EvidenceType = Field(alias="evidenceType")
    excerpt_text: Optional[str] = Field(default=None, alias="excerptText")
    start_ms: Optional[int] = Field(default=None, alias="startMs")
    end_ms: Optional[int] = Field(default=None, alias="endMs")
    file_asset_id: Optional[str] = Field(default=None, alias="fileAssetId")
    url_snapshot_id: Optional[str] = Field(default=None, alias="urlSnapshotId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = ConfigDict(populate_by_name=True)
