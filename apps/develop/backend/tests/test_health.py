"""Tests for health and root endpoints."""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock


@pytest.fixture
def mock_app():
    """Create a mock FastAPI app for testing."""
    from unittest.mock import patch

    # Mock the database connection
    with patch("app.database.connect_to_mongodb", new_callable=AsyncMock):
        with patch("app.database.close_mongodb_connection", new_callable=AsyncMock):
            with patch("app.main.seed_initial_data", new_callable=AsyncMock):
                from app.main import app
                yield app


class TestHealthEndpoints:
    """Test cases for health and root endpoints."""

    @pytest.mark.asyncio
    async def test_root_endpoint(self, mock_app):
        """Test root endpoint returns app info."""
        from httpx import AsyncClient, ASGITransport

        transport = ASGITransport(app=mock_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "docs_url" in data

    @pytest.mark.asyncio
    async def test_health_endpoint(self, mock_app):
        """Test health check endpoint."""
        from httpx import AsyncClient, ASGITransport

        transport = ASGITransport(app=mock_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestDatabaseFunctions:
    """Test cases for database utility functions."""

    def test_get_database_returns_db(self, mock_db):
        """Test that get_database returns the database instance."""
        with patch("app.database.db") as mock_db_module:
            mock_db_module.db = mock_db
            from app.database import get_database

            result = get_database()
            assert result == mock_db

    def test_get_gridfs_returns_fs(self, mock_db):
        """Test that get_gridfs returns the GridFS bucket."""
        from unittest.mock import MagicMock

        mock_fs = MagicMock()
        with patch("app.database.db") as mock_db_module:
            mock_db_module.fs = mock_fs
            from app.database import get_gridfs

            result = get_gridfs()
            assert result == mock_fs
