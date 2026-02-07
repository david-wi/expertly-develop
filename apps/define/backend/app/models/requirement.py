from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.requirement_version import RequirementVersion
    from app.models.code_link import CodeLink
    from app.models.test_link import TestLink
    from app.models.delivery_link import DeliveryLink
    from app.models.attachment import Attachment
    from app.models.jira_story_draft import JiraStoryDraft


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=True
    )
    stable_key: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    node_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    what_this_does: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    why_this_exists: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    not_included: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acceptance_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    deleted_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="requirements")
    parent: Mapped[Optional["Requirement"]] = relationship(
        "Requirement", remote_side=[id], back_populates="children"
    )
    children: Mapped[List["Requirement"]] = relationship(
        "Requirement", back_populates="parent", cascade="all, delete-orphan"
    )
    versions: Mapped[List["RequirementVersion"]] = relationship(
        "RequirementVersion", back_populates="requirement", cascade="all, delete-orphan"
    )
    code_links: Mapped[List["CodeLink"]] = relationship(
        "CodeLink", back_populates="requirement", cascade="all, delete-orphan"
    )
    test_links: Mapped[List["TestLink"]] = relationship(
        "TestLink", back_populates="requirement", cascade="all, delete-orphan"
    )
    delivery_links: Mapped[List["DeliveryLink"]] = relationship(
        "DeliveryLink", back_populates="requirement", cascade="all, delete-orphan"
    )
    attachments: Mapped[List["Attachment"]] = relationship(
        "Attachment", back_populates="requirement", cascade="all, delete-orphan"
    )
    jira_story_drafts: Mapped[List["JiraStoryDraft"]] = relationship(
        "JiraStoryDraft", back_populates="requirement"
    )
