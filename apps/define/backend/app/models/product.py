from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    prefix: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    requirements: Mapped[List["Requirement"]] = relationship(
        "Requirement", back_populates="product", cascade="all, delete-orphan"
    )
    release_snapshots: Mapped[List["ReleaseSnapshot"]] = relationship(
        "ReleaseSnapshot", back_populates="product", cascade="all, delete-orphan"
    )
    jira_settings: Mapped[Optional["JiraSettings"]] = relationship(
        "JiraSettings", back_populates="product", cascade="all, delete-orphan", uselist=False
    )
    jira_story_drafts: Mapped[List["JiraStoryDraft"]] = relationship(
        "JiraStoryDraft", back_populates="product", cascade="all, delete-orphan"
    )


# Import for type hints
from app.models.requirement import Requirement
from app.models.release_snapshot import ReleaseSnapshot
from app.models.jira_settings import JiraSettings
from app.models.jira_story_draft import JiraStoryDraft
