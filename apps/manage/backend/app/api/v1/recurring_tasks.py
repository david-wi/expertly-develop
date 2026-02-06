from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models import (
    RecurringTask, RecurringTaskCreate, RecurringTaskUpdate,
    RecurrenceType, Task, TaskStatus, User
)
from app.api.deps import get_current_user

router = APIRouter()


def calculate_next_run(recurring_task: RecurringTask, from_time: datetime = None) -> datetime:
    """Calculate the next run time for a recurring task."""
    if from_time is None:
        from_time = datetime.now(timezone.utc)

    if recurring_task.recurrence_type == RecurrenceType.DAILY:
        # Daily: add interval days
        next_run = from_time + timedelta(days=recurring_task.interval)

    elif recurring_task.recurrence_type == RecurrenceType.WEEKDAY:
        # Weekday: next Monday-Friday
        next_run = from_time + timedelta(days=1)
        while next_run.weekday() >= 5:  # 5=Saturday, 6=Sunday
            next_run += timedelta(days=1)

    elif recurring_task.recurrence_type == RecurrenceType.WEEKLY:
        if recurring_task.days_of_week:
            # Find the next matching day of week
            current_dow = from_time.weekday()
            sorted_days = sorted(recurring_task.days_of_week)

            # Find next day in this week or next week
            days_ahead = None
            for day in sorted_days:
                if day > current_dow:
                    days_ahead = day - current_dow
                    break

            if days_ahead is None:
                # Wrap to first day of next week(s)
                days_ahead = (7 - current_dow) + sorted_days[0] + (7 * (recurring_task.interval - 1))

            next_run = from_time + timedelta(days=days_ahead)
        else:
            # No specific days, just add weeks
            next_run = from_time + timedelta(weeks=recurring_task.interval)

    elif recurring_task.recurrence_type == RecurrenceType.MONTHLY:
        # Monthly: add months
        month = from_time.month + recurring_task.interval
        year = from_time.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        day = recurring_task.day_of_month or from_time.day
        # Handle months with fewer days
        while True:
            try:
                next_run = from_time.replace(year=year, month=month, day=day)
                break
            except ValueError:
                day -= 1

    else:
        # Custom (cron) - for now, default to daily
        next_run = from_time + timedelta(days=1)

    return next_run


def serialize_recurring_task(task: dict) -> dict:
    """Convert ObjectIds to strings in recurring task document."""
    return {
        **task,
        "_id": str(task["_id"]),
        "organization_id": str(task["organization_id"]),
        "queue_id": str(task["queue_id"]),
        "project_id": str(task["project_id"]) if task.get("project_id") else None,
    }


@router.get("")
async def list_recurring_tasks(
    queue_id: str | None = None,
    project_id: str | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_user)
) -> list[dict]:
    """List recurring tasks."""
    db = get_database()

    query = {"organization_id": current_user.organization_id}

    if queue_id:
        if not ObjectId.is_valid(queue_id):
            raise HTTPException(status_code=400, detail="Invalid queue_id")
        query["queue_id"] = ObjectId(queue_id)

    if project_id:
        if not ObjectId.is_valid(project_id):
            raise HTTPException(status_code=400, detail="Invalid project_id")
        query["project_id"] = ObjectId(project_id)

    if is_active is not None:
        query["is_active"] = is_active

    cursor = db.recurring_tasks.find(query).sort("created_at", -1)
    tasks = await cursor.to_list(100)

    return [serialize_recurring_task(t) for t in tasks]


@router.get("/{recurring_task_id}")
async def get_recurring_task(
    recurring_task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Get a specific recurring task."""
    db = get_database()

    if not ObjectId.is_valid(recurring_task_id):
        raise HTTPException(status_code=400, detail="Invalid recurring task ID")

    task = await db.recurring_tasks.find_one({
        "_id": ObjectId(recurring_task_id),
        "organization_id": current_user.organization_id
    })

    if not task:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    return serialize_recurring_task(task)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_recurring_task(
    data: RecurringTaskCreate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Create a new recurring task."""
    db = get_database()

    # Validate queue exists
    if not ObjectId.is_valid(data.queue_id):
        raise HTTPException(status_code=400, detail="Invalid queue_id")

    queue = await db.queues.find_one({
        "_id": ObjectId(data.queue_id),
        "organization_id": current_user.organization_id,
        "deleted_at": None
    })
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    start_date = data.start_date or datetime.now(timezone.utc)

    # Validate project_id if provided
    project_id = None
    if data.project_id:
        if not ObjectId.is_valid(data.project_id):
            raise HTTPException(status_code=400, detail="Invalid project_id")
        project = await db.projects.find_one({
            "_id": ObjectId(data.project_id),
            "organization_id": current_user.organization_id
        })
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        project_id = ObjectId(data.project_id)

    recurring_task = RecurringTask(
        organization_id=current_user.organization_id,
        queue_id=ObjectId(data.queue_id),
        title=data.title,
        description=data.description,
        priority=data.priority,
        project_id=project_id,
        recurrence_type=data.recurrence_type,
        cron_expression=data.cron_expression,
        interval=data.interval,
        days_of_week=data.days_of_week,
        day_of_month=data.day_of_month,
        start_date=start_date,
        end_date=data.end_date,
        timezone=data.timezone,
        input_data=data.input_data,
        max_retries=data.max_retries,
        is_active=True,
        next_run=start_date,
    )

    await db.recurring_tasks.insert_one(recurring_task.model_dump_mongo())

    return serialize_recurring_task(recurring_task.model_dump_mongo())


@router.patch("/{recurring_task_id}")
async def update_recurring_task(
    recurring_task_id: str,
    data: RecurringTaskUpdate,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Update a recurring task."""
    db = get_database()

    if not ObjectId.is_valid(recurring_task_id):
        raise HTTPException(status_code=400, detail="Invalid recurring task ID")

    task = await db.recurring_tasks.find_one({
        "_id": ObjectId(recurring_task_id),
        "organization_id": current_user.organization_id
    })

    if not task:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert queue_id to ObjectId
    if "queue_id" in update_data:
        if not ObjectId.is_valid(update_data["queue_id"]):
            raise HTTPException(status_code=400, detail="Invalid queue_id")
        update_data["queue_id"] = ObjectId(update_data["queue_id"])

    # Convert project_id to ObjectId
    if "project_id" in update_data:
        if update_data["project_id"]:
            if not ObjectId.is_valid(update_data["project_id"]):
                raise HTTPException(status_code=400, detail="Invalid project_id")
            update_data["project_id"] = ObjectId(update_data["project_id"])
        else:
            update_data["project_id"] = None

    result = await db.recurring_tasks.find_one_and_update(
        {"_id": ObjectId(recurring_task_id), "organization_id": current_user.organization_id},
        {"$set": update_data},
        return_document=True
    )

    return serialize_recurring_task(result)


@router.delete("/{recurring_task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_task(
    recurring_task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a recurring task."""
    db = get_database()

    if not ObjectId.is_valid(recurring_task_id):
        raise HTTPException(status_code=400, detail="Invalid recurring task ID")

    result = await db.recurring_tasks.delete_one({
        "_id": ObjectId(recurring_task_id),
        "organization_id": current_user.organization_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recurring task not found")


@router.post("/{recurring_task_id}/trigger")
async def trigger_recurring_task(
    recurring_task_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """Manually trigger a recurring task to create a new task instance."""
    db = get_database()

    if not ObjectId.is_valid(recurring_task_id):
        raise HTTPException(status_code=400, detail="Invalid recurring task ID")

    recurring_task = await db.recurring_tasks.find_one({
        "_id": ObjectId(recurring_task_id),
        "organization_id": current_user.organization_id
    })

    if not recurring_task:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    # Create a new task from the template
    now = datetime.now(timezone.utc)
    task = Task(
        organization_id=current_user.organization_id,
        queue_id=recurring_task["queue_id"],
        title=recurring_task["title"],
        description=recurring_task.get("description"),
        priority=recurring_task.get("priority", 5),
        status=TaskStatus.QUEUED,
        input_data=recurring_task.get("input_data"),
        max_retries=recurring_task.get("max_retries", 3),
    )

    await db.tasks.insert_one(task.model_dump_mongo())

    # Update the recurring task
    rt = RecurringTask(**{**recurring_task, "_id": recurring_task["_id"]})
    next_run = calculate_next_run(rt, now)

    await db.recurring_tasks.update_one(
        {"_id": ObjectId(recurring_task_id)},
        {
            "$set": {
                "last_run": now,
                "next_run": next_run,
            },
            "$inc": {"created_tasks_count": 1}
        }
    )

    return {
        "_id": str(task.id),
        "organization_id": str(task.organization_id),
        "queue_id": str(task.queue_id),
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "priority": task.priority,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


@router.post("/process-due")
async def process_due_recurring_tasks(
    current_user: User = Depends(get_current_user)
) -> dict:
    """Process all due recurring tasks and create task instances.

    This endpoint should be called by a cron job or scheduler.
    """
    db = get_database()
    now = datetime.now(timezone.utc)

    # Find all active recurring tasks that are due
    cursor = db.recurring_tasks.find({
        "organization_id": current_user.organization_id,
        "is_active": True,
        "next_run": {"$lte": now},
        "$or": [
            {"end_date": None},
            {"end_date": {"$gt": now}}
        ]
    })

    recurring_tasks = await cursor.to_list(100)
    created_count = 0

    for rt_doc in recurring_tasks:
        # Create task
        task = Task(
            organization_id=rt_doc["organization_id"],
            queue_id=rt_doc["queue_id"],
            title=rt_doc["title"],
            description=rt_doc.get("description"),
            priority=rt_doc.get("priority", 5),
            status=TaskStatus.QUEUED,
            input_data=rt_doc.get("input_data"),
            max_retries=rt_doc.get("max_retries", 3),
        )

        await db.tasks.insert_one(task.model_dump_mongo())
        created_count += 1

        # Calculate next run
        rt = RecurringTask(**{**rt_doc, "_id": rt_doc["_id"]})
        next_run = calculate_next_run(rt, now)

        # Check if we've passed the end date
        is_active = True
        if rt_doc.get("end_date") and next_run > rt_doc["end_date"]:
            is_active = False

        await db.recurring_tasks.update_one(
            {"_id": rt_doc["_id"]},
            {
                "$set": {
                    "last_run": now,
                    "next_run": next_run,
                    "is_active": is_active,
                },
                "$inc": {"created_tasks_count": 1}
            }
        )

    return {
        "processed": len(recurring_tasks),
        "created_tasks": created_count,
    }
