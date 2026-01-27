"""Pytest configuration and fixtures."""

import pytest
from app.config import get_settings


@pytest.fixture(autouse=True)
def clear_settings_cache():
    """Clear the settings cache before each test."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
