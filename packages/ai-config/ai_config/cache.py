"""Simple TTL cache for AI configuration."""

import time
from typing import Optional, TypeVar, Generic

T = TypeVar('T')


class TTLCache(Generic[T]):
    """Simple TTL cache that stores a single value with expiration."""

    def __init__(self, ttl_seconds: int = 300):
        """
        Initialize cache.

        Args:
            ttl_seconds: Time-to-live in seconds (default: 5 minutes)
        """
        self.ttl_seconds = ttl_seconds
        self._value: Optional[T] = None
        self._expires_at: float = 0

    def get(self) -> Optional[T]:
        """Get cached value if not expired."""
        if self._value is not None and time.time() < self._expires_at:
            return self._value
        return None

    def set(self, value: T) -> None:
        """Set cached value with TTL."""
        self._value = value
        self._expires_at = time.time() + self.ttl_seconds

    def clear(self) -> None:
        """Clear the cache."""
        self._value = None
        self._expires_at = 0

    @property
    def is_valid(self) -> bool:
        """Check if cache has a valid (non-expired) value."""
        return self._value is not None and time.time() < self._expires_at
