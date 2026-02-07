"""Evidence item routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.evidence import EvidenceCreate, EvidenceResponse
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/evidence
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/evidence",
    response_model=ResponseEnvelope[EvidenceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create an evidence item",
)
async def create_evidence(
    intakeId: str,
    body: EvidenceCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new evidence item linked to an intake."""
    intakes_col = get_collection("intakes")
    evidence_col = get_collection("evidence_items")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)

    evidence_doc = {
        "intakeId": intakeId,
        "sessionId": body.session_id,
        "evidenceType": body.evidence_type.value,
        "excerptText": body.excerpt_text,
        "startMs": body.start_ms,
        "endMs": body.end_ms,
        "fileAssetId": body.file_asset_id,
        "urlSnapshotId": body.url_snapshot_id,
        "createdBy": current_user["userId"],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await evidence_col.insert_one(evidence_doc)

    return ResponseEnvelope(
        data=EvidenceResponse(
            evidenceItemId=str(result.inserted_id),
            intakeId=intakeId,
            sessionId=body.session_id,
            evidenceType=body.evidence_type,
            excerptText=body.excerpt_text,
            startMs=body.start_ms,
            endMs=body.end_ms,
            fileAssetId=body.file_asset_id,
            urlSnapshotId=body.url_snapshot_id,
            createdAt=now,
            updatedAt=now,
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/evidence
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/evidence",
    response_model=ResponseEnvelope[list[EvidenceResponse]],
    summary="List evidence items for an intake",
)
async def list_evidence(
    intakeId: str,
    sessionId: Optional[str] = Query(default=None, description="Filter by session"),
    questionInstanceId: Optional[str] = Query(
        default=None, description="Filter by question instance"
    ),
    current_user: dict = Depends(get_current_user),
):
    """List evidence items, optionally filtered by session or question instance."""
    evidence_col = get_collection("evidence_items")

    query: dict = {"intakeId": intakeId}
    if sessionId:
        query["sessionId"] = sessionId
    if questionInstanceId:
        # Evidence linked via source_evidence_item_id in answer revisions,
        # or directly via a questionInstanceId field if present.
        query["$or"] = [
            {"intakeQuestionInstanceId": questionInstanceId},
            {"questionInstanceId": questionInstanceId},
        ]

    cursor = evidence_col.find(query).sort("createdAt", -1)

    items = []
    async for doc in cursor:
        items.append(
            EvidenceResponse(
                evidenceItemId=str(doc["_id"]),
                intakeId=doc["intakeId"],
                sessionId=doc.get("sessionId"),
                evidenceType=doc["evidenceType"],
                excerptText=doc.get("excerptText"),
                startMs=doc.get("startMs"),
                endMs=doc.get("endMs"),
                fileAssetId=doc.get("fileAssetId"),
                urlSnapshotId=doc.get("urlSnapshotId"),
                createdAt=doc["createdAt"],
                updatedAt=doc["updatedAt"],
            )
        )

    return ResponseEnvelope(data=items)
