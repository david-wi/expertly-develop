"""Person factory for tests."""

import factory
from uuid import uuid4

from app.models import Person


class PersonFactory(factory.Factory):
    """Factory for creating Person instances."""

    class Meta:
        model = Person

    id = factory.LazyFunction(uuid4)
    tenant_id = factory.LazyFunction(uuid4)
    client_id = None
    name = factory.Sequence(lambda n: f"Person {n}")
    email = factory.LazyAttribute(lambda o: f"{o.name.lower().replace(' ', '.')}@example.com")
    phone = None
    title = factory.Sequence(lambda n: f"Title {n}")
    company = factory.Sequence(lambda n: f"Company {n}")
    relationship = "colleague"
    relationship_to_user = None
    political_context = None
    communication_notes = None
    last_contact = None
    next_follow_up = None
    context_notes = None
