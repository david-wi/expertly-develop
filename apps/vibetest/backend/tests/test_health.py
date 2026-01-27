"""Health endpoint tests."""


def test_health_check(client):
    """Test health endpoint returns healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "vibe-qa"


def test_readiness_check(client):
    """Test readiness endpoint returns ready status."""
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
