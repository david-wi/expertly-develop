"""Question API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_context, CurrentContext
from app.services.question_service import QuestionService
from app.schemas.question import (
    QuestionCreate,
    QuestionResponse,
    QuestionAnswer,
    QuestionDismiss,
    QuestionWithUnblockedTasks,
)

router = APIRouter()


def get_question_service(ctx: CurrentContext = Depends(get_context)) -> QuestionService:
    """Get question service with current context."""
    return QuestionService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)


@router.get("", response_model=List[QuestionResponse])
async def list_questions(
    status: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: QuestionService = Depends(get_question_service),
):
    """List questions with optional filters."""
    questions = await service.list_questions(status=status, limit=limit, offset=offset)
    return [QuestionResponse.model_validate(q) for q in questions]


@router.get("/unanswered", response_model=List[QuestionResponse])
async def get_unanswered_questions(
    limit: int = Query(default=50, ge=1, le=100),
    service: QuestionService = Depends(get_question_service),
):
    """Get unanswered questions prioritized by importance."""
    questions = await service.get_unanswered_questions(limit=limit)
    return [QuestionResponse.model_validate(q) for q in questions]


@router.post("", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    data: QuestionCreate,
    service: QuestionService = Depends(get_question_service),
):
    """Create a new question."""
    question = await service.create_question(data)
    return QuestionResponse.model_validate(question)


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: UUID,
    service: QuestionService = Depends(get_question_service),
):
    """Get a question by ID."""
    question = await service.get_question(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return QuestionResponse.model_validate(question)


@router.put("/{question_id}/answer", response_model=QuestionWithUnblockedTasks)
async def answer_question(
    question_id: UUID,
    data: QuestionAnswer,
    service: QuestionService = Depends(get_question_service),
):
    """
    Answer a question.

    This will automatically unblock any tasks that were blocked by this question.
    """
    try:
        question, unblocked_task_ids = await service.answer_question(question_id, data)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        response = QuestionWithUnblockedTasks.model_validate(question)
        response.unblocked_task_ids = unblocked_task_ids
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{question_id}/dismiss", response_model=QuestionResponse)
async def dismiss_question(
    question_id: UUID,
    data: QuestionDismiss,
    service: QuestionService = Depends(get_question_service),
):
    """Dismiss a question without answering."""
    try:
        question = await service.dismiss_question(question_id, data.reason)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        return QuestionResponse.model_validate(question)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
