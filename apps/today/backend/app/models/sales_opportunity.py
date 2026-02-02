"""SalesOpportunity model - pipeline tracking."""

from sqlalchemy import Column, String, Text, Integer, Numeric, Date, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID


class SalesStage:
    """Sales pipeline stage constants."""
    LEAD = "lead"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"

    ALL = [LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST]
    OPEN = [LEAD, QUALIFIED, PROPOSAL, NEGOTIATION]


class SalesOpportunity(Base, TimestampMixin):
    """SalesOpportunity represents a pipeline item."""

    __tablename__ = "sales_opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Organization ID from Identity service
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Opportunity details
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Pipeline
    stage = Column(String(50), default=SalesStage.LEAD, nullable=False)
    value = Column(Numeric(12, 2), nullable=True)
    probability = Column(Integer, nullable=True)

    # Timeline
    expected_close_date = Column(Date, nullable=True)
    last_activity = Column(String(50), nullable=True)
    next_action = Column(Text, nullable=True)
    next_action_date = Column(Date, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Closed timestamp
    closed_at = Column(String(50), nullable=True)

    # Relationships (Tenant now from Identity service)
    client = relationship("Client", back_populates="sales_opportunities")

    __table_args__ = (
        CheckConstraint(
            "probability IS NULL OR (probability >= 0 AND probability <= 100)",
            name="ck_opportunity_probability"
        ),
    )

    def __repr__(self) -> str:
        return f"<SalesOpportunity {self.name} ({self.stage})>"
