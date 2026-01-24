"""Project model - also used for initiatives and goals."""

from sqlalchemy import Column, String, Text, Integer, Date, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class Project(Base, TimestampMixin):
    """
    Project represents a grouping of related work.

    project_type distinguishes:
    - 'project': Concrete deliverable (Liberty Hotel implementation)
    - 'initiative': Strategic effort (10x dev velocity)
    - 'goal': Outcome target (increase revenue 20%)
    """

    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Type: project, initiative, goal
    project_type = Column(String(50), default="project", nullable=False)

    # Status: active, on_hold, completed, archived
    status = Column(String(50), default="active", nullable=False)
    priority_order = Column(Integer, default=0, nullable=False)

    # For initiatives/goals
    success_criteria = Column(Text, nullable=True)
    target_date = Column(Date, nullable=True)

    # Hierarchy: parent project/initiative
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )

    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="projects")
    tasks = relationship("Task", back_populates="project")
    parent = relationship("Project", remote_side=[id], backref="children")

    def __repr__(self) -> str:
        return f"<Project {self.name} ({self.project_type})>"
