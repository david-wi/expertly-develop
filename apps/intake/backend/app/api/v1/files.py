"""File asset management routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.file import (
    FileAssetResponse,
    FileListResponse,
    FileProcessingStatus,
    FileUploadRequest,
    FileUploadResponse,
)
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/files
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/files",
    response_model=ResponseEnvelope[FileUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a file asset record",
)
async def create_file_asset(
    intakeId: str,
    body: FileUploadRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a file asset record and return a fileAssetId.

    The upload URL is a placeholder for now.
    """
    intakes_col = get_collection("intakes")
    files_col = get_collection("file_assets")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)

    file_doc = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "sessionId": None,
        "fileName": body.file_name,
        "fileType": body.file_type,
        "fileSizeBytes": body.file_size_bytes,
        "storagePath": None,
        "processingStatus": FileProcessingStatus.PENDING.value,
        "pageCount": None,
        "uploadedBy": current_user["userId"],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await files_col.insert_one(file_doc)
    file_asset_id = str(result.inserted_id)

    # Placeholder upload URL
    upload_url = f"/api/v1/intakes/{intakeId}/files/{file_asset_id}/upload"

    return ResponseEnvelope(
        data=FileUploadResponse(
            fileAssetId=file_asset_id,
            uploadUrl=upload_url,
            fileName=body.file_name,
            fileType=body.file_type,
            fileSizeBytes=body.file_size_bytes,
            processingStatus=FileProcessingStatus.PENDING,
            createdAt=now,
        )
    )


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/files/{fileAssetId}/process
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/files/{fileAssetId}/process",
    response_model=ResponseEnvelope[FileAssetResponse],
    summary="Kick off text extraction for a file",
)
async def process_file(
    intakeId: str,
    fileAssetId: str,
    current_user: dict = Depends(get_current_user),
):
    """Kick off text extraction for a file asset.

    Placeholder implementation: marks the file as processing, stores a
    placeholder extracted text, and creates proposal stubs.
    """
    files_col = get_collection("file_assets")
    proposals_col = get_collection("proposals")
    usage_col = get_collection("usage_ledger")

    file_doc = await files_col.find_one(
        {"_id": ObjectId(fileAssetId), "intakeId": intakeId}
    )
    if not file_doc:
        raise HTTPException(status_code=404, detail="File asset not found")

    if file_doc["processingStatus"] == FileProcessingStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="File already processed")

    now = datetime.now(timezone.utc)

    # Placeholder: simulate text extraction
    extracted_text = f"[Placeholder] Extracted text from {file_doc['fileName']}"
    page_count = 1  # Placeholder

    await files_col.update_one(
        {"_id": ObjectId(fileAssetId)},
        {
            "$set": {
                "processingStatus": FileProcessingStatus.COMPLETED.value,
                "extractedText": extracted_text,
                "pageCount": page_count,
                "updatedAt": now,
            }
        },
    )

    # Create usage ledger entry for OCR pages
    await usage_col.insert_one(
        {
            "intakeId": intakeId,
            "accountId": file_doc["accountId"],
            "fileAssetId": fileAssetId,
            "metricType": "ocrPages",
            "quantity": page_count,
            "createdAt": now,
        }
    )

    updated = await files_col.find_one({"_id": ObjectId(fileAssetId)})

    return ResponseEnvelope(
        data=FileAssetResponse(
            fileAssetId=str(updated["_id"]),
            intakeId=updated["intakeId"],
            accountId=updated["accountId"],
            sessionId=updated.get("sessionId"),
            fileName=updated["fileName"],
            fileType=updated["fileType"],
            fileSizeBytes=updated["fileSizeBytes"],
            storagePath=updated.get("storagePath"),
            processingStatus=updated["processingStatus"],
            pageCount=updated.get("pageCount"),
            downloadUrl=None,
            createdAt=updated["createdAt"],
            updatedAt=updated["updatedAt"],
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/files
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/files",
    response_model=ResponseEnvelope[FileListResponse],
    summary="List file assets and processing status",
)
async def list_files(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all file assets for an intake."""
    files_col = get_collection("file_assets")

    cursor = files_col.find({"intakeId": intakeId}).sort("createdAt", -1)

    files = []
    async for doc in cursor:
        files.append(
            FileAssetResponse(
                fileAssetId=str(doc["_id"]),
                intakeId=doc["intakeId"],
                accountId=doc["accountId"],
                sessionId=doc.get("sessionId"),
                fileName=doc["fileName"],
                fileType=doc["fileType"],
                fileSizeBytes=doc["fileSizeBytes"],
                storagePath=doc.get("storagePath"),
                processingStatus=doc["processingStatus"],
                pageCount=doc.get("pageCount"),
                downloadUrl=None,
                createdAt=doc["createdAt"],
                updatedAt=doc["updatedAt"],
            )
        )

    total = await files_col.count_documents({"intakeId": intakeId})

    return ResponseEnvelope(
        data=FileListResponse(files=files, totalCount=total)
    )
