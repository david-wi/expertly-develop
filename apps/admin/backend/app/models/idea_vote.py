"""IdeaVote model for tracking votes on ideas."""

import uuid

from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUID


class IdeaVote(Base, TimestampMixin):
    """Model for tracking votes on ideas."""

    __tablename__ = "idea_votes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    idea_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ideas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_email = Column(String(255), nullable=False)

    # Relationship to Idea
    idea = relationship("Idea", back_populates="votes")

    __table_args__ = (
        UniqueConstraint("idea_id", "user_email", name="uq_idea_vote_user"),
    )

    def __repr__(self) -> str:
        return f"<IdeaVote {self.user_email} on {self.idea_id}>"
