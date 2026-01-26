from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product


class ReleaseSnapshot(Base):
    __tablename__ = "release_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    version_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requirements_snapshot: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    stats: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    released_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    product: Mapped["Product"] = relationship(
        "Product", back_populates="release_snapshots"
    )
