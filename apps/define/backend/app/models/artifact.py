from sqlalchemy import String, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.artifact_version import ArtifactVersion


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    # Flexible context for association (e.g., {"product_id": "uuid"})
    # Apps can use different keys: product_id, walkthrough_id, task_id, etc.
    context: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    # Keep product_id for backward compatibility with existing Define data
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
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

    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="artifacts")
    versions: Mapped[List["ArtifactVersion"]] = relationship(
        "ArtifactVersion", back_populates="artifact", cascade="all, delete-orphan"
    )
