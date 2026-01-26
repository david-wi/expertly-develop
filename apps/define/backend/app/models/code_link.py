from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.requirement import Requirement


class CodeLink(Base):
    __tablename__ = "code_links"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    requirement_id: Mapped[str] = mapped_column(
        String, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="up_to_date")
    last_checked_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    requirement: Mapped["Requirement"] = relationship(
        "Requirement", back_populates="code_links"
    )
