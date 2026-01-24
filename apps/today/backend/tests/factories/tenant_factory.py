"""Tenant factory for tests."""

import factory
from uuid import uuid4

from app.models import Tenant


class TenantFactory(factory.Factory):
    """Factory for creating Tenant instances."""

    class Meta:
        model = Tenant

    id = factory.LazyFunction(uuid4)
    name = factory.Sequence(lambda n: f"Tenant {n}")
    slug = factory.Sequence(lambda n: f"tenant-{n}")
    database_mode = "shared"
    tier = "standard"
    settings = factory.LazyFunction(dict)
