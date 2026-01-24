"""Task API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_context, CurrentContext
from app.services.task_service import TaskService
from app.services.playbook_service import PlaybookService
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskStart,
    TaskComplete,
    TaskBlock,
    TaskNextResponse,
    TaskContext,
    PlaybookMatch,
    MustConsultWarning,
)

router = APIRouter()


def get_task_service(ctx: CurrentContext = Depends(get_context)) -> TaskService:
    """Get task service with current context."""
    return TaskService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)


@router.get("/next", response_model=Optional[TaskNextResponse])
async def get_next_task(
    assignee: str = Query(default="claude", pattern="^(claude|user)$"),
    ctx: CurrentContext = Depends(get_context),
):
    """
    Get the highest-priority unblocked task for the given assignee.

    This is Claude's primary entry point for getting work.
    Returns task with context and matched playbooks.
    """
    task_service = TaskService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)
    result = await task_service.get_next_task_with_context(assignee=assignee)

    if not result:
        return None

    task, context = result

    # Match playbooks against task description
    playbook_service = PlaybookService(db=ctx.db, tenant_id=ctx.tenant.id, user_id=ctx.user.id)
    task_text = f"{task.title} {task.description or ''}"
    matched_results, must_consult_results = await playbook_service.match_playbooks(task_text)

    # Convert to API schema types
    matched_playbooks = [
        PlaybookMatch(
            id=r.id,
            name=r.name,
            must_consult=r.must_consult,
            match_reason=r.match_reason,
            relevance_score=r.relevance_score,
            content_preview=r.content_preview,
        )
        for r in matched_results
    ]

    must_consult_warnings = [
        MustConsultWarning(
            playbook_name=w.playbook_name,
            playbook_id=w.playbook_id,
            warning=w.warning,
        )
        for w in must_consult_results
    ]

    return TaskNextResponse(
        task=TaskResponse.model_validate(task),
        context=context,
        matched_playbooks=matched_playbooks,
        must_consult_warnings=must_consult_warnings,
    )


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None, pattern="^(claude|user)$"),
    project_id: Optional[UUID] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    service: TaskService = Depends(get_task_service),
):
    """List tasks with optional filters."""
    tasks = await service.list_tasks(
        status=status,
        assignee=assignee,
        project_id=project_id,
        limit=limit,
        offset=offset,
    )
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    service: TaskService = Depends(get_task_service),
):
    """Create a new task."""
    task = await service.create_task(data)
    return TaskResponse.model_validate(task)


@router.post("/claim", response_model=Optional[TaskResponse])
async def claim_next_task(
    worker_id: str = Query(..., description="ID of the worker claiming the task"),
    assignee: str = Query(default="claude", pattern="^(claude|user)$"),
    service: TaskService = Depends(get_task_service),
):
    """
    Atomically claim the next available task for a worker.

    This gets the next task and marks it as working in one operation,
    preventing race conditions when multiple workers are polling.
    Returns None if no tasks are available.
    """
    task = await service.claim_next_task(worker_id=worker_id, assignee=assignee)
    if not task:
        return None
    return TaskResponse.model_validate(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
):
    """Get a task by ID."""
    task = await service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    service: TaskService = Depends(get_task_service),
):
    """Update a task."""
    task = await service.update_task(task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.post("/{task_id}/start", response_model=TaskResponse)
async def start_task(
    task_id: UUID,
    data: Optional[TaskStart] = None,
    service: TaskService = Depends(get_task_service),
):
    """
    Mark a task as working.

    Optionally provide a worker_id to track which bot/agent is working on this task.
    """
    try:
        worker_id = data.worker_id if data else None
        task = await service.start_task(task_id, worker_id=worker_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: UUID,
    data: TaskComplete,
    service: TaskService = Depends(get_task_service),
):
    """Complete a task with output."""
    try:
        task = await service.complete_task(task_id, data)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return TaskResponse.model_validate(task)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/block", response_model=dict)
async def block_task(
    task_id: UUID,
    data: TaskBlock,
    service: TaskService = Depends(get_task_service),
):
    """Block a task with a question."""
    try:
        task, question = await service.block_task(task_id, data)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return {
            "task": TaskResponse.model_validate(task),
            "question": {
                "id": question.id,
                "text": question.text,
                "status": question.status,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    service: TaskService = Depends(get_task_service),
):
    """Cancel/delete a task."""
    success = await service.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or already completed/cancelled")
