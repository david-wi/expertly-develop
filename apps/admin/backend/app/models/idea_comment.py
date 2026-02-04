"""IdeaComment model for tracking comments on ideas."""

import uuid

from sqlalchemy import Column, String, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, UUID


class IdeaComment(Base, TimestampMixin):
    """Model for comments on ideas."""

    __tablename__ = "idea_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    idea_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ideas.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_email = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)

    # Relationship to Idea
    idea = relationship("Idea", back_populates="comments")

    __table_args__ = (
        Index("ix_idea_comments_idea_id", "idea_id"),
    )

    def __repr__(self) -> str:
        return f"<IdeaComment by {self.author_email} on {self.idea_id}>"
