"""Integration tests for clients API endpoints."""

import pytest
from uuid import uuid4

from app.models import Client, Person


class TestListClients:
    """Tests for GET /api/clients endpoint."""

    @pytest.mark.asyncio
    async def test_list_clients_returns_clients(
        self, client, db_session, test_tenant
    ):
        """List clients should return clients."""
        client_entity = Client(
            tenant_id=test_tenant.id,
            name="Acme Corp",
            status="active",
        )
        db_session.add(client_entity)
        await db_session.commit()

        response = await client.get("/api/clients")

        assert response.status_code == 200
        data = response.json()
        assert any(c["name"] == "Acme Corp" for c in data)

    @pytest.mark.asyncio
    async def test_list_clients_filters_by_status(
        self, client, db_session, test_tenant
    ):
        """List clients should filter by status."""
        active = Client(
            tenant_id=test_tenant.id,
            name="Active Client",
            status="active",
        )
        prospect = Client(
            tenant_id=test_tenant.id,
            name="Prospect Client",
            status="prospect",
        )
        db_session.add_all([active, prospect])
        await db_session.commit()

        response = await client.get("/api/clients?status=active")

        assert response.status_code == 200
        data = response.json()
        assert all(c["status"] == "active" for c in data)

    @pytest.mark.asyncio
    async def test_list_clients_filters_by_search(
        self, client, db_session, test_tenant
    ):
        """List clients should filter by search."""
        client1 = Client(
            tenant_id=test_tenant.id,
            name="Acme Corporation",
            status="active",
        )
        client2 = Client(
            tenant_id=test_tenant.id,
            name="Beta Inc",
            status="active",
        )
        db_session.add_all([client1, client2])
        await db_session.commit()

        response = await client.get("/api/clients?search=Acme")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Acme Corporation"

    @pytest.mark.asyncio
    async def test_list_clients_pagination(
        self, client, db_session, test_tenant
    ):
        """List clients should support pagination."""
        for i in range(5):
            db_session.add(Client(
                tenant_id=test_tenant.id,
                name=f"Client {i}",
                status="active",
            ))
        await db_session.commit()

        response = await client.get("/api/clients?limit=2&offset=2")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreateClient:
    """Tests for POST /api/clients endpoint."""

    @pytest.mark.asyncio
    async def test_create_client_returns_201(self, client):
        """Create client should return 201 Created."""
        response = await client.post("/api/clients", json={
            "name": "New Client",
            "status": "prospect",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Client"
        assert data["status"] == "prospect"

    @pytest.mark.asyncio
    async def test_create_client_with_notes(self, client):
        """Create client should accept notes."""
        response = await client.post("/api/clients", json={
            "name": "Client With Notes",
            "status": "active",
            "notes": "Important client, handle with care",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["notes"] == "Important client, handle with care"

    @pytest.mark.asyncio
    async def test_create_client_requires_name(self, client):
        """Create client should require name."""
        response = await client.post("/api/clients", json={
            "status": "active",
        })

        assert response.status_code == 422


class TestGetClient:
    """Tests for GET /api/clients/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_client_returns_client_with_people(
        self, client, db_session, test_tenant
    ):
        """Get client should return client with associated people."""
        client_entity = Client(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Test Client",
            status="active",
        )
        db_session.add(client_entity)
        await db_session.flush()

        person = Person(
            tenant_id=test_tenant.id,
            name="John Doe",
            email="john@testclient.com",
            title="CEO",
            client_id=client_entity.id,
            relationship="client",
        )
        db_session.add(person)
        await db_session.commit()

        response = await client.get(f"/api/clients/{client_entity.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Client"
        assert "people" in data
        assert len(data["people"]) == 1
        assert data["people"][0]["name"] == "John Doe"

    @pytest.mark.asyncio
    async def test_get_client_returns_404_for_nonexistent(self, client):
        """Get client should return 404 for nonexistent ID."""
        response = await client.get(f"/api/clients/{uuid4()}")

        assert response.status_code == 404


class TestUpdateClient:
    """Tests for PUT /api/clients/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_client_updates_fields(
        self, client, db_session, test_tenant
    ):
        """Update client should update fields."""
        client_entity = Client(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original Name",
            status="prospect",
        )
        db_session.add(client_entity)
        await db_session.commit()

        response = await client.put(f"/api/clients/{client_entity.id}", json={
            "name": "Updated Name",
            "status": "active",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_update_client_partial_update(
        self, client, db_session, test_tenant
    ):
        """Update client should support partial updates."""
        client_entity = Client(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original Name",
            status="prospect",
            notes="Original notes",
        )
        db_session.add(client_entity)
        await db_session.commit()

        response = await client.put(f"/api/clients/{client_entity.id}", json={
            "status": "active",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original Name"  # Unchanged
        assert data["notes"] == "Original notes"  # Unchanged
        assert data["status"] == "active"  # Updated

    @pytest.mark.asyncio
    async def test_update_client_returns_404_for_nonexistent(self, client):
        """Update client should return 404 for nonexistent ID."""
        response = await client.put(f"/api/clients/{uuid4()}", json={
            "name": "Updated",
        })

        assert response.status_code == 404


class TestDeleteClient:
    """Tests for DELETE /api/clients/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_client_archives_client(
        self, client, db_session, test_tenant
    ):
        """Delete client should archive the client."""
        client_entity = Client(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="To Archive",
            status="active",
        )
        db_session.add(client_entity)
        await db_session.commit()

        response = await client.delete(f"/api/clients/{client_entity.id}")

        assert response.status_code == 204

        # Verify it was archived, not deleted
        await db_session.refresh(client_entity)
        assert client_entity.status == "archived"

    @pytest.mark.asyncio
    async def test_delete_client_returns_404_for_nonexistent(self, client):
        """Delete client should return 404 for nonexistent ID."""
        response = await client.delete(f"/api/clients/{uuid4()}")

        assert response.status_code == 404
