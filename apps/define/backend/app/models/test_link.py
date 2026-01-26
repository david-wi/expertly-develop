from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.requirement import Requirement


class TestLink(Base):
    __tablename__ = "test_links"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    requirement_id: Mapped[str] = mapped_column(
        String, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    test_path: Mapped[str] = mapped_column(String, nullable=False)
    test_type: Mapped[str] = mapped_column(String, nullable=False, default="unit")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="not_run")
    last_run_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    requirement: Mapped["Requirement"] = relationship(
        "Requirement", back_populates="test_links"
    )
