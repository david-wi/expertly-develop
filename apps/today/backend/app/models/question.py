"""Question model - blocking items requiring human input."""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, CheckConstraint, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.base import Base, TimestampMixin, UUID


class QuestionStatus:
    """Question status constants."""
    UNANSWERED = "unanswered"
    ANSWERED = "answered"
    DISMISSED = "dismissed"

    ALL = [UNANSWERED, ANSWERED, DISMISSED]


class QuestionPriority:
    """Question priority reasons."""
    HIGH_IMPACT = "high_impact"
    BLOCKING_MULTIPLE = "blocking_multiple"
    TIME_SENSITIVE = "time_sensitive"


# Association table for questions that unblock tasks
class QuestionUnblock(Base):
    """Links questions to the tasks they unblock."""

    __tablename__ = "question_unblocks"

    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )


class Question(Base, TimestampMixin):
    """
    Question represents something blocking progress that requires human input.

    Includes context about why Claude is asking and what it will do with the answer.
    """

    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # The question itself
    text = Column(Text, nullable=False)
    context = Column(Text, nullable=True)

    # Why this matters
    why_asking = Column(Text, nullable=True)
    what_claude_will_do = Column(Text, nullable=True)

    # Priority & Status
    priority = Column(Integer, default=3, nullable=False)
    priority_reason = Column(String(50), nullable=True)
    status = Column(String(50), default=QuestionStatus.UNANSWERED, nullable=False)

    # Answer
    answer = Column(Text, nullable=True)
    answered_at = Column(String(50), nullable=True)
    answered_by = Column(String(50), nullable=True)  # 'user' or 'claude'

    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User", back_populates="questions")
    unblocks_tasks = relationship(
        "Task",
        secondary="question_unblocks",
        backref="blocking_questions",
    )

    __table_args__ = (
        CheckConstraint(f"priority >= 1 AND priority <= 5", name="ck_question_priority"),
        CheckConstraint(f"status IN {tuple(QuestionStatus.ALL)}", name="ck_question_status"),
    )

    def __repr__(self) -> str:
        return f"<Question {self.text[:30]}... ({self.status})>"

    def answer_question(self, answer: str, answered_by: str = "user") -> None:
        """Record an answer to this question."""
        if self.status != QuestionStatus.UNANSWERED:
            raise ValueError(f"Cannot answer question in {self.status} status")
        self.answer = answer
        self.answered_at = datetime.now(timezone.utc).isoformat()
        self.answered_by = answered_by
        self.status = QuestionStatus.ANSWERED

    def dismiss(self, reason: str = None) -> None:
        """Dismiss the question without answering."""
        if self.status != QuestionStatus.UNANSWERED:
            raise ValueError(f"Cannot dismiss question in {self.status} status")
        self.status = QuestionStatus.DISMISSED
        if reason:
            self.context = f"{self.context or ''}\n\nDismissed: {reason}".strip()
