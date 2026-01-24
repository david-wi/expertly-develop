"""Draft business logic service."""

from uuid import UUID
from typing import Optional, List
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models import Draft, Log
from app.models.draft import DraftStatus
from app.models.log import LogActor
from app.schemas.draft import DraftCreate, DraftUpdate


class DraftService:
    """Service for draft operations."""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def get_draft(self, draft_id: UUID) -> Optional[Draft]:
        """Get a draft by ID."""
        result = await self.db.execute(
            select(Draft).where(
                and_(
                    Draft.id == draft_id,
                    Draft.tenant_id == self.tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_drafts(
        self,
        status: Optional[str] = None,
        draft_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Draft]:
        """List drafts with optional filters."""
        query = select(Draft).where(Draft.tenant_id == self.tenant_id)

        if status:
            query = query.where(Draft.status == status)
        if draft_type:
            query = query.where(Draft.type == draft_type)

        query = query.order_by(Draft.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_pending_drafts(self, limit: int = 50) -> List[Draft]:
        """Get pending drafts for review."""
        return await self.list_drafts(status=DraftStatus.PENDING, limit=limit)

    async def create_draft(self, data: DraftCreate) -> Draft:
        """Create a new draft."""
        draft = Draft(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            type=data.type,
            recipient=data.recipient,
            subject=data.subject,
            body=data.body,
            task_id=data.task_id,
            relationship_context=data.relationship_context,
            status=DraftStatus.PENDING,
        )
        self.db.add(draft)
        await self.db.flush()

        await self._log_action("draft.created", "draft", draft.id)
        return draft

    async def update_draft(
        self, draft_id: UUID, data: DraftUpdate
    ) -> Optional[Draft]:
        """Update a draft."""
        draft = await self.get_draft(draft_id)
        if not draft:
            return None

        if draft.status != DraftStatus.PENDING:
            raise ValueError(f"Cannot update draft in {draft.status} status")

        if data.recipient is not None:
            draft.recipient = data.recipient
        if data.subject is not None:
            draft.subject = data.subject
        if data.body is not None:
            draft.body = data.body

        await self.db.flush()
        await self._log_action("draft.updated", "draft", draft.id)
        return draft

    async def approve_draft(
        self, draft_id: UUID, feedback: Optional[str] = None
    ) -> Optional[Draft]:
        """Approve a draft."""
        draft = await self.get_draft(draft_id)
        if not draft:
            return None

        if draft.status != DraftStatus.PENDING:
            raise ValueError(f"Cannot approve draft in {draft.status} status")

        draft.status = DraftStatus.APPROVED
        draft.feedback = feedback
        draft.approved_at = datetime.now(timezone.utc).isoformat()

        await self.db.flush()
        await self._log_action("draft.approved", "draft", draft.id, {"feedback": feedback})
        return draft

    async def reject_draft(
        self, draft_id: UUID, feedback: str
    ) -> Optional[Draft]:
        """Reject a draft with feedback."""
        draft = await self.get_draft(draft_id)
        if not draft:
            return None

        if draft.status != DraftStatus.PENDING:
            raise ValueError(f"Cannot reject draft in {draft.status} status")

        draft.status = DraftStatus.REJECTED
        draft.feedback = feedback

        await self.db.flush()
        await self._log_action("draft.rejected", "draft", draft.id, {"feedback": feedback})
        return draft

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
