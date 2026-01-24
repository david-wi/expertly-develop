"""Knowledge API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_context, CurrentContext
from app.services.knowledge_service import KnowledgeService
from app.schemas.knowledge import (
    KnowledgeCapture,
    KnowledgeResponse,
    KnowledgeCaptureResponse,
    KnowledgeDismiss,
    TriggerPhrasesResponse,
)

router = APIRouter()


def get_knowledge_service(ctx: CurrentContext = Depends(get_context)) -> KnowledgeService:
    """Get knowledge service with current context."""
    return KnowledgeService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)


@router.post("/capture", response_model=KnowledgeCaptureResponse, status_code=status.HTTP_201_CREATED)
async def capture_knowledge(
    data: KnowledgeCapture,
    service: KnowledgeService = Depends(get_knowledge_service),
):
    """
    Capture a learning and route it to the appropriate entity.

    This is the MANDATORY knowledge capture endpoint called after every task.

    Categories:
    - playbook: How to do something → creates proposed playbook
    - person: Info about someone → updates person's context_notes
    - client: Info about a client → updates client's notes
    - project: Info about a project → updates project description
    - setting: URL, tool, preference → marked for user settings review
    - rule: Company rule/term → adds to Company Rules playbook
    """
    knowledge, routing_result = await service.capture(data)

    return KnowledgeCaptureResponse(
        knowledge=KnowledgeResponse.model_validate(knowledge),
        routed_to=routing_result,
    )


@router.get("", response_model=List[KnowledgeResponse])
async def list_knowledge(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: KnowledgeService = Depends(get_knowledge_service),
):
    """List captured knowledge entries."""
    entries = await service.list_knowledge(
        status=status,
        category=category,
        limit=limit,
        offset=offset,
    )
    return [KnowledgeResponse.model_validate(k) for k in entries]


@router.get("/pending", response_model=List[KnowledgeResponse])
async def get_pending_knowledge(
    limit: int = Query(default=50, ge=1, le=100),
    service: KnowledgeService = Depends(get_knowledge_service),
):
    """Get knowledge entries pending review/routing."""
    entries = await service.get_pending(limit=limit)
    return [KnowledgeResponse.model_validate(k) for k in entries]


@router.get("/triggers", response_model=TriggerPhrasesResponse)
async def get_trigger_phrases(
    service: KnowledgeService = Depends(get_knowledge_service),
):
    """
    Get list of trigger phrases that should force knowledge capture.

    When Claude detects any of these phrases in user input,
    it MUST capture the knowledge.
    """
    return TriggerPhrasesResponse(phrases=service.get_trigger_phrases())


@router.post("/{knowledge_id}/dismiss", response_model=KnowledgeResponse)
async def dismiss_knowledge(
    knowledge_id: UUID,
    data: KnowledgeDismiss,
    service: KnowledgeService = Depends(get_knowledge_service),
):
    """Dismiss a knowledge entry if not worth keeping."""
    knowledge = await service.dismiss(knowledge_id, data.reason)
    if not knowledge:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    return KnowledgeResponse.model_validate(knowledge)
