"""User API tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_current_user(seeded_client: AsyncClient, auth_headers: dict):
    """Test getting the current authenticated user."""
    response = await seeded_client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "David"
    assert data["email"] == "david@example.com"
    assert data["role"] == "owner"
    assert data["user_type"] == "human"


@pytest.mark.asyncio
async def test_get_current_user_no_auth(seeded_client: AsyncClient):
    """Test getting current user without authentication fails."""
    # Without SKIP_AUTH mode, this should return 401
    response = await seeded_client.get("/api/v1/users/me")
    # Should fail without auth headers
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_users(seeded_client: AsyncClient, auth_headers: dict):
    """Test listing all users in the organization."""
    response = await seeded_client.get("/api/v1/users", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert any(u["name"] == "David" for u in data)


@pytest.mark.asyncio
async def test_create_user(seeded_client: AsyncClient, auth_headers: dict):
    """Test creating a new user."""
    new_user = {
        "email": "test@example.com",
        "name": "Test User",
        "user_type": "human",
        "role": "member"
    }
    response = await seeded_client.post(
        "/api/v1/users",
        json=new_user,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert "id" in data or "_id" in data


@pytest.mark.asyncio
async def test_create_bot_user(seeded_client: AsyncClient, auth_headers: dict):
    """Test creating a virtual (bot) user."""
    new_bot = {
        "email": "bot@example.com",
        "name": "Test Bot",
        "user_type": "virtual",
        "role": "member"
    }
    response = await seeded_client.post(
        "/api/v1/users",
        json=new_bot,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user_type"] == "virtual"
    # Bot should get an API key
    assert "api_key" in data or data.get("api_key_hash") is not None
