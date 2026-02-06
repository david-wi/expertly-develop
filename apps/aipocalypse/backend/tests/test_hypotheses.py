"""Tests for hypotheses CRUD API."""


class TestHypothesesCRUD:
    async def test_create_hypothesis(self, client, sample_hypothesis_data):
        response = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == sample_hypothesis_data["title"]
        assert data["thesis_type"] == "disruption"
        assert data["impact_direction"] == "negative"
        assert data["confidence_level"] == 85
        assert data["status"] == "active"
        assert "id" in data
        assert data["tags"] == ["ai-coding", "it-services"]

    async def test_list_hypotheses(self, client, sample_hypothesis_data):
        # Create two hypotheses
        await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        second = {**sample_hypothesis_data, "title": "SaaS Vulnerability", "thesis_type": "disruption"}
        await client.post("/api/v1/hypotheses", json=second)

        response = await client.get("/api/v1/hypotheses")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    async def test_list_hypotheses_filter_by_status(self, client, sample_hypothesis_data):
        resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = resp.json()["id"]
        await client.post(f"/api/v1/hypotheses/{hyp_id}/archive")

        response = await client.get("/api/v1/hypotheses", params={"status": "archived"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["status"] == "archived"

        response = await client.get("/api/v1/hypotheses", params={"status": "active"})
        assert response.status_code == 200
        assert len(response.json()) == 0

    async def test_get_hypothesis(self, client, sample_hypothesis_data):
        create_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/hypotheses/{hyp_id}")
        assert response.status_code == 200
        assert response.json()["title"] == sample_hypothesis_data["title"]

    async def test_get_hypothesis_not_found(self, client):
        response = await client.get("/api/v1/hypotheses/000000000000000000000000")
        assert response.status_code == 404

    async def test_update_hypothesis(self, client, sample_hypothesis_data):
        create_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = create_resp.json()["id"]

        response = await client.patch(f"/api/v1/hypotheses/{hyp_id}", json={
            "title": "Updated Title",
            "confidence_level": 95,
        })
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"
        assert response.json()["confidence_level"] == 95
        # Ensure other fields unchanged
        assert response.json()["thesis_type"] == "disruption"

    async def test_update_hypothesis_no_fields(self, client, sample_hypothesis_data):
        create_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = create_resp.json()["id"]

        response = await client.patch(f"/api/v1/hypotheses/{hyp_id}", json={})
        assert response.status_code == 400

    async def test_delete_hypothesis(self, client, sample_hypothesis_data):
        create_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/hypotheses/{hyp_id}")
        assert response.status_code == 200
        assert response.json()["deleted"] is True

        # Verify deleted
        response = await client.get(f"/api/v1/hypotheses/{hyp_id}")
        assert response.status_code == 404

    async def test_archive_hypothesis(self, client, sample_hypothesis_data):
        create_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = create_resp.json()["id"]

        response = await client.post(f"/api/v1/hypotheses/{hyp_id}/archive")
        assert response.status_code == 200
        assert response.json()["status"] == "archived"

        # Verify persisted
        get_resp = await client.get(f"/api/v1/hypotheses/{hyp_id}")
        assert get_resp.json()["status"] == "archived"

    async def test_activate_hypothesis(self, client, sample_hypothesis_data):
        create_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = create_resp.json()["id"]

        await client.post(f"/api/v1/hypotheses/{hyp_id}/archive")
        response = await client.post(f"/api/v1/hypotheses/{hyp_id}/activate")
        assert response.status_code == 200
        assert response.json()["status"] == "active"
