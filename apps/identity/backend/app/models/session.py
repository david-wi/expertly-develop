import uuid
import secrets
from datetime import datetime, timedelta
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.config import get_settings

settings = get_settings()


def generate_session_token() -> str:
    """Generate a secure random session token."""
    return secrets.token_hex(32)


class Session(Base):
    """Session model for tracking user login sessions."""

    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(64), unique=True, index=True, nullable=False)

    # Session metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_active_at = Column(DateTime, default=datetime.utcnow)

    # Request info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")

    @classmethod
    def create_new(
        cls,
        user_id: uuid.UUID,
        ip_address: str = None,
        user_agent: str = None
    ) -> "Session":
        """Create a new session with generated token and expiry."""
        now = datetime.utcnow()
        expiry = now + timedelta(days=settings.session_expiry_days)

        return cls(
            user_id=user_id,
            session_token=generate_session_token(),
            created_at=now,
            expires_at=expiry,
            last_active_at=now,
            ip_address=ip_address,
            user_agent=user_agent
        )

    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.utcnow() > self.expires_at

    def update_activity(self) -> None:
        """Update last activity timestamp."""
        self.last_active_at = datetime.utcnow()
