"""Unit tests for authentication utilities."""

import pytest
from uuid import uuid4

from app.models.base import generate_api_key


class TestAPIKeyGeneration:
    """Tests for API key generation."""

    def test_generate_api_key_returns_string(self):
        """generate_api_key returns a string."""
        key = generate_api_key()
        assert isinstance(key, str)

    def test_generate_api_key_has_correct_length(self):
        """Generated API key has correct length."""
        key = generate_api_key()
        # 32 bytes = 64 hex characters
        assert len(key) == 64

    def test_generate_api_key_is_unique(self):
        """Each generated key is unique."""
        keys = [generate_api_key() for _ in range(100)]
        assert len(set(keys)) == 100

    def test_generate_api_key_is_hex(self):
        """Generated key contains only hex characters."""
        key = generate_api_key()
        assert all(c in '0123456789abcdef' for c in key)
