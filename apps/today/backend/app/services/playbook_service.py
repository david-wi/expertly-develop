"""Playbook matching and management service."""

from uuid import UUID
from typing import Optional, List, Tuple
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.models import Playbook, Log
from app.models.playbook import PlaybookStatus
from app.models.log import LogActor
from app.schemas.playbook import (
    PlaybookCreate,
    PlaybookPropose,
    PlaybookUpdate,
    PlaybookMatchResult,
    MustConsultWarning,
)


class PlaybookService:
    """Service for playbook operations and matching."""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def get_playbook(self, playbook_id: UUID) -> Optional[Playbook]:
        """Get a playbook by ID."""
        result = await self.db.execute(
            select(Playbook).where(
                and_(
                    Playbook.id == playbook_id,
                    Playbook.tenant_id == self.tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_playbooks(
        self,
        category: Optional[str] = None,
        must_consult: Optional[bool] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Playbook]:
        """List playbooks with optional filters."""
        query = select(Playbook).where(Playbook.tenant_id == self.tenant_id)

        if category:
            query = query.where(Playbook.category == category)
        if must_consult is not None:
            query = query.where(Playbook.must_consult == must_consult)
        if status:
            query = query.where(Playbook.status == status)
        else:
            # Default to active playbooks
            query = query.where(Playbook.status == PlaybookStatus.ACTIVE)

        query = query.order_by(Playbook.name)
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_playbook(self, data: PlaybookCreate) -> Playbook:
        """Create a new playbook."""
        playbook = Playbook(
            tenant_id=self.tenant_id,
            name=data.name,
            description=data.description,
            category=data.category,
            triggers=data.triggers,
            must_consult=data.must_consult,
            content=data.content,
            learned_from=data.learned_from,
            source_task_id=data.source_task_id,
            status=PlaybookStatus.ACTIVE,
        )
        self.db.add(playbook)
        await self.db.flush()

        await self._log_action("playbook.created", "playbook", playbook.id)

        return playbook

    async def propose_playbook(self, data: PlaybookPropose) -> Playbook:
        """Create a proposed playbook for review."""
        playbook = Playbook(
            tenant_id=self.tenant_id,
            name=data.name,
            description=data.description,
            category=data.category,
            triggers=data.triggers,
            content=data.content,
            learned_from=data.learned_from,
            source_task_id=data.source_task_id,
            status=PlaybookStatus.PROPOSED,
        )
        self.db.add(playbook)
        await self.db.flush()

        await self._log_action("playbook.proposed", "playbook", playbook.id)

        return playbook

    async def update_playbook(self, playbook_id: UUID, data: PlaybookUpdate) -> Optional[Playbook]:
        """Update a playbook."""
        playbook = await self.get_playbook(playbook_id)
        if not playbook:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(playbook, field, value)

        await self.db.flush()
        await self._log_action("playbook.updated", "playbook", playbook_id)

        return playbook

    async def approve_playbook(self, playbook_id: UUID) -> Optional[Playbook]:
        """Approve a proposed playbook."""
        playbook = await self.get_playbook(playbook_id)
        if not playbook:
            return None

        if playbook.status != PlaybookStatus.PROPOSED:
            raise ValueError(f"Playbook is not in proposed status")

        playbook.status = PlaybookStatus.ACTIVE
        await self.db.flush()

        await self._log_action("playbook.approved", "playbook", playbook_id)

        return playbook

    async def archive_playbook(self, playbook_id: UUID) -> Optional[Playbook]:
        """Archive a playbook."""
        playbook = await self.get_playbook(playbook_id)
        if not playbook:
            return None

        playbook.status = PlaybookStatus.ARCHIVED
        await self.db.flush()

        await self._log_action("playbook.archived", "playbook", playbook_id)

        return playbook

    async def delete_playbook(self, playbook_id: UUID) -> bool:
        """Delete a playbook permanently."""
        playbook = await self.get_playbook(playbook_id)
        if not playbook:
            return False

        await self._log_action("playbook.deleted", "playbook", playbook_id)
        await self.db.delete(playbook)
        await self.db.flush()

        return True

    async def match_playbooks(
        self,
        task_description: str,
    ) -> Tuple[List[PlaybookMatchResult], List[MustConsultWarning]]:
        """
        Match playbooks to a task description.

        Returns matched playbooks and must_consult warnings.
        """
        # Get all active playbooks
        result = await self.db.execute(
            select(Playbook).where(
                and_(
                    Playbook.tenant_id == self.tenant_id,
                    Playbook.status == PlaybookStatus.ACTIVE,
                )
            )
        )
        playbooks = result.scalars().all()

        matched: List[PlaybookMatchResult] = []
        must_consult_warnings: List[MustConsultWarning] = []
        task_lower = task_description.lower()

        for playbook in playbooks:
            is_matched, match_reason, score = self._check_match(playbook, task_lower)

            if is_matched:
                matched.append(PlaybookMatchResult(
                    id=playbook.id,
                    name=playbook.name,
                    must_consult=playbook.must_consult,
                    match_reason=match_reason,
                    relevance_score=score,
                    content_preview=playbook.content[:200] + "..." if len(playbook.content) > 200 else playbook.content,
                ))

                # Record usage
                playbook.record_use()
                await self.db.flush()

            # Check must_consult regardless of match
            elif playbook.must_consult:
                # Check if this playbook's category might be relevant
                if self._might_be_relevant(playbook, task_lower):
                    must_consult_warnings.append(MustConsultWarning(
                        playbook_name=playbook.name,
                        playbook_id=playbook.id,
                        warning=f"MUST consult '{playbook.name}' for {playbook.category or 'this type of'} tasks",
                    ))

        # Sort matched by relevance score
        matched.sort(key=lambda x: -x.relevance_score)

        return matched, must_consult_warnings

    def _check_match(
        self,
        playbook: Playbook,
        task_lower: str,
    ) -> Tuple[bool, str, float]:
        """
        Check if a playbook matches a task.

        Returns (is_matched, reason, score).
        """
        # Check trigger phrases (exact match = high score)
        for trigger in playbook.triggers:
            if trigger.lower() in task_lower:
                return True, f"trigger: '{trigger}'", 1.0

        # Check description keywords (lower score)
        description_words = set(playbook.description.lower().split())
        task_words = set(task_lower.split())
        common_words = description_words & task_words
        # Filter out common words
        common_words -= {"the", "a", "an", "to", "for", "and", "or", "in", "on", "at", "is", "it"}

        if len(common_words) >= 2:
            score = min(len(common_words) / 5, 0.8)  # Cap at 0.8 for keyword matches
            return True, f"keywords: {', '.join(list(common_words)[:3])}", score

        # Check category match
        if playbook.category:
            category_keywords = {
                "communication": ["email", "message", "draft", "reply", "send"],
                "scheduling": ["schedule", "meeting", "calendar", "appointment", "time"],
                "sales": ["proposal", "pitch", "demo", "contract", "deal"],
                "technical": ["code", "deploy", "fix", "bug", "implement"],
            }
            keywords = category_keywords.get(playbook.category, [])
            if any(kw in task_lower for kw in keywords):
                return True, f"category: {playbook.category}", 0.6

        return False, "", 0.0

    def _might_be_relevant(self, playbook: Playbook, task_lower: str) -> bool:
        """Check if a must_consult playbook might be relevant."""
        # Use category keywords to determine relevance
        category_keywords = {
            "communication": ["email", "message", "draft", "reply", "send", "write"],
            "scheduling": ["schedule", "meeting", "calendar", "appointment", "time", "invite"],
        }
        keywords = category_keywords.get(playbook.category, [])
        return any(kw in task_lower for kw in keywords)

    async def get_must_consult_playbooks(self) -> List[Playbook]:
        """Get all must_consult playbooks."""
        result = await self.db.execute(
            select(Playbook).where(
                and_(
                    Playbook.tenant_id == self.tenant_id,
                    Playbook.must_consult == True,
                    Playbook.status == PlaybookStatus.ACTIVE,
                )
            )
        )
        return list(result.scalars().all())

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
            actor=LogActor.CLAUDE,
            details=details or {},
        )
        self.db.add(log)
