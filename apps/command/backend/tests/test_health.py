"""Health endpoint tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(seeded_client: AsyncClient):
    """Test the health endpoint returns OK status."""
    response = await seeded_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    # Status can be healthy or degraded depending on database ping latency
    assert data["status"] in ["healthy", "degraded"]


@pytest.mark.asyncio
async def test_health_check_without_db(client: AsyncClient):
    """Test health endpoint when database is available but empty."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    # Status can be healthy or degraded depending on database ping latency
    assert data["status"] in ["healthy", "degraded"]
