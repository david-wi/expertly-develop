"""Tests for health check and root endpoints."""


class TestHealthCheck:
    async def test_health_check_returns_200(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "database" in data

    async def test_root(self, client):
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Aipocalypse Fund"
        assert "version" in data
        assert data["docs"] == "/api/docs"
