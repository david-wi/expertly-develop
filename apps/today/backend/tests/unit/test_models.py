"""Unit tests for model methods and validation."""

import pytest
from uuid import uuid4
from datetime import datetime, timezone

from app.models import Task, Question, Playbook
from app.models.task import TaskStatus
from app.models.question import QuestionStatus
from app.models.playbook import PlaybookStatus


class TestTaskModel:
    """Tests for Task model methods."""

    def test_task_can_start_from_queued(self):
        """Task can be started from queued status."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.QUEUED,
        )
        task.start()
        assert task.status == TaskStatus.WORKING
        assert task.started_at is not None

    def test_task_cannot_start_from_completed(self):
        """Task cannot be started from completed status."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.COMPLETED,
        )
        with pytest.raises(ValueError, match="Cannot start"):
            task.start()

    def test_task_cannot_start_from_cancelled(self):
        """Task cannot be started from cancelled status."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.CANCELLED,
        )
        with pytest.raises(ValueError, match="Cannot start"):
            task.start()

    def test_task_can_complete_from_working(self):
        """Task can be completed from working status."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.WORKING,
        )
        task.complete("Done!")
        assert task.status == TaskStatus.COMPLETED
        assert task.output == "Done!"
        assert task.completed_at is not None

    def test_task_cannot_complete_from_queued(self):
        """Task cannot be completed directly from queued."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.QUEUED,
        )
        with pytest.raises(ValueError, match="Cannot complete"):
            task.complete("Done")

    def test_task_can_block_from_working(self):
        """Task can be blocked from working status."""
        question_id = uuid4()
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.WORKING,
        )
        task.block(question_id)
        assert task.status == TaskStatus.BLOCKED
        assert task.blocking_question_id == question_id

    def test_task_cannot_block_from_queued(self):
        """Task cannot be blocked from queued status."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.QUEUED,
        )
        with pytest.raises(ValueError, match="Cannot block"):
            task.block(uuid4())

    def test_task_unblock_returns_to_queued(self):
        """Unblocking a task returns it to queued status."""
        task = Task(
            id=uuid4(),
            tenant_id=uuid4(),
            title="Test",
            status=TaskStatus.BLOCKED,
            blocking_question_id=uuid4(),
        )
        task.unblock()
        assert task.status == TaskStatus.QUEUED
        assert task.blocking_question_id is None


class TestQuestionModel:
    """Tests for Question model methods."""

    def test_question_can_be_answered(self):
        """Question can be answered when unanswered."""
        question = Question(
            id=uuid4(),
            tenant_id=uuid4(),
            text="Test?",
            status=QuestionStatus.UNANSWERED,
        )
        question.answer_question("Yes!", "user")
        assert question.status == QuestionStatus.ANSWERED
        assert question.answer == "Yes!"
        assert question.answered_by == "user"
        assert question.answered_at is not None

    def test_question_cannot_answer_twice(self):
        """Already answered question cannot be answered again."""
        question = Question(
            id=uuid4(),
            tenant_id=uuid4(),
            text="Test?",
            status=QuestionStatus.ANSWERED,
            answer="First answer",
        )
        with pytest.raises(ValueError, match="Cannot answer"):
            question.answer_question("Second answer", "user")

    def test_question_can_be_dismissed(self):
        """Question can be dismissed when unanswered."""
        question = Question(
            id=uuid4(),
            tenant_id=uuid4(),
            text="Test?",
            status=QuestionStatus.UNANSWERED,
        )
        question.dismiss("Not relevant")
        assert question.status == QuestionStatus.DISMISSED
        assert "Dismissed: Not relevant" in question.context

    def test_question_cannot_dismiss_answered(self):
        """Answered question cannot be dismissed."""
        question = Question(
            id=uuid4(),
            tenant_id=uuid4(),
            text="Test?",
            status=QuestionStatus.ANSWERED,
        )
        with pytest.raises(ValueError, match="Cannot dismiss"):
            question.dismiss("Too late")


class TestPlaybookModel:
    """Tests for Playbook model methods."""

    def test_playbook_record_use(self):
        """record_use increments use_count and sets last_used."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Test",
            description="Test playbook",
            content="Content here",
            use_count=5,
        )
        playbook.record_use()
        assert playbook.use_count == 6
        assert playbook.last_used is not None

    def test_playbook_matches_trigger(self):
        """matches_task returns True for matching triggers."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Email Guide",
            description="How to write emails",
            content="Content",
            triggers=["send email", "write email"],
        )
        matched, reason = playbook.matches_task("Please send email to John")
        assert matched is True
        assert "send email" in reason

    def test_playbook_no_match_for_unrelated_task(self):
        """matches_task returns False for unrelated tasks."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Email Guide",
            description="How to write emails",
            content="Content",
            triggers=["send email"],
        )
        matched, reason = playbook.matches_task("Schedule a meeting")
        assert matched is False
        assert reason == ""

    def test_playbook_trigger_case_insensitive(self):
        """Trigger matching is case insensitive."""
        playbook = Playbook(
            id=uuid4(),
            tenant_id=uuid4(),
            name="Email Guide",
            description="How to write emails",
            content="Content",
            triggers=["Send Email"],
        )
        matched, _ = playbook.matches_task("SEND EMAIL now")
        assert matched is True
