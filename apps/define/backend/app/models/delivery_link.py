from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.requirement import Requirement


class DeliveryLink(Base):
    __tablename__ = "delivery_links"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    requirement_id: Mapped[str] = mapped_column(
        String, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String, nullable=False)
    external_system: Mapped[str] = mapped_column(String, nullable=False, default="jira")
    intent: Mapped[str] = mapped_column(String, nullable=False, default="implements")
    title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    requirement: Mapped["Requirement"] = relationship(
        "Requirement", back_populates="delivery_links"
    )
