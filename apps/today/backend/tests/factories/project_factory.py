"""Project factory for tests."""

import factory
from uuid import uuid4

from app.models import Project


class ProjectFactory(factory.Factory):
    """Factory for creating Project instances."""

    class Meta:
        model = Project

    id = factory.LazyFunction(uuid4)
    tenant_id = factory.LazyFunction(uuid4)
    user_id = None
    name = factory.Sequence(lambda n: f"Project {n}")
    description = factory.Sequence(lambda n: f"Description for project {n}")
    project_type = "project"
    status = "active"
    priority_order = 0
    success_criteria = None
    target_date = None
    parent_id = None
