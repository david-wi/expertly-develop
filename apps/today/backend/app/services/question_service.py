"""Question business logic service."""

from uuid import UUID
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models import Question, Task, QuestionUnblock, Log
from app.models.question import QuestionStatus
from app.models.task import TaskStatus
from app.models.log import LogActor
from app.schemas.question import QuestionCreate, QuestionAnswer


class QuestionService:
    """Service for question operations."""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def get_question(self, question_id: UUID) -> Optional[Question]:
        """Get a question by ID."""
        result = await self.db.execute(
            select(Question).where(
                and_(
                    Question.id == question_id,
                    Question.tenant_id == self.tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_questions(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Question]:
        """List questions with optional filters."""
        query = select(Question).where(Question.tenant_id == self.tenant_id)

        if status:
            query = query.where(Question.status == status)

        # Unanswered first, then by priority
        query = query.order_by(
            (Question.status == QuestionStatus.UNANSWERED).desc(),
            Question.priority.asc(),
            Question.created_at.desc(),
        )
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_unanswered_questions(self, limit: int = 50) -> List[Question]:
        """Get unanswered questions prioritized."""
        return await self.list_questions(status=QuestionStatus.UNANSWERED, limit=limit)

    async def create_question(self, data: QuestionCreate) -> Question:
        """Create a new question."""
        question = Question(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            text=data.text,
            context=data.context,
            why_asking=data.why_asking,
            what_claude_will_do=data.what_claude_will_do,
            priority=data.priority,
            status=QuestionStatus.UNANSWERED,
        )
        self.db.add(question)
        await self.db.flush()

        # Link to tasks if provided
        for task_id in data.task_ids:
            unblock = QuestionUnblock(question_id=question.id, task_id=task_id)
            self.db.add(unblock)

        await self._log_action("question.created", "question", question.id)

        return question

    async def answer_question(
        self,
        question_id: UUID,
        data: QuestionAnswer,
        answered_by: str = "user",
    ) -> tuple[Optional[Question], List[UUID]]:
        """
        Answer a question and unblock related tasks.

        Returns the question and list of unblocked task IDs.
        """
        question = await self.get_question(question_id)
        if not question:
            return None, []

        # Answer the question
        question.answer_question(data.answer, answered_by)
        await self.db.flush()

        # Find and unblock tasks
        result = await self.db.execute(
            select(QuestionUnblock.task_id).where(
                QuestionUnblock.question_id == question_id
            )
        )
        task_ids = [row[0] for row in result.all()]

        unblocked_task_ids = []
        for task_id in task_ids:
            task_result = await self.db.execute(
                select(Task).where(
                    and_(
                        Task.id == task_id,
                        Task.tenant_id == self.tenant_id,
                        Task.status == TaskStatus.BLOCKED,
                        Task.blocking_question_id == question_id,
                    )
                )
            )
            task = task_result.scalar_one_or_none()
            if task:
                task.unblock()
                unblocked_task_ids.append(task.id)

        await self.db.flush()

        await self._log_action(
            "question.answered",
            "question",
            question.id,
            {"unblocked_task_ids": [str(tid) for tid in unblocked_task_ids]},
        )

        return question, unblocked_task_ids

    async def dismiss_question(
        self,
        question_id: UUID,
        reason: Optional[str] = None,
    ) -> Optional[Question]:
        """Dismiss a question without answering."""
        question = await self.get_question(question_id)
        if not question:
            return None

        question.dismiss(reason)
        await self.db.flush()

        await self._log_action("question.dismissed", "question", question.id, {"reason": reason})

        return question

    async def _log_action(
        self,
        action: str,
        entity_type: str,
        entity_id: UUID,
        details: dict = None,
    ) -> None:
        """Create an audit log entry."""
        log = Log.create(
            tenant_id=self.tenant_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=self.user_id,
            actor=LogActor.USER,
            details=details or {},
        )
        self.db.add(log)
