"""Tests for the avatar generation endpoint."""

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import respx
from httpx import AsyncClient, Response, ASGITransport

from app.config import get_settings


@pytest.fixture
def setup_test_settings(tmp_path):
    """Setup test settings with temp directory for uploads."""
    # Clear the settings cache
    get_settings.cache_clear()

    # Set environment variables for test settings
    uploads_dir = str(tmp_path / "uploads")
    os.environ["UPLOADS_DIR"] = uploads_dir
    os.environ["UPLOADS_BASE_URL"] = "http://test-server/uploads"
    os.environ["OPENAI_API_KEY"] = "test-key"

    # Re-import app after setting env vars
    from app.main import app

    yield {
        "app": app,
        "uploads_dir": uploads_dir,
        "uploads_base_url": "http://test-server/uploads",
    }

    # Cleanup
    get_settings.cache_clear()
    os.environ.pop("UPLOADS_DIR", None)
    os.environ.pop("UPLOADS_BASE_URL", None)
    os.environ.pop("OPENAI_API_KEY", None)


@pytest.fixture
def sample_png():
    """Create a minimal valid PNG file bytes."""
    # Minimal 1x1 transparent PNG
    return bytes([
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


@pytest.mark.asyncio
async def test_generate_avatar_returns_local_url(setup_test_settings, sample_png):
    """Test that avatar generation returns a local URL, not the temporary OpenAI URL."""
    openai_temp_url = "https://oaidalleapiprodscus.blob.core.windows.net/private/test-image.png"
    app = setup_test_settings["app"]
    uploads_base_url = setup_test_settings["uploads_base_url"]

    # Mock OpenAI API response
    mock_openai_response = MagicMock()
    mock_openai_response.data = [MagicMock(url=openai_temp_url)]

    with patch("app.api.v1.images.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.images.generate.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        # Mock the download of the image from OpenAI
        with respx.mock:
            respx.get(openai_temp_url).mock(return_value=Response(200, content=sample_png))

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

    # Key assertion: URL should be local, not the temp OpenAI URL
    assert "url" in data
    assert data["url"].startswith(uploads_base_url)
    assert "oaidalleapiprodscus.blob.core.windows.net" not in data["url"]
    assert data["url"].endswith(".png")

    # Verify file was saved
    uploads_dir = Path(setup_test_settings["uploads_dir"])
    saved_files = list(uploads_dir.glob("*.png"))
    assert len(saved_files) == 1


@pytest.mark.asyncio
async def test_generate_avatar_human_type(setup_test_settings, sample_png):
    """Test avatar generation for human user type."""
    openai_temp_url = "https://oaidalleapiprodscus.blob.core.windows.net/private/human-avatar.png"
    app = setup_test_settings["app"]
    uploads_base_url = setup_test_settings["uploads_base_url"]

    mock_openai_response = MagicMock()
    mock_openai_response.data = [MagicMock(url=openai_temp_url)]

    with patch("app.api.v1.images.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.images.generate.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        with respx.mock:
            respx.get(openai_temp_url).mock(return_value=Response(200, content=sample_png))

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
    assert data["url"].startswith(uploads_base_url)


@pytest.mark.asyncio
async def test_generate_avatar_unique_filenames(setup_test_settings, sample_png):
    """Test that each avatar generation creates a unique filename."""
    openai_temp_url = "https://oaidalleapiprodscus.blob.core.windows.net/private/test.png"
    app = setup_test_settings["app"]

    mock_openai_response = MagicMock()
    mock_openai_response.data = [MagicMock(url=openai_temp_url)]

    with patch("app.api.v1.images.get_openai_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.images.generate.return_value = mock_openai_response
        mock_get_client.return_value = mock_client

        with respx.mock:
            respx.get(openai_temp_url).mock(return_value=Response(200, content=sample_png))

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Generate two avatars
                response1 = await client.post(
                    "/api/v1/images/generate-avatar",
                    json={"user_type": "bot", "description": "Bot 1"}
                )
                response2 = await client.post(
                    "/api/v1/images/generate-avatar",
                    json={"user_type": "bot", "description": "Bot 2"}
                )

    assert response1.status_code == 200
    assert response2.status_code == 200

    url1 = response1.json()["url"]
    url2 = response2.json()["url"]

    # URLs should be different (unique filenames)
    assert url1 != url2

    # Both should be valid local URLs
    assert "oaidalleapiprodscus" not in url1
    assert "oaidalleapiprodscus" not in url2
