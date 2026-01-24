"""Integration tests for people API endpoints."""

import pytest
from uuid import uuid4

from app.models import Person, Client


class TestListPeople:
    """Tests for GET /api/people endpoint."""

    @pytest.mark.asyncio
    async def test_list_people_returns_people(
        self, client, db_session, test_tenant
    ):
        """List people should return people."""
        person = Person(
            tenant_id=test_tenant.id,
            name="John Doe",
            email="john@example.com",
            relationship="client",
        )
        db_session.add(person)
        await db_session.commit()

        response = await client.get("/api/people")

        assert response.status_code == 200
        data = response.json()
        assert any(p["name"] == "John Doe" for p in data)

    @pytest.mark.asyncio
    async def test_list_people_filters_by_client_id(
        self, client, db_session, test_tenant
    ):
        """List people should filter by client_id."""
        client_entity = Client(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Acme Corp",
            status="active",
        )
        db_session.add(client_entity)
        await db_session.flush()

        person1 = Person(
            tenant_id=test_tenant.id,
            name="John",
            email="john@acme.com",
            client_id=client_entity.id,
            relationship="client",
        )
        person2 = Person(
            tenant_id=test_tenant.id,
            name="Jane",
            email="jane@other.com",
            client_id=None,
            relationship="colleague",
        )
        db_session.add_all([person1, person2])
        await db_session.commit()

        response = await client.get(f"/api/people?client_id={client_entity.id}")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "John"

    @pytest.mark.asyncio
    async def test_list_people_filters_by_relationship(
        self, client, db_session, test_tenant
    ):
        """List people should filter by relationship."""
        person1 = Person(
            tenant_id=test_tenant.id,
            name="Client Person",
            email="client@example.com",
            relationship="client",
        )
        person2 = Person(
            tenant_id=test_tenant.id,
            name="Colleague Person",
            email="colleague@example.com",
            relationship="colleague",
        )
        db_session.add_all([person1, person2])
        await db_session.commit()

        response = await client.get("/api/people?relationship=client")

        assert response.status_code == 200
        data = response.json()
        assert all(p["relationship"] == "client" for p in data)

    @pytest.mark.asyncio
    async def test_list_people_filters_by_search(
        self, client, db_session, test_tenant
    ):
        """List people should filter by search."""
        person1 = Person(
            tenant_id=test_tenant.id,
            name="John Smith",
            email="john@example.com",
            relationship="client",
        )
        person2 = Person(
            tenant_id=test_tenant.id,
            name="Jane Doe",
            email="jane@example.com",
            relationship="client",
        )
        db_session.add_all([person1, person2])
        await db_session.commit()

        response = await client.get("/api/people?search=John")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "John Smith"

    @pytest.mark.asyncio
    async def test_list_people_pagination(
        self, client, db_session, test_tenant
    ):
        """List people should support pagination."""
        for i in range(5):
            db_session.add(Person(
                tenant_id=test_tenant.id,
                name=f"Person {i}",
                email=f"person{i}@example.com",
                relationship="client",
            ))
        await db_session.commit()

        response = await client.get("/api/people?limit=2&offset=2")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCreatePerson:
    """Tests for POST /api/people endpoint."""

    @pytest.mark.asyncio
    async def test_create_person_returns_201(self, client):
        """Create person should return 201 Created."""
        response = await client.post("/api/people", json={
            "name": "New Person",
            "email": "new@example.com",
            "relationship": "client",
            "title": "CEO",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Person"
        assert data["email"] == "new@example.com"
        assert data["title"] == "CEO"

    @pytest.mark.asyncio
    async def test_create_person_with_all_fields(self, client):
        """Create person should accept all fields."""
        response = await client.post("/api/people", json={
            "name": "Full Person",
            "email": "full@example.com",
            "phone": "+1234567890",
            "title": "Manager",
            "company": "Acme Corp",
            "relationship": "client",
            "relationship_to_user": "Main contact for Acme",
            "political_context": "Reports to CEO, decision maker",
            "communication_notes": "Prefers email over calls",
            "context_notes": "Met at conference 2024",
        })

        assert response.status_code == 201
        data = response.json()
        assert data["phone"] == "+1234567890"
        assert data["communication_notes"] == "Prefers email over calls"

    @pytest.mark.asyncio
    async def test_create_person_requires_name(self, client):
        """Create person should require name."""
        response = await client.post("/api/people", json={
            "email": "test@example.com",
            "relationship": "client",
        })

        assert response.status_code == 422


class TestGetPerson:
    """Tests for GET /api/people/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_person_returns_person(
        self, client, db_session, test_tenant
    ):
        """Get person should return person by ID."""
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Test Person",
            email="test@example.com",
            relationship="client",
        )
        db_session.add(person)
        await db_session.commit()

        response = await client.get(f"/api/people/{person.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Person"

    @pytest.mark.asyncio
    async def test_get_person_returns_404_for_nonexistent(self, client):
        """Get person should return 404 for nonexistent ID."""
        response = await client.get(f"/api/people/{uuid4()}")

        assert response.status_code == 404


class TestUpdatePerson:
    """Tests for PUT /api/people/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_person_updates_fields(
        self, client, db_session, test_tenant
    ):
        """Update person should update fields."""
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original",
            email="original@example.com",
            relationship="client",
        )
        db_session.add(person)
        await db_session.commit()

        response = await client.put(f"/api/people/{person.id}", json={
            "name": "Updated",
            "title": "New Title",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated"
        assert data["title"] == "New Title"

    @pytest.mark.asyncio
    async def test_update_person_partial_update(
        self, client, db_session, test_tenant
    ):
        """Update person should support partial updates."""
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Original",
            email="original@example.com",
            title="CEO",
            relationship="client",
        )
        db_session.add(person)
        await db_session.commit()

        response = await client.put(f"/api/people/{person.id}", json={
            "title": "CTO",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original"  # Unchanged
        assert data["title"] == "CTO"  # Updated

    @pytest.mark.asyncio
    async def test_update_person_returns_404_for_nonexistent(self, client):
        """Update person should return 404 for nonexistent ID."""
        response = await client.put(f"/api/people/{uuid4()}", json={
            "name": "Updated",
        })

        assert response.status_code == 404


class TestDeletePerson:
    """Tests for DELETE /api/people/{id} endpoint."""

    @pytest.mark.asyncio
    async def test_delete_person_returns_204(
        self, client, db_session, test_tenant
    ):
        """Delete person should return 204 No Content."""
        person = Person(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="To Delete",
            email="delete@example.com",
            relationship="client",
        )
        db_session.add(person)
        await db_session.commit()

        response = await client.delete(f"/api/people/{person.id}")

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_person_returns_404_for_nonexistent(self, client):
        """Delete person should return 404 for nonexistent ID."""
        response = await client.delete(f"/api/people/{uuid4()}")

        assert response.status_code == 404
