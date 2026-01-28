from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product
    from app.models.artifact_version import ArtifactVersion


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
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
