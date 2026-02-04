"""
SQLAlchemy models for artifacts.

Uses a flexible `context` JSON column instead of a fixed foreign key,
allowing artifacts to be associated with any entity type.
"""

from sqlalchemy import String, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase
from typing import Optional, List, Dict, Any, TYPE_CHECKING, Type, Tuple


class Artifact:
    """
    Artifact model mixin.

    Use get_artifact_models() to get concrete model classes bound to your Base.
    """

    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    # Flexible context for association - replaces product_id foreign key
    # Example: {"product_id": "uuid"} or {"walkthrough_id": "uuid"}
    context: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    # Keep product_id for backward compatibility during migration
    product_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    artifact_type: Mapped[str] = mapped_column(String, nullable=False, default="file")  # "file" or "link"
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # For link artifacts
    original_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Nullable for links
    mime_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Nullable for links
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class ArtifactVersion:
    """
    Artifact version model mixin.

    Use get_artifact_models() to get concrete model classes bound to your Base.
    """

    __tablename__ = "artifact_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    artifact_id: Mapped[str] = mapped_column(String, nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    original_storage_path: Mapped[str] = mapped_column(String, nullable=False)
    markdown_storage_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    markdown_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    conversion_status: Mapped[str] = mapped_column(
        String, nullable=False, default="pending"
    )
    conversion_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)


def get_artifact_models(
    base_class: Type[DeclarativeBase],
    artifact_table_name: str = "artifacts",
    version_table_name: str = "artifact_versions",
) -> Tuple[Type["Artifact"], Type["ArtifactVersion"]]:
    """
    Create concrete Artifact and ArtifactVersion models bound to the given Base class.

    Args:
        base_class: The SQLAlchemy DeclarativeBase to inherit from
        artifact_table_name: Override table name for artifacts (default: "artifacts")
        version_table_name: Override table name for versions (default: "artifact_versions")

    Returns:
        Tuple of (ArtifactModel, ArtifactVersionModel) classes

    Example:
        from app.database import Base
        from artifacts import get_artifact_models

        Artifact, ArtifactVersion = get_artifact_models(Base)
    """
    from sqlalchemy import ForeignKey

    class ConcreteArtifactVersion(base_class):
        __tablename__ = version_table_name

        id: Mapped[str] = mapped_column(String, primary_key=True)
        artifact_id: Mapped[str] = mapped_column(
            String, ForeignKey(f"{artifact_table_name}.id", ondelete="CASCADE"), nullable=False
        )
        version_number: Mapped[int] = mapped_column(Integer, nullable=False)
        original_storage_path: Mapped[str] = mapped_column(String, nullable=False)
        markdown_storage_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
        markdown_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
        size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
        conversion_status: Mapped[str] = mapped_column(
            String, nullable=False, default="pending"
        )
        conversion_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
        change_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
        changed_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
        created_at: Mapped[str] = mapped_column(String, nullable=False)

    class ConcreteArtifact(base_class):
        __tablename__ = artifact_table_name

        id: Mapped[str] = mapped_column(String, primary_key=True)
        context: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
        product_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
        name: Mapped[str] = mapped_column(String, nullable=False)
        description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
        artifact_type: Mapped[str] = mapped_column(String, nullable=False, default="file")
        url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
        original_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)
        mime_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
        current_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
        status: Mapped[str] = mapped_column(String, nullable=False, default="active")
        created_at: Mapped[str] = mapped_column(String, nullable=False)
        updated_at: Mapped[str] = mapped_column(String, nullable=False)
        created_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)

        # Relationship to versions
        versions: Mapped[List["ConcreteArtifactVersion"]] = relationship(
            "ConcreteArtifactVersion",
            back_populates="artifact",
            cascade="all, delete-orphan",
            foreign_keys=[ConcreteArtifactVersion.artifact_id],
        )

    # Add back-reference
    ConcreteArtifactVersion.artifact = relationship(
        "ConcreteArtifact", back_populates="versions"
    )

    return ConcreteArtifact, ConcreteArtifactVersion
