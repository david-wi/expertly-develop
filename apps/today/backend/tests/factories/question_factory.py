"""Question factory for tests."""

import factory
from uuid import uuid4

from app.models import Question
from app.models.question import QuestionStatus


class QuestionFactory(factory.Factory):
    """Factory for creating Question instances."""

    class Meta:
        model = Question

    id = factory.LazyFunction(uuid4)
    tenant_id = factory.LazyFunction(uuid4)
    user_id = None
    text = factory.Sequence(lambda n: f"Question {n}?")
    context = factory.Sequence(lambda n: f"Context for question {n}")
    why_asking = factory.Sequence(lambda n: f"Why asking question {n}")
    what_claude_will_do = factory.Sequence(lambda n: f"What Claude will do with answer {n}")
    priority = 3
    priority_reason = None
    status = QuestionStatus.UNANSWERED
    answer = None
    answered_at = None
    answered_by = None
