import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    """Test root endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data


@pytest.mark.asyncio
async def test_list_staff_unauthorized(client: AsyncClient):
    """Test that staff list requires authentication."""
    response = await client.get("/api/v1/staff")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_staff(client: AsyncClient, auth_headers: dict):
    """Test listing staff with authentication."""
    response = await client.get("/api/v1/staff", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_staff(client: AsyncClient, auth_headers: dict):
    """Test creating a staff member."""
    staff_data = {
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com",
        "color": "#FF5733",
    }
    response = await client.post(
        "/api/v1/staff",
        json=staff_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Jane"
    assert data["last_name"] == "Doe"
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_services(client: AsyncClient, auth_headers: dict):
    """Test listing services."""
    response = await client.get("/api/v1/services", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_service(client: AsyncClient, auth_headers: dict):
    """Test creating a service."""
    service_data = {
        "name": "Haircut",
        "duration_minutes": 30,
        "price": 5000,  # $50.00
    }
    response = await client.post(
        "/api/v1/services",
        json=service_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Haircut"
    assert data["duration_minutes"] == 30
    assert data["price"] == 5000


@pytest.mark.asyncio
async def test_list_clients(client: AsyncClient, auth_headers: dict):
    """Test listing clients."""
    response = await client.get("/api/v1/clients", headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_client(client: AsyncClient, auth_headers: dict):
    """Test creating a client."""
    client_data = {
        "first_name": "John",
        "last_name": "Smith",
        "phone": "555-1234",
    }
    response = await client.post(
        "/api/v1/clients",
        json=client_data,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Smith"
