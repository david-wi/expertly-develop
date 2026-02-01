from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import (
    Task, TaskCreate, TaskUpdate, TaskStatus, TaskPhase, VALID_PHASE_TRANSITIONS,
    TaskComplete, TaskFail,
    TaskProgressUpdate, TaskProgressUpdateCreate,
    TaskStepResponse, StepStatus,
    User
)
from app.api.deps import get_current_user

router = APIRouter()


def serialize_task(task: dict) -> dict:
    """Convert ObjectIds to strings in task document."""
    result = {**task, "_id": str(task["_id"])}

    for field in ["organization_id", "queue_id", "assigned_to_id", "checked_out_by_id",
                  "parent_task_id", "project_id", "sop_id", "approver_id", "approver_queue_id",
                  "reviewer_id"]:
        if task.get(field):
            result[field] = str(task[field])

    return result


@router.get("")
async def list_tasks(
    queue_id: str | None = None,
    status: str | None = None,
    phase: str | None = None,
    assigned_to_me: bool = False,
    project_id: str | None = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List tasks."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}

    if queue_id:
        if not ObjectId.is_valid(queue_id):
            raise HTTPException(status_code=400, detail="Invalid queue ID")
        query["queue_id"] = ObjectId(queue_id)

    if status:
        query["status"] = status

    if phase:
        query["phase"] = phase

    if assigned_to_me:
        query["assigned_to_id"] = current_user.id

    if project_id:
        if not ObjectId.is_valid(project_id):
            raise HTTPException(status_code=400, detail="Invalid project ID")
        query["project_id"] = ObjectId(project_id)

    cursor = db.tasks.find(query).sort([("priority", 1), ("created_at", 1)]).limit(limit)
    tasks = await cursor.to_list(limit)

    return [serialize_task(t) for t in tasks]


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return serialize_task(task)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new task."""
    db = get_database()

    if not ObjectId.is_valid(data.queue_id):
        raise HTTPException(status_code=400, detail="Invalid queue ID")

    # Verify queue exists
    queue = await db.queues.find_one({
        "_id": ObjectId(data.queue_id),
        "organization_id": current_user.organization_id
    })
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    task = Task(
        organization_id=current_user.organization_id,
        queue_id=ObjectId(data.queue_id),
        title=data.title,
        description=data.description,
        priority=data.priority,
        parent_task_id=ObjectId(data.parent_task_id) if data.parent_task_id else None,
        project_id=ObjectId(data.project_id) if data.project_id else None,
        sop_id=ObjectId(data.sop_id) if data.sop_id else None,
        input_data=data.input_data,
        max_retries=data.max_retries,
        approver_type=data.approver_type,
        approver_id=ObjectId(data.approver_id) if data.approver_id else None,
        approver_queue_id=ObjectId(data.approver_queue_id) if data.approver_queue_id else None,
        approval_required=data.approval_required,
        scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end,
        schedule_timezone=data.schedule_timezone,
    )

    await db.tasks.insert_one(task.model_dump_mongo())

    return serialize_task(task.model_dump_mongo())


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert IDs
    for field in ["queue_id", "assigned_to_id", "project_id", "sop_id", "approver_id", "approver_queue_id"]:
        if field in update_data and update_data[field]:
            update_data[field] = ObjectId(update_data[field])

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {"_id": ObjectId(task_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Task not found")

    return serialize_task(result)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    result = await db.tasks.delete_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")


# Task state transitions

@router.post("/{task_id}/checkout")
async def checkout_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Check out a task for processing. Transitions: queued -> checked_out, phase: ready -> in_progress.
    If task has a playbook (sop_id), initializes step responses for all steps."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    # Atomically claim the task - also transition phase to in_progress if it's ready
    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "status": TaskStatus.QUEUED.value
        },
        {
            "$set": {
                "status": TaskStatus.CHECKED_OUT.value,
                "phase": TaskPhase.IN_PROGRESS.value,
                "checked_out_by_id": current_user.id,
                "checked_out_at": now,
                "assigned_to_id": current_user.id,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["status"] != TaskStatus.QUEUED.value:
            raise HTTPException(status_code=400, detail=f"Task is {task['status']}, not queued")

    # If task has a playbook (sop_id), initialize step responses
    sop_id = result.get("sop_id")
    if sop_id:
        # Check if step responses already exist
        existing_steps = await db.task_step_responses.count_documents({
            "task_id": ObjectId(task_id)
        })

        if existing_steps == 0:
            # Fetch the playbook to get steps
            playbook = await db.playbooks.find_one({"_id": str(sop_id)})
            if playbook and playbook.get("steps"):
                step_responses = []
                for step in playbook["steps"]:
                    step_response = TaskStepResponse(
                        task_id=ObjectId(task_id),
                        organization_id=current_user.organization_id,
                        step_id=step["id"],
                        step_order=step["order"],
                        status=StepStatus.PENDING,
                    )
                    step_responses.append(step_response.model_dump_mongo())

                if step_responses:
                    await db.task_step_responses.insert_many(step_responses)

    return serialize_task(result)


@router.post("/{task_id}/start")
async def start_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Start working on a checked-out task. Transitions: checked_out -> in_progress, phase -> in_progress"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "status": TaskStatus.CHECKED_OUT.value,
            "checked_out_by_id": current_user.id
        },
        {
            "$set": {
                "status": TaskStatus.IN_PROGRESS.value,
                "phase": TaskPhase.IN_PROGRESS.value,
                "started_at": now,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        # Check if task exists and why update failed
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["status"] != TaskStatus.CHECKED_OUT.value:
            raise HTTPException(status_code=400, detail=f"Task is {task['status']}, not checked_out")
        if task.get("checked_out_by_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Task is checked out by another user")

    return serialize_task(result)


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    data: TaskComplete | None = None,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Complete a task. Transitions: in_progress -> completed"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)
    update = {
        "status": TaskStatus.COMPLETED.value,
        "completed_at": now,
        "updated_at": now
    }

    if data and data.output_data:
        update["output_data"] = data.output_data

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "status": TaskStatus.IN_PROGRESS.value,
            "$or": [
                {"assigned_to_id": current_user.id},
                {"checked_out_by_id": current_user.id}
            ]
        },
        {"$set": update},
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["status"] != TaskStatus.IN_PROGRESS.value:
            raise HTTPException(status_code=400, detail=f"Task is {task['status']}, not in_progress")
        raise HTTPException(status_code=403, detail="Task is assigned to another user")

    return serialize_task(result)


@router.post("/{task_id}/fail")
async def fail_task(
    task_id: str,
    data: TaskFail,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Mark a task as failed. Optionally retry by moving back to queued."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id,
        "status": {"$in": [TaskStatus.CHECKED_OUT.value, TaskStatus.IN_PROGRESS.value]}
    })

    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not in valid state")

    now = datetime.now(timezone.utc)
    retry_count = task.get("retry_count", 0)
    max_retries = task.get("max_retries", 3)

    if data.retry and retry_count < max_retries:
        # Retry - move back to queued
        update = {
            "status": TaskStatus.QUEUED.value,
            "retry_count": retry_count + 1,
            "failure_reason": data.reason,
            "assigned_to_id": None,
            "checked_out_by_id": None,
            "checked_out_at": None,
            "updated_at": now
        }
    else:
        # Final failure
        update = {
            "status": TaskStatus.FAILED.value,
            "failed_at": now,
            "failure_reason": data.reason,
            "retry_count": retry_count + 1,
            "updated_at": now
        }

    result = await db.tasks.find_one_and_update(
        {"_id": ObjectId(task_id)},
        {"$set": update},
        return_document=True
    )

    return serialize_task(result)


@router.post("/{task_id}/release")
async def release_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Release a checked-out task back to queued."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "status": TaskStatus.CHECKED_OUT.value,
            "checked_out_by_id": current_user.id
        },
        {
            "$set": {
                "status": TaskStatus.QUEUED.value,
                "checked_out_by_id": None,
                "checked_out_at": None,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        raise HTTPException(status_code=404, detail="Task not found or not checked out by you")

    return serialize_task(result)


# Phase transition endpoints

@router.post("/{task_id}/mark-ready")
async def mark_task_ready(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Mark a task as ready for assignment. Transitions: planning -> ready"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "phase": TaskPhase.PLANNING.value
        },
        {
            "$set": {
                "phase": TaskPhase.READY.value,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=400, detail=f"Task is in phase '{task.get('phase', 'planning')}', cannot mark as ready")

    return serialize_task(result)


@router.post("/{task_id}/submit-for-review")
async def submit_for_review(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Submit task for review. Transitions: in_progress -> pending_review"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "phase": TaskPhase.IN_PROGRESS.value
        },
        {
            "$set": {
                "phase": TaskPhase.PENDING_REVIEW.value,
                "review_requested_at": now,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=400, detail=f"Task is in phase '{task.get('phase', 'planning')}', cannot submit for review")

    return serialize_task(result)


@router.post("/{task_id}/start-review")
async def start_review(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Start reviewing a task. Transitions: pending_review -> in_review"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "phase": TaskPhase.PENDING_REVIEW.value
        },
        {
            "$set": {
                "phase": TaskPhase.IN_REVIEW.value,
                "reviewer_id": current_user.id,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=400, detail=f"Task is in phase '{task.get('phase', 'planning')}', cannot start review")

    return serialize_task(result)


@router.post("/{task_id}/request-changes")
async def request_changes(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Request changes on a task. Transitions: in_review -> changes_requested"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "phase": TaskPhase.IN_REVIEW.value
        },
        {
            "$set": {
                "phase": TaskPhase.CHANGES_REQUESTED.value,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=400, detail=f"Task is in phase '{task.get('phase', 'planning')}', cannot request changes")

    return serialize_task(result)


@router.post("/{task_id}/approve")
async def approve_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Approve a task. Transitions: in_review -> approved OR in_progress -> approved (if no review needed)"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    # Try to approve from in_review first
    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "phase": {"$in": [TaskPhase.IN_REVIEW.value, TaskPhase.IN_PROGRESS.value]}
        },
        {
            "$set": {
                "phase": TaskPhase.APPROVED.value,
                "status": TaskStatus.COMPLETED.value,
                "completed_at": now,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=400, detail=f"Task is in phase '{task.get('phase', 'planning')}', cannot approve")

    return serialize_task(result)


@router.post("/{task_id}/resume-work")
async def resume_work(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Resume work on a task after changes requested. Transitions: changes_requested -> in_progress"""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    now = datetime.now(timezone.utc)

    result = await db.tasks.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id,
            "phase": TaskPhase.CHANGES_REQUESTED.value
        },
        {
            "$set": {
                "phase": TaskPhase.IN_PROGRESS.value,
                "updated_at": now
            }
        },
        return_document=True
    )

    if not result:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "organization_id": current_user.organization_id
        })
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        raise HTTPException(status_code=400, detail=f"Task is in phase '{task.get('phase', 'planning')}', cannot resume work")

    return serialize_task(result)


# Task progress updates

@router.get("/{task_id}/updates")
async def list_task_updates(
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """Get progress updates for a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task access
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    cursor = db.task_updates.find({"task_id": ObjectId(task_id)}).sort("created_at", -1)
    updates = await cursor.to_list(100)

    return [
        {
            **u,
            "_id": str(u["_id"]),
            "task_id": str(u["task_id"]),
            "user_id": str(u["user_id"])
        }
        for u in updates
    ]


@router.post("/{task_id}/updates", status_code=status.HTTP_201_CREATED)
async def create_task_update(
    task_id: str,
    data: TaskProgressUpdateCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Post a progress update for a task."""
    db = get_database()

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    # Verify task access and that it's in progress
    task = await db.tasks.find_one({
        "_id": ObjectId(task_id),
        "organization_id": current_user.organization_id,
        "status": TaskStatus.IN_PROGRESS.value
    })
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or not in progress")

    update = TaskProgressUpdate(
        task_id=ObjectId(task_id),
        user_id=current_user.id,
        content=data.content,
        progress_percent=data.progress_percent
    )

    await db.task_updates.insert_one(update.model_dump_mongo())

    return {
        **update.model_dump_mongo(),
        "_id": str(update.id),
        "task_id": str(update.task_id),
        "user_id": str(update.user_id)
    }
