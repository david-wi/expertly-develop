"""Encryption service for securing sensitive data."""

import base64
import secrets
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import get_settings


class EncryptionService:
    """Service for encrypting and decrypting sensitive data."""

    def __init__(self):
        self._fernet: Fernet | None = None

    def _get_fernet(self) -> Fernet:
        """Get or create Fernet instance."""
        if self._fernet is None:
            settings = get_settings()
            key = settings.encryption_key

            if not key:
                # Generate a key for development (not secure for production)
                key = Fernet.generate_key().decode()

            # If key is not already a valid Fernet key, derive one
            if len(key) != 44 or not key.endswith("="):
                # Derive a proper Fernet key from the provided string
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=b"expertly-develop-salt",  # Static salt for consistency
                    iterations=100000,
                )
                derived_key = base64.urlsafe_b64encode(kdf.derive(key.encode()))
                self._fernet = Fernet(derived_key)
            else:
                self._fernet = Fernet(key.encode())

        return self._fernet

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string and return base64-encoded ciphertext."""
        if not plaintext:
            return ""
        fernet = self._get_fernet()
        encrypted = fernet.encrypt(plaintext.encode())
        return encrypted.decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext and return plaintext."""
        if not ciphertext:
            return ""
        fernet = self._get_fernet()
        decrypted = fernet.decrypt(ciphertext.encode())
        return decrypted.decode()

    def encrypt_dict(self, data: dict, fields: list[str]) -> dict:
        """Encrypt specified fields in a dictionary."""
        result = data.copy()
        for field in fields:
            if field in result and result[field]:
                result[field] = self.encrypt(str(result[field]))
        return result

    def decrypt_dict(self, data: dict, fields: list[str]) -> dict:
        """Decrypt specified fields in a dictionary."""
        result = data.copy()
        for field in fields:
            if field in result and result[field]:
                result[field] = self.decrypt(str(result[field]))
        return result


# Singleton instance
encryption_service = EncryptionService()
