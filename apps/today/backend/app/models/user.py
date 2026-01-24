"""User model."""

from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, generate_api_key, UUID, JSONB


class User(Base, TimestampMixin):
    """User belongs to a tenant and can have tasks assigned."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    api_key = Column(String(64), unique=True, nullable=False, default=generate_api_key)
    role = Column(String(50), default="member", nullable=False)
    settings = Column(JSONB, default=dict, nullable=False)
    timezone = Column(String(50), default="UTC", nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    tasks = relationship("Task", back_populates="creator", foreign_keys="Task.user_id")
    questions = relationship("Question", back_populates="user")
    drafts = relationship("Draft", back_populates="user")
    logs = relationship("Log", back_populates="user")

    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"
