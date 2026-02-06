"""
Token encryption utilities for secure storage of OAuth tokens.
Uses Fernet symmetric encryption (AES-128-CBC with HMAC).
"""
import base64
import os
from cryptography.fernet import Fernet
from app.config import get_settings


def get_fernet() -> Fernet:
    """Get Fernet instance with the configured encryption key."""
    settings = get_settings()
    key = settings.connection_encryption_key
    if not key:
        raise ValueError("CONNECTION_ENCRYPTION_KEY not configured")
    # Ensure key is properly formatted for Fernet
    if len(key) == 32:
        # Raw 32-byte key needs to be base64 encoded
        key = base64.urlsafe_b64encode(key.encode()).decode()
    return Fernet(key.encode())


def encrypt_token(token: str) -> str:
    """
    Encrypt a token for secure storage.

    Args:
        token: The plaintext token to encrypt

    Returns:
        Base64-encoded encrypted token
    """
    if not token:
        return ""
    fernet = get_fernet()
    encrypted = fernet.encrypt(token.encode())
    return encrypted.decode()


def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypt a stored token.

    Args:
        encrypted_token: The encrypted token from storage

    Returns:
        The decrypted plaintext token
    """
    if not encrypted_token:
        return ""
    fernet = get_fernet()
    decrypted = fernet.decrypt(encrypted_token.encode())
    return decrypted.decode()


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.
    Run this once to create a key for CONNECTION_ENCRYPTION_KEY.

    Returns:
        A new base64-encoded Fernet key
    """
    return Fernet.generate_key().decode()
