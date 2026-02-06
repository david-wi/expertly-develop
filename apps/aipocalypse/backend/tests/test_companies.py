"""Tests for companies CRUD API."""


class TestCompaniesCRUD:
    async def test_create_company(self, client, sample_company_data):
        response = await client.post("/api/v1/companies", json=sample_company_data)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Acme Corp"
        assert data["ticker"] == "ACME"
        assert data["exchange"] == "NYSE"
        assert data["latest_signal"] is None
        assert data["report_count"] == 0
        assert "id" in data

    async def test_list_companies(self, client, sample_company_data):
        await client.post("/api/v1/companies", json=sample_company_data)
        second = {**sample_company_data, "name": "Beta Inc", "ticker": "BETA"}
        await client.post("/api/v1/companies", json=second)

        response = await client.get("/api/v1/companies")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Should be sorted by name
        assert data[0]["name"] == "Acme Corp"
        assert data[1]["name"] == "Beta Inc"

    async def test_list_companies_search(self, client, sample_company_data):
        await client.post("/api/v1/companies", json=sample_company_data)
        second = {**sample_company_data, "name": "Beta Inc", "ticker": "BETA"}
        await client.post("/api/v1/companies", json=second)

        response = await client.get("/api/v1/companies", params={"search": "beta"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["ticker"] == "BETA"

    async def test_list_companies_filter_by_signal(self, client, sample_company_data):
        resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = resp.json()["id"]

        # No companies should have signals initially
        response = await client.get("/api/v1/companies", params={"signal": "sell"})
        assert len(response.json()) == 0

    async def test_get_company(self, client, sample_company_data):
        create_resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/companies/{company_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Acme Corp"

    async def test_get_company_not_found(self, client):
        response = await client.get("/api/v1/companies/000000000000000000000000")
        assert response.status_code == 404

    async def test_update_company(self, client, sample_company_data):
        create_resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = create_resp.json()["id"]

        response = await client.patch(f"/api/v1/companies/{company_id}", json={
            "name": "Acme Corp Updated",
            "description": "Updated description",
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Acme Corp Updated"
        assert response.json()["description"] == "Updated description"
        assert response.json()["ticker"] == "ACME"  # Unchanged

    async def test_delete_company(self, client, sample_company_data):
        create_resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/companies/{company_id}")
        assert response.status_code == 200
        assert response.json()["deleted"] is True

        response = await client.get(f"/api/v1/companies/{company_id}")
        assert response.status_code == 404

    async def test_link_hypothesis(self, client, sample_company_data, sample_hypothesis_data):
        company_resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = company_resp.json()["id"]
        hyp_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = hyp_resp.json()["id"]

        response = await client.post(f"/api/v1/companies/{company_id}/link-hypothesis", json={
            "hypothesis_id": hyp_id,
        })
        assert response.status_code == 200
        assert response.json()["linked"] is True

        # Verify linked
        get_resp = await client.get(f"/api/v1/companies/{company_id}")
        assert hyp_id in get_resp.json()["linked_hypothesis_ids"]

    async def test_unlink_hypothesis(self, client, sample_company_data, sample_hypothesis_data):
        company_resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = company_resp.json()["id"]
        hyp_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = hyp_resp.json()["id"]

        # Link first
        await client.post(f"/api/v1/companies/{company_id}/link-hypothesis", json={
            "hypothesis_id": hyp_id,
        })

        # Unlink
        response = await client.post(f"/api/v1/companies/{company_id}/unlink-hypothesis", json={
            "hypothesis_id": hyp_id,
        })
        assert response.status_code == 200
        assert response.json()["unlinked"] is True

        get_resp = await client.get(f"/api/v1/companies/{company_id}")
        assert hyp_id not in get_resp.json()["linked_hypothesis_ids"]

    async def test_link_hypothesis_idempotent(self, client, sample_company_data, sample_hypothesis_data):
        """Linking the same hypothesis twice should not create duplicates."""
        company_resp = await client.post("/api/v1/companies", json=sample_company_data)
        company_id = company_resp.json()["id"]
        hyp_resp = await client.post("/api/v1/hypotheses", json=sample_hypothesis_data)
        hyp_id = hyp_resp.json()["id"]

        await client.post(f"/api/v1/companies/{company_id}/link-hypothesis", json={"hypothesis_id": hyp_id})
        await client.post(f"/api/v1/companies/{company_id}/link-hypothesis", json={"hypothesis_id": hyp_id})

        get_resp = await client.get(f"/api/v1/companies/{company_id}")
        assert get_resp.json()["linked_hypothesis_ids"].count(hyp_id) == 1
