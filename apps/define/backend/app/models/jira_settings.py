from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.product import Product


class JiraSettings(Base):
    __tablename__ = "jira_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    jira_host: Mapped[str] = mapped_column(String, nullable=False)
    jira_email: Mapped[str] = mapped_column(String, nullable=False)
    jira_api_token: Mapped[str] = mapped_column(String, nullable=False)
    default_project_key: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    product: Mapped["Product"] = relationship(
        "Product", back_populates="jira_settings"
    )
