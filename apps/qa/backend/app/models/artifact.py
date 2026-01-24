"""Artifact model."""
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base
from app.models.base import generate_uuid


class Artifact(Base):
    """Artifact stores files generated during test execution."""

    __tablename__ = "artifacts"

    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    run_id = Column(UUID(as_uuid=False), ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=True)
    result_id = Column(UUID(as_uuid=False), ForeignKey("test_results.id", ondelete="CASCADE"), nullable=True)
    type = Column(String(50), nullable=False)  # screenshot, video, log, api_response, walkthrough
    file_path = Column(String(500), nullable=False)
    artifact_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    run = relationship("TestRun", back_populates="artifacts")
    result = relationship("TestResult", back_populates="artifacts")

    def __repr__(self) -> str:
        return f"<Artifact {self.type} - {self.file_path}>"
