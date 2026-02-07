"""Answer proposal review routes."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.proposal import ProposalRejectRequest, ProposalResponse, ProposalStatus
from app.schemas.common import ResponseEnvelope

router = APIRouter()


def _doc_to_response(doc: dict) -> ProposalResponse:
    """Convert a MongoDB proposal document to a response model."""
    return ProposalResponse(
        proposalId=str(doc["_id"]),
        intakeId=doc["intakeId"],
        intakeQuestionInstanceId=doc["intakeQuestionInstanceId"],
        answerRevisionId=doc["answerRevisionId"],
        questionText=doc.get("questionText", ""),
        questionKey=doc.get("questionKey", ""),
        sectionName=doc.get("sectionName", ""),
        answerText=doc.get("answerText"),
        answerStructuredData=doc.get("answerStructuredData"),
        confidenceScore=doc.get("confidenceScore"),
        sourceSessionId=doc.get("sourceSessionId"),
        sourceEvidenceItemId=doc.get("sourceEvidenceItemId"),
        evidenceExcerpt=doc.get("evidenceExcerpt"),
        status=doc["status"],
        reviewedAt=doc.get("reviewedAt"),
        reviewedBy=doc.get("reviewedBy"),
        rejectionReason=doc.get("rejectionReason"),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/proposals
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/proposals",
    response_model=ResponseEnvelope[list[ProposalResponse]],
    summary="List pending proposals",
)
async def list_proposals(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all pending proposals for an intake."""
    proposals_col = get_collection("proposals")

    cursor = proposals_col.find(
        {"intakeId": intakeId, "status": ProposalStatus.PENDING.value}
    ).sort("createdAt", -1)

    items = []
    async for doc in cursor:
        items.append(_doc_to_response(doc))

    return ResponseEnvelope(data=items)


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/proposals/{proposalId}/accept
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/proposals/{proposalId}/accept",
    response_model=ResponseEnvelope[ProposalResponse],
    summary="Accept a proposal",
)
async def accept_proposal(
    intakeId: str,
    proposalId: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept a proposal: create an answer revision from it, set as current,
    and mark the proposal as accepted.
    """
    proposals_col = get_collection("proposals")
    revisions_col = get_collection("answer_revisions")
    current_answers_col = get_collection("current_answers")
    question_instances_col = get_collection("intake_question_instances")

    proposal = await proposals_col.find_one(
        {"_id": ObjectId(proposalId), "intakeId": intakeId}
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal["status"] != ProposalStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Proposal is already {proposal['status']}",
        )

    now = datetime.now(timezone.utc)
    question_instance_id = proposal["intakeQuestionInstanceId"]

    # Determine next revision number
    last_revision = await revisions_col.find_one(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": question_instance_id,
        },
        sort=[("revisionNumber", -1)],
    )
    next_revision_number = (
        (last_revision["revisionNumber"] + 1) if last_revision else 1
    )

    # Create answer revision from proposal
    revision_doc = {
        "intakeId": intakeId,
        "intakeQuestionInstanceId": question_instance_id,
        "revisionNumber": next_revision_number,
        "revisionType": "confirmed",
        "answerText": proposal.get("answerText"),
        "answerStructuredData": proposal.get("answerStructuredData"),
        "confidenceScore": proposal.get("confidenceScore"),
        "sourceSessionId": proposal.get("sourceSessionId"),
        "sourceEvidenceItemId": proposal.get("sourceEvidenceItemId"),
        "isCurrent": True,
        "createdBy": current_user["userId"],
        "createdAt": now,
    }

    revision_result = await revisions_col.insert_one(revision_doc)
    revision_id = str(revision_result.inserted_id)

    # Mark all other revisions for this question as not current
    await revisions_col.update_many(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": question_instance_id,
            "_id": {"$ne": revision_result.inserted_id},
        },
        {"$set": {"isCurrent": False}},
    )

    # Update or create current_answers
    await current_answers_col.update_one(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": question_instance_id,
        },
        {
            "$set": {
                "answerRevisionId": revision_id,
                "answerText": proposal.get("answerText"),
                "answerStructuredData": proposal.get("answerStructuredData"),
                "chosenBy": current_user["userId"],
                "chosenAt": now,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "intakeId": intakeId,
                "intakeQuestionInstanceId": question_instance_id,
                "createdAt": now,
            },
        },
        upsert=True,
    )

    # Update question instance status
    await question_instances_col.update_one(
        {"_id": ObjectId(question_instance_id)},
        {
            "$set": {
                "status": "answered",
                "currentAnswerRevisionId": revision_id,
                "currentAnswer": proposal.get("answerText"),
                "lastAnsweredAt": now,
                "updatedAt": now,
            },
        },
    )

    # Mark proposal accepted
    await proposals_col.update_one(
        {"_id": ObjectId(proposalId)},
        {
            "$set": {
                "status": ProposalStatus.ACCEPTED.value,
                "answerRevisionId": revision_id,
                "reviewedBy": current_user["userId"],
                "reviewedAt": now,
                "updatedAt": now,
            }
        },
    )

    updated = await proposals_col.find_one({"_id": ObjectId(proposalId)})
    return ResponseEnvelope(data=_doc_to_response(updated))


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/proposals/{proposalId}/reject
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/proposals/{proposalId}/reject",
    response_model=ResponseEnvelope[ProposalResponse],
    summary="Reject a proposal",
)
async def reject_proposal(
    intakeId: str,
    proposalId: str,
    body: ProposalRejectRequest,
    current_user: dict = Depends(get_current_user),
):
    """Reject a proposal with an optional reason."""
    proposals_col = get_collection("proposals")

    proposal = await proposals_col.find_one(
        {"_id": ObjectId(proposalId), "intakeId": intakeId}
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if proposal["status"] != ProposalStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Proposal is already {proposal['status']}",
        )

    now = datetime.now(timezone.utc)

    await proposals_col.update_one(
        {"_id": ObjectId(proposalId)},
        {
            "$set": {
                "status": ProposalStatus.REJECTED.value,
                "rejectionReason": body.reason,
                "reviewedBy": current_user["userId"],
                "reviewedAt": now,
                "updatedAt": now,
            }
        },
    )

    updated = await proposals_col.find_one({"_id": ObjectId(proposalId)})
    return ResponseEnvelope(data=_doc_to_response(updated))
