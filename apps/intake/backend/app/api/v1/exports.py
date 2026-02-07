"""Export job management routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.export import ExportRequest, ExportResponse, ExportStatus
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/export
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/export",
    response_model=ResponseEnvelope[ExportResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create an export job",
)
async def create_export(
    intakeId: str,
    body: ExportRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create an export job for an intake.

    Placeholder implementation: stores the request and returns a job ID.
    Actual export generation would be handled by a background worker.
    """
    intakes_col = get_collection("intakes")
    exports_col = get_collection("exports")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)

    export_doc = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "format": body.format.value,
        "includeEvidence": body.include_evidence,
        "status": ExportStatus.QUEUED.value,
        "downloadUrl": None,
        "fileSizeBytes": None,
        "errorMessage": None,
        "requestedBy": current_user["userId"],
        "requestedAt": now,
        "completedAt": None,
    }

    result = await exports_col.insert_one(export_doc)
    export_id = str(result.inserted_id)

    return ResponseEnvelope(
        data=ExportResponse(
            exportId=export_id,
            intakeId=intakeId,
            accountId=current_user["accountId"],
            format=body.format,
            includeEvidence=body.include_evidence,
            status=ExportStatus.QUEUED,
            downloadUrl=None,
            fileSizeBytes=None,
            errorMessage=None,
            requestedAt=now,
            completedAt=None,
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/export/{exportId}
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/export/{exportId}",
    response_model=ResponseEnvelope[ExportResponse],
    summary="Get export job status",
)
async def get_export_status(
    intakeId: str,
    exportId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return the status and download URL for an export job."""
    exports_col = get_collection("exports")

    export_doc = await exports_col.find_one(
        {"_id": ObjectId(exportId), "intakeId": intakeId}
    )
    if not export_doc:
        raise HTTPException(status_code=404, detail="Export not found")

    return ResponseEnvelope(
        data=ExportResponse(
            exportId=str(export_doc["_id"]),
            intakeId=export_doc["intakeId"],
            accountId=export_doc["accountId"],
            format=export_doc["format"],
            includeEvidence=export_doc["includeEvidence"],
            status=export_doc["status"],
            downloadUrl=export_doc.get("downloadUrl"),
            fileSizeBytes=export_doc.get("fileSizeBytes"),
            errorMessage=export_doc.get("errorMessage"),
            requestedAt=export_doc["requestedAt"],
            completedAt=export_doc.get("completedAt"),
        )
    )
