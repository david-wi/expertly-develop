"""User factory for tests."""

import factory
from uuid import uuid4

from app.models import User
from app.models.base import generate_api_key


class UserFactory(factory.Factory):
    """Factory for creating User instances."""

    class Meta:
        model = User

    id = factory.LazyFunction(uuid4)
    tenant_id = factory.LazyFunction(uuid4)
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    name = factory.Sequence(lambda n: f"User {n}")
    api_key = factory.LazyFunction(generate_api_key)
    role = "member"
    settings = factory.LazyFunction(dict)
    timezone = "UTC"
