"""Encryption service for sensitive data."""
import base64
import json
from typing import Any, Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self):
        settings = get_settings()
        # Derive a key from the encryption key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"vibeqa_salt_v1",  # Fixed salt for consistency
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(
            kdf.derive(settings.encryption_key.encode())
        )
        self._fernet = Fernet(key)

    def encrypt(self, data: Any) -> str:
        """Encrypt data and return base64-encoded string."""
        json_data = json.dumps(data)
        encrypted = self._fernet.encrypt(json_data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()

    def decrypt(self, encrypted_data: str) -> Any:
        """Decrypt base64-encoded encrypted data."""
        try:
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted = self._fernet.decrypt(encrypted_bytes)
            return json.loads(decrypted.decode())
        except Exception:
            return None

    def encrypt_credentials(self, credentials: Optional[dict]) -> Optional[str]:
        """Encrypt credentials dictionary."""
        if not credentials:
            return None
        return self.encrypt(credentials)

    def decrypt_credentials(self, encrypted: Optional[str]) -> Optional[dict]:
        """Decrypt credentials string to dictionary."""
        if not encrypted:
            return None
        return self.decrypt(encrypted)


# Singleton instance
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get encryption service singleton."""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service
