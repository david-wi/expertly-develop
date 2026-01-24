"""Task model - the core work unit."""

from sqlalchemy import Column, String, Text, Integer, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB, StringArray


class TaskStatus:
    """Task status constants."""
    QUEUED = "queued"
    WORKING = "working"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    ALL = [QUEUED, WORKING, BLOCKED, COMPLETED, CANCELLED]


class TaskAssignee:
    """Task assignee constants."""
    CLAUDE = "claude"
    USER = "user"

    ALL = [CLAUDE, USER]


class Task(Base, TimestampMixin):
    """
    Task represents a unit of work to be done.

    State machine:
    - queued → working → completed
    - queued → working → blocked → (unblocked) → queued
    - Any state → cancelled
    """

    __tablename__ = "tasks"

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
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Core fields
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(Integer, default=3, nullable=False)
    status = Column(String(50), default=TaskStatus.QUEUED, nullable=False)
    assignee = Column(String(50), default=TaskAssignee.CLAUDE, nullable=False)

    # Timing
    due_date = Column(String(50), nullable=True)  # Using string for flexibility
    started_at = Column(String(50), nullable=True)
    completed_at = Column(String(50), nullable=True)

    # Blocking
    blocking_question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Context & Output
    context = Column(JSONB, default=dict, nullable=False)
    output = Column(Text, nullable=True)

    # Metadata
    source = Column(String(100), nullable=True)  # manual, recurring, claude
    tags = Column(StringArray, default=list, nullable=False)

    # Worker tracking (for multi-agent support)
    worker_id = Column(String(100), nullable=True)  # ID of bot/agent working on this

    # Relationships
    tenant = relationship("Tenant")
    creator = relationship("User", back_populates="tasks", foreign_keys=[user_id])
    project = relationship("Project", back_populates="tasks")
    blocking_question = relationship("Question", foreign_keys=[blocking_question_id])
    drafts = relationship("Draft", back_populates="task")
    people = relationship("TaskPerson", back_populates="task", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(f"priority >= 1 AND priority <= 5", name="ck_task_priority"),
        CheckConstraint(f"status IN {tuple(TaskStatus.ALL)}", name="ck_task_status"),
        CheckConstraint(f"assignee IN {tuple(TaskAssignee.ALL)}", name="ck_task_assignee"),
    )

    def __repr__(self) -> str:
        return f"<Task {self.title[:30]}... ({self.status})>"

    def can_transition_to(self, new_status: str) -> bool:
        """Check if transition to new_status is valid."""
        valid_transitions = {
            TaskStatus.QUEUED: [TaskStatus.WORKING, TaskStatus.CANCELLED],
            TaskStatus.WORKING: [TaskStatus.COMPLETED, TaskStatus.BLOCKED, TaskStatus.CANCELLED],
            TaskStatus.BLOCKED: [TaskStatus.QUEUED, TaskStatus.CANCELLED],
            TaskStatus.COMPLETED: [],  # Terminal state
            TaskStatus.CANCELLED: [],  # Terminal state
        }
        return new_status in valid_transitions.get(self.status, [])

    def start(self) -> None:
        """Mark task as working."""
        if not self.can_transition_to(TaskStatus.WORKING):
            raise ValueError(f"Cannot start task in {self.status} status")
        self.status = TaskStatus.WORKING
        self.started_at = datetime.now(timezone.utc).isoformat()

    def complete(self, output: str = None) -> None:
        """Mark task as completed."""
        if not self.can_transition_to(TaskStatus.COMPLETED):
            raise ValueError(f"Cannot complete task in {self.status} status")
        self.status = TaskStatus.COMPLETED
        self.output = output
        self.completed_at = datetime.now(timezone.utc).isoformat()

    def block(self, question_id: uuid.UUID) -> None:
        """Block task with a question."""
        if not self.can_transition_to(TaskStatus.BLOCKED):
            raise ValueError(f"Cannot block task in {self.status} status")
        self.status = TaskStatus.BLOCKED
        self.blocking_question_id = question_id

    def unblock(self) -> None:
        """Unblock task, returning to queued."""
        if self.status != TaskStatus.BLOCKED:
            raise ValueError(f"Cannot unblock task in {self.status} status")
        self.status = TaskStatus.QUEUED
        self.blocking_question_id = None

    def cancel(self) -> None:
        """Cancel task."""
        if not self.can_transition_to(TaskStatus.CANCELLED):
            raise ValueError(f"Cannot cancel task in {self.status} status")
        self.status = TaskStatus.CANCELLED
