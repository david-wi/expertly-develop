"""Idea service for business logic."""

from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idea import Idea, IdeaStatus
from app.schemas.idea import IdeaCreate, IdeaUpdate


class IdeaService:
    """Service class for idea operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_idea(self, data: IdeaCreate) -> Idea:
        """Create a new idea."""
        idea = Idea(
            product=data.product,
            title=data.title,
            description=data.description,
            status=data.status.value,
            priority=data.priority.value,
            tags=data.tags or [],
            created_by_email=data.created_by_email,
        )

        self.db.add(idea)
        await self.db.flush()
        await self.db.refresh(idea)

        return idea

    async def get_ideas(
        self,
        product: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        include_archived: bool = False,
    ) -> List[Idea]:
        """List ideas with filters."""
        conditions = []
        if product:
            conditions.append(Idea.product == product)
        if status:
            conditions.append(Idea.status == status)
        if priority:
            conditions.append(Idea.priority == priority)
        if not include_archived:
            conditions.append(Idea.status != IdeaStatus.ARCHIVED.value)

        query = select(Idea)
        if conditions:
            query = query.where(and_(*conditions))
        query = query.order_by(Idea.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_idea(self, idea_id: UUID) -> Optional[Idea]:
        """Get a single idea by ID."""
        query = select(Idea).where(Idea.id == idea_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def update_idea(
        self,
        idea_id: UUID,
        data: IdeaUpdate,
    ) -> Optional[Idea]:
        """Update an idea."""
        idea = await self.get_idea(idea_id)
        if not idea:
            return None

        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == 'status' and value:
                value = value.value
            elif field == 'priority' and value:
                value = value.value
            setattr(idea, field, value)

        await self.db.flush()
        await self.db.refresh(idea)

        return idea

    async def delete_idea(self, idea_id: UUID) -> bool:
        """Delete an idea."""
        idea = await self.get_idea(idea_id)
        if not idea:
            return False

        await self.db.delete(idea)
        await self.db.flush()
        return True

    async def get_products_with_ideas(self) -> List[str]:
        """Get list of products that have ideas."""
        query = select(Idea.product).distinct().order_by(Idea.product)
        result = await self.db.execute(query)
        return [row[0] for row in result.fetchall()]
