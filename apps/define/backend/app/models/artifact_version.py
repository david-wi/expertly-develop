from sqlalchemy import String, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, TYPE_CHECKING
from app.database import Base

if TYPE_CHECKING:
    from app.models.artifact import Artifact


class ArtifactVersion(Base):
    __tablename__ = "artifact_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    artifact_id: Mapped[str] = mapped_column(
        String, ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False
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

    # Relationships
    artifact: Mapped["Artifact"] = relationship("Artifact", back_populates="versions")
