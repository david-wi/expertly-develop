"""Task factory for tests."""

import factory
from uuid import uuid4

from app.models import Task
from app.models.task import TaskStatus, TaskAssignee


class TaskFactory(factory.Factory):
    """Factory for creating Task instances."""

    class Meta:
        model = Task

    id = factory.LazyFunction(uuid4)
    tenant_id = factory.LazyFunction(uuid4)
    user_id = None
    project_id = None
    title = factory.Sequence(lambda n: f"Task {n}")
    description = factory.Sequence(lambda n: f"Description for task {n}")
    priority = 3
    status = TaskStatus.QUEUED
    assignee = TaskAssignee.CLAUDE
    due_date = None
    context = factory.LazyFunction(dict)
    output = None
    source = "manual"
    tags = factory.LazyFunction(list)
