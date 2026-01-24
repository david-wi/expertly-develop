"""Task business logic service."""

from uuid import UUID
from typing import Optional, List
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models import Task, Question, QuestionUnblock, Log, Project, Person, TaskPerson
from app.models.task import TaskStatus, TaskAssignee
from app.models.question import QuestionStatus
from app.models.log import LogActor
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskComplete,
    TaskBlock,
    TaskContext,
    TaskSummary,
    LogEntry,
    PersonContext,
    ProjectSummary,
)


class TaskService:
    """Service for task operations."""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def get_next_task(self, assignee: str = TaskAssignee.CLAUDE) -> Optional[Task]:
        """
        Get the highest-priority unblocked task for the given assignee.

        Priority order: priority (asc), created_at (asc)
        """
        result = await self.db.execute(
            select(Task)
            .where(
                and_(
                    Task.tenant_id == self.tenant_id,
                    Task.status == TaskStatus.QUEUED,
                    Task.assignee == assignee,
                )
            )
            .order_by(Task.priority.asc(), Task.created_at.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def claim_next_task(
        self, worker_id: str, assignee: str = TaskAssignee.CLAUDE
    ) -> Optional[Task]:
        """
        Atomically claim the next available task for a worker.

        This gets the next task and marks it as working in one operation,
        preventing race conditions when multiple workers are polling.
        """
        task = await self.get_next_task(assignee)
        if not task:
            return None

        task.start()
        task.worker_id = worker_id
        await self.db.flush()
        await self._log_action("task.claimed", "task", task.id, {"worker_id": worker_id})

        return task

    async def get_next_task_with_context(
        self, assignee: str = TaskAssignee.CLAUDE
    ) -> Optional[tuple[Task, TaskContext]]:
        """
        Get the highest-priority unblocked task with full context.

        Returns task with:
        - Eager-loaded project and people relationships
        - Related tasks from the same project
        - Task action history from logs
        """
        # Get task with eager-loaded relationships
        result = await self.db.execute(
            select(Task)
            .options(
                selectinload(Task.project),
                selectinload(Task.people).selectinload(TaskPerson.person),
            )
            .where(
                and_(
                    Task.tenant_id == self.tenant_id,
                    Task.status == TaskStatus.QUEUED,
                    Task.assignee == assignee,
                )
            )
            .order_by(Task.priority.asc(), Task.created_at.asc())
            .limit(1)
        )
        task = result.scalar_one_or_none()

        if not task:
            return None

        # Build context
        context = await self._build_task_context(task)
        return task, context

    async def _build_task_context(self, task: Task) -> TaskContext:
        """Build full context for a task."""
        # Project summary
        project_summary = None
        if task.project:
            project_summary = ProjectSummary(
                id=task.project.id,
                name=task.project.name,
                description=task.project.description,
                project_type=task.project.project_type,
                status=task.project.status,
            )

        # Related people with context
        related_people = []
        for task_person in task.people:
            person = task_person.person
            related_people.append(PersonContext(
                id=person.id,
                name=person.name,
                role=task_person.role,
                email=person.email,
                title=person.title,
                company=person.company,
                relationship=person.relationship,
                communication_notes=person.communication_notes,
            ))

        # Related tasks from same project (exclude current)
        related_tasks = []
        if task.project_id:
            result = await self.db.execute(
                select(Task)
                .where(
                    and_(
                        Task.tenant_id == self.tenant_id,
                        Task.project_id == task.project_id,
                        Task.id != task.id,
                        Task.status.in_([TaskStatus.QUEUED, TaskStatus.WORKING, TaskStatus.BLOCKED]),
                    )
                )
                .order_by(Task.priority.asc(), Task.created_at.desc())
                .limit(5)
            )
            for related_task in result.scalars().all():
                related_tasks.append(TaskSummary(
                    id=related_task.id,
                    title=related_task.title,
                    status=related_task.status,
                    priority=related_task.priority,
                ))

        # Task history from logs
        history = []
        result = await self.db.execute(
            select(Log)
            .where(
                and_(
                    Log.tenant_id == self.tenant_id,
                    Log.entity_type == "task",
                    Log.entity_id == task.id,
                )
            )
            .order_by(Log.timestamp.desc())
            .limit(10)
        )
        for log in result.scalars().all():
            history.append(LogEntry(
                timestamp=log.timestamp,
                action=log.action,
                actor=log.actor,
                details=log.details,
            ))

        return TaskContext(
            project=project_summary,
            related_people=related_people,
            related_tasks=related_tasks,
            history=history,
        )

    async def get_task(self, task_id: UUID) -> Optional[Task]:
        """Get a task by ID."""
        result = await self.db.execute(
            select(Task).where(
                and_(
                    Task.id == task_id,
                    Task.tenant_id == self.tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        status: Optional[str] = None,
        assignee: Optional[str] = None,
        project_id: Optional[UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Task]:
        """List tasks with optional filters."""
        query = select(Task).where(Task.tenant_id == self.tenant_id)

        if status:
            query = query.where(Task.status == status)
        if assignee:
            query = query.where(Task.assignee == assignee)
        if project_id:
            query = query.where(Task.project_id == project_id)

        query = query.order_by(Task.priority.asc(), Task.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_task(self, data: TaskCreate) -> Task:
        """Create a new task."""
        task = Task(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            title=data.title,
            description=data.description,
            priority=data.priority,
            assignee=data.assignee,
            project_id=data.project_id,
            due_date=data.due_date,
            context=data.context,
            tags=data.tags,
            source=data.source if data.source else "manual",
        )
        self.db.add(task)
        await self.db.flush()

        # Log creation
        await self._log_action("task.created", "task", task.id)

        return task

    async def update_task(self, task_id: UUID, data: TaskUpdate) -> Optional[Task]:
        """Update a task."""
        task = await self.get_task(task_id)
        if not task:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        await self.db.flush()
        await self._log_action("task.updated", "task", task.id, {"updated_fields": list(update_data.keys())})

        return task

    async def start_task(self, task_id: UUID, worker_id: Optional[str] = None) -> Optional[Task]:
        """Mark a task as working and optionally assign to a worker."""
        task = await self.get_task(task_id)
        if not task:
            return None

        # Check if already being worked on by another worker
        if task.status == TaskStatus.WORKING and task.worker_id and worker_id:
            if task.worker_id != worker_id:
                raise ValueError(f"Task already being worked on by {task.worker_id}")

        task.start()  # Uses model method for state validation
        task.worker_id = worker_id
        await self.db.flush()
        await self._log_action("task.started", "task", task.id, {"worker_id": worker_id})

        return task

    async def complete_task(self, task_id: UUID, data: TaskComplete) -> Optional[Task]:
        """Complete a task with output."""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.complete(output=data.output)
        await self.db.flush()
        await self._log_action(
            "task.completed",
            "task",
            task.id,
            {"learnings_captured": data.learnings_captured},
        )

        # Create follow-up tasks if provided
        for follow_up in data.follow_up_tasks:
            await self.create_task(follow_up)

        return task

    async def block_task(self, task_id: UUID, data: TaskBlock) -> tuple[Optional[Task], Optional[Question]]:
        """Block a task with a question."""
        task = await self.get_task(task_id)
        if not task:
            return None, None

        # Create the blocking question
        question = Question(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            text=data.question_text,
            why_asking=data.why_asking,
            what_claude_will_do=data.what_claude_will_do,
            priority=data.priority,
            status=QuestionStatus.UNANSWERED,
        )
        self.db.add(question)
        await self.db.flush()

        # Link question to task
        unblock = QuestionUnblock(question_id=question.id, task_id=task.id)
        self.db.add(unblock)

        # Block the task
        task.block(question.id)
        await self.db.flush()

        await self._log_action("task.blocked", "task", task.id, {"question_id": str(question.id)})
        await self._log_action("question.created", "question", question.id, {"blocks_task_id": str(task.id)})

        return task, question

    async def unblock_task(self, task_id: UUID) -> Optional[Task]:
        """Unblock a task (called when question is answered)."""
        task = await self.get_task(task_id)
        if not task:
            return None

        task.unblock()
        await self.db.flush()
        await self._log_action("task.unblocked", "task", task.id)

        return task

    async def delete_task(self, task_id: UUID) -> bool:
        """Soft delete a task (cancel it)."""
        task = await self.get_task(task_id)
        if not task:
            return False

        if task.status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]:
            return False

        task.cancel()
        await self.db.flush()
        await self._log_action("task.cancelled", "task", task.id)

        return True

    async def _log_action(
        self,
        action: str,
        entity_type: str,
        entity_id: UUID,
        details: dict = None,
    ) -> None:
        """Create an audit log entry."""
        log = Log.create(
            tenant_id=self.tenant_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=self.user_id,
            actor=LogActor.CLAUDE,
            details=details or {},
        )
        self.db.add(log)
