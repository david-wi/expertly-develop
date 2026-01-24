"""Unit tests for TaskService."""

import pytest
from uuid import uuid4

from app.models import Task, Project, Person, TaskPerson
from app.models.task import TaskStatus, TaskAssignee
from app.services.task_service import TaskService
from app.schemas.task import TaskCreate, TaskUpdate, TaskComplete, TaskBlock
from tests.factories import TaskFactory, ProjectFactory, PersonFactory


class TestTaskStateMachine:
    """Tests for task state transitions."""

    def test_task_can_start_from_queued(self):
        """Task can transition from queued to working."""
        task = TaskFactory.build(status=TaskStatus.QUEUED)
        assert task.can_transition_to(TaskStatus.WORKING) is True

    def test_task_cannot_start_from_completed(self):
        """Task cannot start if already completed."""
        task = TaskFactory.build(status=TaskStatus.COMPLETED)
        assert task.can_transition_to(TaskStatus.WORKING) is False

    def test_task_can_complete_from_working(self):
        """Task can complete from working status."""
        task = TaskFactory.build(status=TaskStatus.WORKING)
        assert task.can_transition_to(TaskStatus.COMPLETED) is True

    def test_task_cannot_complete_from_blocked(self):
        """Task cannot complete while blocked."""
        task = TaskFactory.build(status=TaskStatus.BLOCKED)
        assert task.can_transition_to(TaskStatus.COMPLETED) is False

    def test_task_can_block_from_working(self):
        """Task can be blocked from working status."""
        task = TaskFactory.build(status=TaskStatus.WORKING)
        assert task.can_transition_to(TaskStatus.BLOCKED) is True

    def test_task_cannot_block_from_queued(self):
        """Task cannot be blocked directly from queued."""
        task = TaskFactory.build(status=TaskStatus.QUEUED)
        assert task.can_transition_to(TaskStatus.BLOCKED) is False

    def test_blocked_task_returns_to_queued(self):
        """Unblocking a task returns it to queued status."""
        task = TaskFactory.build(status=TaskStatus.BLOCKED)
        assert task.can_transition_to(TaskStatus.QUEUED) is True

    def test_task_start_sets_started_at(self):
        """Starting a task sets the started_at timestamp."""
        task = TaskFactory.build(status=TaskStatus.QUEUED)
        task.start()
        assert task.status == TaskStatus.WORKING
        assert task.started_at is not None

    def test_task_complete_sets_completed_at(self):
        """Completing a task sets the completed_at timestamp."""
        task = TaskFactory.build(status=TaskStatus.WORKING)
        task.complete(output="Done!")
        assert task.status == TaskStatus.COMPLETED
        assert task.completed_at is not None
        assert task.output == "Done!"

    def test_task_block_sets_question_id(self):
        """Blocking a task sets the blocking question ID."""
        task = TaskFactory.build(status=TaskStatus.WORKING)
        question_id = uuid4()
        task.block(question_id)
        assert task.status == TaskStatus.BLOCKED
        assert task.blocking_question_id == question_id

    def test_task_unblock_clears_question_id(self):
        """Unblocking a task clears the blocking question ID."""
        task = TaskFactory.build(status=TaskStatus.BLOCKED, blocking_question_id=uuid4())
        task.unblock()
        assert task.status == TaskStatus.QUEUED
        assert task.blocking_question_id is None

    def test_cannot_start_blocked_task(self):
        """Cannot start a blocked task."""
        task = TaskFactory.build(status=TaskStatus.BLOCKED)
        with pytest.raises(ValueError, match="Cannot start task"):
            task.start()

    def test_cannot_complete_blocked_task(self):
        """Cannot complete a blocked task."""
        task = TaskFactory.build(status=TaskStatus.BLOCKED)
        with pytest.raises(ValueError, match="Cannot complete task"):
            task.complete()

    def test_cannot_unblock_non_blocked_task(self):
        """Cannot unblock a task that isn't blocked."""
        task = TaskFactory.build(status=TaskStatus.WORKING)
        with pytest.raises(ValueError, match="Cannot unblock task"):
            task.unblock()


class TestTaskService:
    """Integration tests for TaskService."""

    @pytest.mark.asyncio
    async def test_create_task(self, db_session, test_tenant, test_user):
        """TaskService can create a task."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        data = TaskCreate(
            title="Test Task",
            description="A test task",
            priority=2,
            assignee="claude",
        )

        task = await service.create_task(data)

        assert task.id is not None
        assert task.title == "Test Task"
        assert task.description == "A test task"
        assert task.priority == 2
        assert task.status == TaskStatus.QUEUED
        assert task.tenant_id == test_tenant.id

    @pytest.mark.asyncio
    async def test_get_next_task_returns_highest_priority(self, db_session, test_tenant, test_user):
        """get_next_task returns the highest priority task."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create tasks with different priorities
        low_priority = await service.create_task(TaskCreate(title="Low Priority", priority=5))
        high_priority = await service.create_task(TaskCreate(title="High Priority", priority=1))
        medium_priority = await service.create_task(TaskCreate(title="Medium Priority", priority=3))

        await db_session.commit()

        next_task = await service.get_next_task()

        assert next_task is not None
        assert next_task.id == high_priority.id
        assert next_task.title == "High Priority"

    @pytest.mark.asyncio
    async def test_get_next_task_skips_blocked(self, db_session, test_tenant, test_user):
        """get_next_task skips blocked tasks."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a high priority task and block it
        blocked_task = await service.create_task(TaskCreate(title="Blocked", priority=1))
        await db_session.commit()

        # Start and block the task
        await service.start_task(blocked_task.id)
        await service.block_task(blocked_task.id, TaskBlock(question_text="Need info"))
        await db_session.commit()

        # Create an unblocked task
        unblocked_task = await service.create_task(TaskCreate(title="Unblocked", priority=5))
        await db_session.commit()

        next_task = await service.get_next_task()

        assert next_task is not None
        assert next_task.id == unblocked_task.id

    @pytest.mark.asyncio
    async def test_complete_task_workflow(self, db_session, test_tenant, test_user):
        """Full task completion workflow works."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create and start task
        task = await service.create_task(TaskCreate(title="Workflow Test"))
        await db_session.commit()

        started_task = await service.start_task(task.id)
        assert started_task.status == TaskStatus.WORKING

        # Complete task
        completed_task = await service.complete_task(
            task.id,
            TaskComplete(output="Task completed successfully")
        )

        assert completed_task.status == TaskStatus.COMPLETED
        assert completed_task.output == "Task completed successfully"

    @pytest.mark.asyncio
    async def test_block_unblock_workflow(self, db_session, test_tenant, test_user):
        """Block and unblock workflow works."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create, start, and block task
        task = await service.create_task(TaskCreate(title="Block Test"))
        await db_session.commit()

        await service.start_task(task.id)
        task, question = await service.block_task(
            task.id,
            TaskBlock(
                question_text="What should I do?",
                why_asking="Need clarification",
                what_claude_will_do="Will proceed with answer",
            )
        )

        assert task.status == TaskStatus.BLOCKED
        assert question is not None
        assert question.text == "What should I do?"

        # Unblock task
        unblocked_task = await service.unblock_task(task.id)
        assert unblocked_task.status == TaskStatus.QUEUED
        assert unblocked_task.blocking_question_id is None

    @pytest.mark.asyncio
    async def test_tenant_isolation(self, db_session, test_tenant, test_user):
        """Tasks are isolated by tenant."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a task for test_tenant
        task = await service.create_task(TaskCreate(title="Tenant A Task"))
        await db_session.commit()

        # Create a service for a different tenant
        other_tenant_id = uuid4()
        other_service = TaskService(db_session, other_tenant_id, test_user.id)

        # Should not find the task
        other_task = await other_service.get_task(task.id)
        assert other_task is None

        # List should be empty for other tenant
        other_tasks = await other_service.list_tasks()
        assert len(other_tasks) == 0

    @pytest.mark.asyncio
    async def test_get_next_task_with_context_returns_none_when_empty(self, db_session, test_tenant, test_user):
        """get_next_task_with_context returns None when no tasks."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        result = await service.get_next_task_with_context()

        assert result is None

    @pytest.mark.asyncio
    async def test_get_next_task_with_context_returns_task_and_context(self, db_session, test_tenant, test_user):
        """get_next_task_with_context returns task with context."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a task
        task = await service.create_task(TaskCreate(title="Context Test Task"))
        await db_session.commit()

        result = await service.get_next_task_with_context()

        assert result is not None
        task_result, context = result
        assert task_result.title == "Context Test Task"
        assert context is not None
        assert context.project is None
        assert context.related_people == []
        assert context.related_tasks == []

    @pytest.mark.asyncio
    async def test_get_next_task_with_context_includes_project(self, db_session, test_tenant, test_user):
        """get_next_task_with_context includes project when present."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a project
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            user_id=test_user.id,
            name="Test Project",
            description="A test project",
            project_type="project",
            status="active",
        )
        db_session.add(project)
        await db_session.flush()

        # Create a task with project
        task = await service.create_task(TaskCreate(
            title="Task with Project",
            project_id=project.id,
        ))
        await db_session.commit()

        result = await service.get_next_task_with_context()

        assert result is not None
        task_result, context = result
        assert context.project is not None
        assert context.project.name == "Test Project"
        assert context.project.project_type == "project"

    @pytest.mark.asyncio
    async def test_get_next_task_with_context_includes_related_tasks(self, db_session, test_tenant, test_user):
        """get_next_task_with_context includes related tasks from same project."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a project
        project = Project(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Shared Project",
            project_type="project",
            status="active",
        )
        db_session.add(project)
        await db_session.flush()

        # Create multiple tasks in the same project
        task1 = await service.create_task(TaskCreate(title="Task 1", project_id=project.id, priority=1))
        task2 = await service.create_task(TaskCreate(title="Task 2", project_id=project.id, priority=2))
        task3 = await service.create_task(TaskCreate(title="Task 3", project_id=project.id, priority=3))
        await db_session.commit()

        result = await service.get_next_task_with_context()

        assert result is not None
        task_result, context = result
        assert task_result.title == "Task 1"  # Highest priority
        assert len(context.related_tasks) == 2  # Other 2 tasks
        related_titles = [t.title for t in context.related_tasks]
        assert "Task 2" in related_titles
        assert "Task 3" in related_titles

    @pytest.mark.asyncio
    async def test_get_next_task_with_context_includes_people(self, db_session, test_tenant, test_user):
        """get_next_task_with_context includes related people."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a person
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="John Doe",
            email="john@example.com",
            title="Manager",
            company="Acme Inc",
            relationship="client",
            communication_notes="Prefers formal tone",
        )
        db_session.add(person)
        await db_session.flush()

        # Create a task
        task = await service.create_task(TaskCreate(title="Task with Person"))
        await db_session.flush()

        # Link person to task
        task_person = TaskPerson(task_id=task.id, person_id=person.id, role="recipient")
        db_session.add(task_person)
        await db_session.commit()

        result = await service.get_next_task_with_context()

        assert result is not None
        task_result, context = result
        assert len(context.related_people) == 1
        person_ctx = context.related_people[0]
        assert person_ctx.name == "John Doe"
        assert person_ctx.role == "recipient"
        assert person_ctx.email == "john@example.com"
        assert person_ctx.communication_notes == "Prefers formal tone"

    @pytest.mark.asyncio
    async def test_get_next_task_with_context_includes_history(self, db_session, test_tenant, test_user):
        """get_next_task_with_context includes task history from logs."""
        service = TaskService(db_session, test_tenant.id, test_user.id)

        # Create a task (this also creates a log entry)
        task = await service.create_task(TaskCreate(title="Task with History"))
        await db_session.commit()

        result = await service.get_next_task_with_context()

        assert result is not None
        task_result, context = result
        assert len(context.history) >= 1
        # Should have at least the creation log
        actions = [h.action for h in context.history]
        assert "task.created" in actions
