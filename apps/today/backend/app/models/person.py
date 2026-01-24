"""Person model - contacts with relationship context."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.orm import relationship as orm_relationship
import uuid

from app.models.base import Base, TimestampMixin, UUID, JSONB


class TaskPerson(Base):
    """Links tasks to people involved."""

    __tablename__ = "task_people"

    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        primary_key=True,
    )
    person_id = Column(
        UUID(as_uuid=True),
        ForeignKey("people.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role = Column(String(50), nullable=True)  # subject, recipient, stakeholder, mentioned

    # Relationships
    task = orm_relationship("Task", back_populates="people")
    person = orm_relationship("Person", back_populates="tasks")


class Person(Base, TimestampMixin):
    """
    Person represents a contact with relationship context.

    Includes political context and communication notes for relationship-aware drafting.
    """

    __tablename__ = "people"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Basic info
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)

    # Relationship context (critical for communication)
    relationship = Column(String(100), nullable=True)  # colleague, client, prospect, partner, friend
    relationship_to_user = Column(Text, nullable=True)  # "Reports to me", "Peer at client"
    political_context = Column(Text, nullable=True)  # "Close to CEO", "Often sidelined"
    communication_notes = Column(Text, nullable=True)  # How to communicate

    # Tracking
    last_contact = Column(String(50), nullable=True)
    next_follow_up = Column(String(50), nullable=True)

    # Context
    context_notes = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, default=dict, nullable=False)

    # Relationships
    tenant = orm_relationship("Tenant")
    client = orm_relationship("Client", back_populates="people")
    tasks = orm_relationship("TaskPerson", back_populates="person", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Person {self.name}>"
