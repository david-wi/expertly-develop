"""Idea service for business logic."""

from typing import Optional, List
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idea import Idea, IdeaStatus
from app.models.idea_vote import IdeaVote
from app.models.idea_comment import IdeaComment
from app.schemas.idea import IdeaCreate, IdeaUpdate, IdeaBulkUpdateItem


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

    async def bulk_update_ideas(
        self,
        idea_ids: List[UUID],
        updates: IdeaBulkUpdateItem,
    ) -> List[UUID]:
        """Bulk update multiple ideas."""
        updated_ids = []

        for idea_id in idea_ids:
            idea = await self.get_idea(idea_id)
            if not idea:
                continue

            if updates.status:
                idea.status = updates.status.value
            if updates.priority:
                idea.priority = updates.priority.value
            if updates.tags_to_add:
                existing_tags = idea.tags or []
                # Add new tags without duplicates
                for tag in updates.tags_to_add:
                    if tag not in existing_tags:
                        existing_tags.append(tag)
                idea.tags = existing_tags

            updated_ids.append(idea_id)

        await self.db.flush()
        return updated_ids

    async def toggle_vote(self, idea_id: UUID, user_email: str) -> Optional[tuple[int, bool]]:
        """Toggle vote on an idea. Returns (vote_count, user_voted) or None if idea not found."""
        idea = await self.get_idea(idea_id)
        if not idea:
            return None

        # Check if user has already voted
        query = select(IdeaVote).where(
            and_(IdeaVote.idea_id == idea_id, IdeaVote.user_email == user_email)
        )
        result = await self.db.execute(query)
        existing_vote = result.scalar_one_or_none()

        if existing_vote:
            # Remove vote
            await self.db.delete(existing_vote)
            idea.vote_count = max(0, (idea.vote_count or 0) - 1)
            user_voted = False
        else:
            # Add vote
            vote = IdeaVote(idea_id=idea_id, user_email=user_email)
            self.db.add(vote)
            idea.vote_count = (idea.vote_count or 0) + 1
            user_voted = True

        await self.db.flush()
        return (idea.vote_count, user_voted)

    async def has_user_voted(self, idea_id: UUID, user_email: str) -> bool:
        """Check if user has voted on an idea."""
        query = select(IdeaVote).where(
            and_(IdeaVote.idea_id == idea_id, IdeaVote.user_email == user_email)
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def get_comment_count(self, idea_id: UUID) -> int:
        """Get the number of comments on an idea."""
        from sqlalchemy import func
        query = select(func.count(IdeaComment.id)).where(IdeaComment.idea_id == idea_id)
        result = await self.db.execute(query)
        return result.scalar() or 0

    async def get_comments(self, idea_id: UUID) -> List[IdeaComment]:
        """Get all comments for an idea."""
        query = select(IdeaComment).where(
            IdeaComment.idea_id == idea_id
        ).order_by(IdeaComment.created_at.asc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def add_comment(
        self, idea_id: UUID, author_email: str, content: str
    ) -> Optional[IdeaComment]:
        """Add a comment to an idea."""
        idea = await self.get_idea(idea_id)
        if not idea:
            return None

        comment = IdeaComment(
            idea_id=idea_id,
            author_email=author_email,
            content=content,
        )
        self.db.add(comment)
        await self.db.flush()
        await self.db.refresh(comment)
        return comment

    async def delete_comment(
        self, comment_id: UUID, user_email: str
    ) -> bool:
        """Delete a comment (only if user is the author)."""
        query = select(IdeaComment).where(IdeaComment.id == comment_id)
        result = await self.db.execute(query)
        comment = result.scalar_one_or_none()

        if not comment:
            return False

        if comment.author_email != user_email:
            return False

        await self.db.delete(comment)
        await self.db.flush()
        return True
