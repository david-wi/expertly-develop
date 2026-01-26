from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.requirement import Requirement


class JiraStoryDraft(Base):
    __tablename__ = "jira_story_drafts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    requirement_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True
    )
    summary: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issue_type: Mapped[str] = mapped_column(String, nullable=False, default="Story")
    priority: Mapped[str] = mapped_column(String, nullable=False, default="Medium")
    labels: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    story_points: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    jira_issue_key: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    jira_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    product: Mapped["Product"] = relationship(
        "Product", back_populates="jira_story_drafts"
    )
    requirement: Mapped[Optional["Requirement"]] = relationship(
        "Requirement", back_populates="jira_story_drafts"
    )
