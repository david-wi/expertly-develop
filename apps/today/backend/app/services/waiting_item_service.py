"""WaitingItem business logic service."""

from uuid import UUID
from typing import Optional, List
from datetime import datetime, timezone, date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models import WaitingItem, Log
from app.models.waiting_item import WaitingStatus
from app.models.log import LogActor
from app.schemas.waiting_item import WaitingItemCreate, WaitingItemUpdate


class WaitingItemService:
    """Service for waiting item operations."""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: Optional[UUID] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def get_waiting_item(self, item_id: UUID) -> Optional[WaitingItem]:
        """Get a waiting item by ID."""
        result = await self.db.execute(
            select(WaitingItem).where(
                and_(
                    WaitingItem.id == item_id,
                    WaitingItem.tenant_id == self.tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_waiting_items(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WaitingItem]:
        """List waiting items with optional filters."""
        query = select(WaitingItem).where(WaitingItem.tenant_id == self.tenant_id)

        if status:
            query = query.where(WaitingItem.status == status)

        query = query.order_by(WaitingItem.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_active_waiting_items(self, limit: int = 50) -> List[WaitingItem]:
        """Get active waiting items."""
        return await self.list_waiting_items(status=WaitingStatus.WAITING, limit=limit)

    async def get_overdue_waiting_items(self, limit: int = 50) -> List[WaitingItem]:
        """Get overdue waiting items (past follow_up_date)."""
        today = date.today().isoformat()
        query = (
            select(WaitingItem)
            .where(
                and_(
                    WaitingItem.tenant_id == self.tenant_id,
                    WaitingItem.status == WaitingStatus.WAITING,
                    WaitingItem.follow_up_date != None,
                    WaitingItem.follow_up_date < today,
                )
            )
            .order_by(WaitingItem.follow_up_date.asc())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create_waiting_item(self, data: WaitingItemCreate) -> WaitingItem:
        """Create a new waiting item."""
        item = WaitingItem(
            tenant_id=self.tenant_id,
            what=data.what,
            who=data.who,
            follow_up_date=data.follow_up_date,
            why_it_matters=data.why_it_matters,
            task_id=data.task_id,
            person_id=data.person_id,
            status=WaitingStatus.WAITING,
            since=data.since if data.since else datetime.now(timezone.utc).isoformat(),
        )
        self.db.add(item)
        await self.db.flush()

        await self._log_action("waiting_item.created", "waiting_item", item.id)
        return item

    async def update_waiting_item(
        self, item_id: UUID, data: WaitingItemUpdate
    ) -> Optional[WaitingItem]:
        """Update a waiting item."""
        item = await self.get_waiting_item(item_id)
        if not item:
            return None

        if item.status != WaitingStatus.WAITING:
            raise ValueError(f"Cannot update waiting item in {item.status} status")

        if data.what is not None:
            item.what = data.what
        if data.who is not None:
            item.who = data.who
        if data.follow_up_date is not None:
            item.follow_up_date = data.follow_up_date
        if data.why_it_matters is not None:
            item.why_it_matters = data.why_it_matters

        await self.db.flush()
        await self._log_action("waiting_item.updated", "waiting_item", item.id)
        return item

    async def resolve_waiting_item(
        self, item_id: UUID, resolution_notes: Optional[str] = None
    ) -> Optional[WaitingItem]:
        """Resolve a waiting item."""
        item = await self.get_waiting_item(item_id)
        if not item:
            return None

        if item.status != WaitingStatus.WAITING:
            raise ValueError(f"Cannot resolve waiting item in {item.status} status")

        item.status = WaitingStatus.RESOLVED
        item.resolved_at = datetime.now(timezone.utc).isoformat()
        item.resolution_notes = resolution_notes

        await self.db.flush()
        await self._log_action("waiting_item.resolved", "waiting_item", item.id, {"notes": resolution_notes})
        return item

    async def delete_waiting_item(self, item_id: UUID) -> bool:
        """Delete a waiting item."""
        item = await self.get_waiting_item(item_id)
        if not item:
            return False

        await self._log_action("waiting_item.deleted", "waiting_item", item.id)
        await self.db.delete(item)
        await self.db.flush()
        return True

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
