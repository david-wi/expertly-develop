"""Playbook factory for tests."""

import factory
from uuid import uuid4

from app.models import Playbook
from app.models.playbook import PlaybookStatus


class PlaybookFactory(factory.Factory):
    """Factory for creating Playbook instances."""

    class Meta:
        model = Playbook

    id = factory.LazyFunction(uuid4)
    tenant_id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Playbook {n}")
    description = factory.Sequence(lambda n: f"Description for playbook {n}")
    category = "communication"
    triggers = factory.LazyFunction(list)
    must_consult = False
    content = factory.Sequence(lambda n: f"Content for playbook {n}")
    learned_from = None
    source_task_id = None
    status = PlaybookStatus.ACTIVE
    use_count = 0
    last_used = None
