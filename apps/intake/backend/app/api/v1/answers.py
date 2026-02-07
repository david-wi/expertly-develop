"""Answer revision and current-answer management routes."""

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.answer import (
    AnswerRevisionCreate,
    AnswerRevisionResponse,
    ChooseCurrentRequest,
    CurrentAnswerResponse,
)
from app.schemas.common import ResponseEnvelope

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/answers/revise
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/answers/revise",
    response_model=ResponseEnvelope[AnswerRevisionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create an answer revision",
)
async def create_answer_revision(
    intakeId: str,
    body: AnswerRevisionCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new answer revision, optionally making it the current answer.

    Also updates the question instance status to 'answered'.
    """
    revisions_col = get_collection("answer_revisions")
    current_answers_col = get_collection("current_answers")
    question_instances_col = get_collection("intake_question_instances")

    # Validate the intake exists
    intakes_col = get_collection("intakes")
    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    # Determine the next revision number for this question instance
    question_instance_id = body.intake_question_instance_id
    last_revision = await revisions_col.find_one(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": question_instance_id,
        },
        sort=[("revisionNumber", -1)],
    )
    next_revision_number = (last_revision["revisionNumber"] + 1) if last_revision else 1

    now = datetime.now(timezone.utc)

    revision_doc = {
        "intakeId": intakeId,
        "intakeQuestionInstanceId": question_instance_id,
        "revisionNumber": next_revision_number,
        "revisionType": body.revision_type.value,
        "answerText": body.answer_text,
        "answerStructuredData": (
            body.answer_structured_data if body.answer_structured_data else None
        ),
        "confidenceScore": body.confidence_score,
        "sourceSessionId": body.source_session_id,
        "sourceEvidenceItemId": body.source_evidence_item_id,
        "isCurrent": body.make_current,
        "createdBy": current_user["userId"],
        "createdAt": now,
    }

    result = await revisions_col.insert_one(revision_doc)
    revision_id = str(result.inserted_id)

    # If makeCurrent, update or create the current_answers document
    if body.make_current:
        # Mark any previously current revision as not current
        await revisions_col.update_many(
            {
                "intakeId": intakeId,
                "intakeQuestionInstanceId": question_instance_id,
                "_id": {"$ne": result.inserted_id},
            },
            {"$set": {"isCurrent": False}},
        )

        await current_answers_col.update_one(
            {
                "intakeId": intakeId,
                "intakeQuestionInstanceId": question_instance_id,
            },
            {
                "$set": {
                    "answerRevisionId": revision_id,
                    "answerText": body.answer_text,
                    "answerStructuredData": body.answer_structured_data,
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

    # Update question instance status to answered
    await question_instances_col.update_one(
        {"_id": ObjectId(question_instance_id)},
        {
            "$set": {
                "status": "answered",
                "lastAnsweredAt": now,
                "currentAnswerRevisionId": revision_id if body.make_current else None,
                "currentAnswer": body.answer_text if body.make_current else None,
                "updatedAt": now,
            },
        },
    )

    response_data = AnswerRevisionResponse(
        answerRevisionId=revision_id,
        intakeQuestionInstanceId=question_instance_id,
        revisionType=body.revision_type,
        answerText=body.answer_text,
        answerStructuredData=body.answer_structured_data,
        confidenceScore=body.confidence_score,
        sourceSessionId=body.source_session_id,
        sourceEvidenceItemId=body.source_evidence_item_id,
        isCurrent=body.make_current,
        createdBy=current_user["userId"],
        createdAt=now,
    )

    return ResponseEnvelope(data=response_data)


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/answers/revisions
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/answers/revisions",
    response_model=ResponseEnvelope[list[AnswerRevisionResponse]],
    summary="List answer revisions for a question",
)
async def list_answer_revisions(
    intakeId: str,
    intakeQuestionInstanceId: str = Query(
        ..., description="Question instance to fetch revisions for"
    ),
    current_user: dict = Depends(get_current_user),
):
    """Return all revisions for a given question instance, sorted by createdAt."""
    revisions_col = get_collection("answer_revisions")

    cursor = revisions_col.find(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": intakeQuestionInstanceId,
        }
    ).sort("createdAt", 1)

    revisions = []
    async for doc in cursor:
        revisions.append(
            AnswerRevisionResponse(
                answerRevisionId=str(doc["_id"]),
                intakeQuestionInstanceId=doc["intakeQuestionInstanceId"],
                revisionType=doc["revisionType"],
                answerText=doc.get("answerText"),
                answerStructuredData=doc.get("answerStructuredData"),
                confidenceScore=doc.get("confidenceScore"),
                sourceSessionId=doc.get("sourceSessionId"),
                sourceEvidenceItemId=doc.get("sourceEvidenceItemId"),
                isCurrent=doc.get("isCurrent", False),
                createdBy=doc.get("createdBy"),
                createdAt=doc["createdAt"],
            )
        )

    return ResponseEnvelope(data=revisions)


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/answers/chooseCurrent
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/answers/chooseCurrent",
    response_model=ResponseEnvelope[CurrentAnswerResponse],
    summary="Choose which revision is the current answer",
)
async def choose_current_answer(
    intakeId: str,
    body: ChooseCurrentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Set a specific revision as the current answer for a question instance."""
    revisions_col = get_collection("answer_revisions")
    current_answers_col = get_collection("current_answers")
    question_instances_col = get_collection("intake_question_instances")

    # Verify the revision exists
    revision = await revisions_col.find_one(
        {"_id": ObjectId(body.answer_revision_id)}
    )
    if not revision:
        raise HTTPException(status_code=404, detail="Answer revision not found")

    if revision["intakeId"] != intakeId:
        raise HTTPException(
            status_code=400, detail="Revision does not belong to this intake"
        )

    now = datetime.now(timezone.utc)
    question_instance_id = body.intake_question_instance_id

    # Mark all revisions for this question as not current
    await revisions_col.update_many(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": question_instance_id,
        },
        {"$set": {"isCurrent": False}},
    )

    # Mark the chosen revision as current
    await revisions_col.update_one(
        {"_id": ObjectId(body.answer_revision_id)},
        {"$set": {"isCurrent": True}},
    )

    # Update or create the current_answers document
    await current_answers_col.update_one(
        {
            "intakeId": intakeId,
            "intakeQuestionInstanceId": question_instance_id,
        },
        {
            "$set": {
                "answerRevisionId": body.answer_revision_id,
                "answerText": revision.get("answerText"),
                "answerStructuredData": revision.get("answerStructuredData"),
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

    # Update the question instance
    await question_instances_col.update_one(
        {"_id": ObjectId(question_instance_id)},
        {
            "$set": {
                "status": "answered",
                "currentAnswerRevisionId": body.answer_revision_id,
                "currentAnswer": revision.get("answerText"),
                "lastAnsweredAt": now,
                "updatedAt": now,
            },
        },
    )

    response_data = CurrentAnswerResponse(
        answerRevisionId=body.answer_revision_id,
        answerText=revision.get("answerText"),
        answerStructuredData=revision.get("answerStructuredData"),
        chosenBy=current_user["userId"],
        chosenAt=now,
    )

    return ResponseEnvelope(data=response_data)
