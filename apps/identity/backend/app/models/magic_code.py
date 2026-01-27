"""Magic code model for passwordless authentication."""

import secrets
import string
import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


# Allowed characters for magic code (no 0, O, 1, I to avoid confusion)
ALLOWED_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
CODE_EXPIRY_MINUTES = 15


def generate_magic_code() -> str:
    """Generate a 6-character alphanumeric code."""
    return ''.join(secrets.choice(ALLOWED_CHARS) for _ in range(CODE_LENGTH))


class MagicCode(Base):
    """Magic code for passwordless authentication."""

    __tablename__ = "magic_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(10), nullable=False)

    # Track usage
    used = Column(Boolean, default=False)
    attempts = Column(String(20), default="0")  # Track failed attempts

    # Expiration
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @classmethod
    def create_new(cls, email: str) -> "MagicCode":
        """Create a new magic code for the given email."""
        return cls(
            email=email.lower(),
            code=generate_magic_code(),
            expires_at=datetime.utcnow() + timedelta(minutes=CODE_EXPIRY_MINUTES),
        )

    def is_expired(self) -> bool:
        """Check if the code has expired."""
        return datetime.utcnow() > self.expires_at

    def is_valid(self) -> bool:
        """Check if the code is still valid (not expired, not used)."""
        return not self.used and not self.is_expired()

    def increment_attempts(self) -> int:
        """Increment and return the number of failed attempts."""
        current = int(self.attempts)
        current += 1
        self.attempts = str(current)
        return current

    def mark_used(self) -> None:
        """Mark the code as used."""
        self.used = True
