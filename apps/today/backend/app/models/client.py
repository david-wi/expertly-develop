"""Client model - customers/accounts."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class ClientStatus:
    """Client status constants."""
    PROSPECT = "prospect"
    ACTIVE = "active"
    CHURNED = "churned"
    ARCHIVED = "archived"

    ALL = [PROSPECT, ACTIVE, CHURNED, ARCHIVED]


class Client(Base, TimestampMixin):
    """Client represents a customer or account."""

    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(255), nullable=False)
    status = Column(String(50), default=ClientStatus.ACTIVE, nullable=False)
    notes = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    tenant = relationship("Tenant")
    people = relationship("Person", back_populates="client")
    sales_opportunities = relationship("SalesOpportunity", back_populates="client")

    def __repr__(self) -> str:
        return f"<Client {self.name}>"
