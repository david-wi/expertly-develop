"""Tests for the avatar generation endpoint."""

import base64
import os
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

from app.config import get_settings


@pytest.fixture
def setup_test_settings():
    """Setup test settings with OpenAI API key."""
    # Clear the settings cache
    get_settings.cache_clear()

    # Set environment variables for test settings
    os.environ["OPENAI_API_KEY"] = "test-key"

    # Re-import app after setting env vars
    from app.main import app

    yield {"app": app}

    # Cleanup
    get_settings.cache_clear()
    os.environ.pop("OPENAI_API_KEY", None)


@pytest.fixture
def sample_png_base64():
    """Create a minimal valid PNG file as base64."""
    # Minimal 1x1 transparent PNG
    png_bytes = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # 8-bit RGBA
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,  # IEND chunk
        0x42, 0x60, 0x82
    ])
    return base64.b64encode(png_bytes).decode('utf-8')


@pytest.mark.asyncio
async def test_generate_avatar_returns_data_url(setup_test_settings, sample_png_base64):
    """Test that avatar generation returns a base64 data URL, not a temporary OpenAI URL."""
    app = setup_test_settings["app"]

    # Mock OpenAI API response with b64_json format
    mock_openai_response = MagicMock()
    mock_openai_response.data = [MagicMock(b64_json=sample_png_base64)]

    with patch("app.api.v1.images.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.images.generate.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/images/generate-avatar",
                json={
                    "user_type": "bot",
                    "description": "A helpful research assistant",
                    "name": "ResearchBot"
                }
            )

    assert response.status_code == 200
    data = response.json()

    # Key assertion: URL should be a data URL, not a temp OpenAI URL
    assert "url" in data
    assert data["url"].startswith("data:image/png;base64,")
    assert "oaidalleapiprodscus.blob.core.windows.net" not in data["url"]

    # Verify the base64 content is valid
    base64_part = data["url"].split(",")[1]
    decoded = base64.b64decode(base64_part)
    assert decoded[:8] == b'\x89PNG\r\n\x1a\n'  # PNG signature


@pytest.mark.asyncio
async def test_generate_avatar_human_type(setup_test_settings, sample_png_base64):
    """Test avatar generation for human user type."""
    app = setup_test_settings["app"]

    mock_openai_response = MagicMock()
    mock_openai_response.data = [MagicMock(b64_json=sample_png_base64)]

    with patch("app.api.v1.images.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.images.generate.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/images/generate-avatar",
                json={
                    "user_type": "human",
                    "description": "Professional woman with short brown hair and glasses",
                    "name": "Jane"
                }
            )

    assert response.status_code == 200
    data = response.json()
    assert data["url"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_generate_avatar_calls_openai_with_b64_json(setup_test_settings, sample_png_base64):
    """Test that OpenAI is called with response_format=b64_json."""
    app = setup_test_settings["app"]

    mock_openai_response = MagicMock()
    mock_openai_response.data = [MagicMock(b64_json=sample_png_base64)]

    with patch("app.api.v1.images.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.images.generate.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/v1/images/generate-avatar",
                json={"user_type": "bot", "description": "Test bot"}
            )

        # Verify OpenAI was called with response_format="b64_json"
        call_kwargs = mock_client.images.generate.call_args.kwargs
        assert call_kwargs.get("response_format") == "b64_json"
