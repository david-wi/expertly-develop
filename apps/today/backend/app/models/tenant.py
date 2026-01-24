"""Tenant model for multi-tenancy support."""

from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class Tenant(Base, TimestampMixin):
    """
    Tenant represents an organization/account.

    Supports future database-per-tenant isolation:
    - database_mode='shared': Uses shared database (default)
    - database_mode='dedicated': Uses encrypted connection_config for separate DB
    """

    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)

    # Isolation model
    database_mode = Column(String(20), default="shared", nullable=False)
    connection_config = Column(Text, nullable=True)  # Encrypted, for dedicated DBs

    # Billing tier
    tier = Column(String(50), default="standard", nullable=False)

    # Settings
    settings = Column(JSONB, default=dict, nullable=False)

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="tenant", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Tenant {self.slug}>"
