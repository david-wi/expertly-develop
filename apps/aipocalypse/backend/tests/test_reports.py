"""Tests for research reports API."""


class TestReportsCRUD:
    async def _create_company(self, client):
        """Helper to create a company and return its ID."""
        resp = await client.post("/api/v1/companies", json={
            "name": "Test Company",
            "ticker": "TEST",
            "description": "A test company",
        })
        return resp.json()["id"]

    async def test_create_report(self, client, sample_report_data):
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id

        response = await client.post("/api/v1/reports", json=sample_report_data)
        assert response.status_code == 201
        data = response.json()
        assert data["signal"] == "sell"
        assert data["signal_confidence"] == 75
        assert data["company_name"] == "Test Company"
        assert data["company_ticker"] == "TEST"
        assert data["version"] == 1
        assert data["moat_rating"] == "weak"
        assert data["ai_vulnerability_score"] == 70

    async def test_create_report_updates_company(self, client, sample_report_data):
        """Creating a report should update the company's latest_signal and report_count."""
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id

        await client.post("/api/v1/reports", json=sample_report_data)

        company_resp = await client.get(f"/api/v1/companies/{company_id}")
        company = company_resp.json()
        assert company["latest_signal"] == "sell"
        assert company["report_count"] == 1
        assert company["latest_report_id"] is not None

    async def test_create_multiple_reports_increments_version(self, client, sample_report_data):
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id

        resp1 = await client.post("/api/v1/reports", json=sample_report_data)
        assert resp1.json()["version"] == 1

        sample_report_data["signal"] = "strong_sell"
        resp2 = await client.post("/api/v1/reports", json=sample_report_data)
        assert resp2.json()["version"] == 2

        # Company should reflect latest signal
        company_resp = await client.get(f"/api/v1/companies/{company_id}")
        assert company_resp.json()["latest_signal"] == "strong_sell"
        assert company_resp.json()["report_count"] == 2

    async def test_list_reports(self, client, sample_report_data):
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id

        await client.post("/api/v1/reports", json=sample_report_data)
        await client.post("/api/v1/reports", json=sample_report_data)

        response = await client.get("/api/v1/reports")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    async def test_list_reports_filter_by_company(self, client, sample_report_data):
        company_id1 = await self._create_company(client)
        resp2 = await client.post("/api/v1/companies", json={
            "name": "Other Corp", "ticker": "OTH", "description": "Other company"
        })
        company_id2 = resp2.json()["id"]

        sample_report_data["company_id"] = company_id1
        await client.post("/api/v1/reports", json=sample_report_data)

        sample_report_data["company_id"] = company_id2
        await client.post("/api/v1/reports", json=sample_report_data)

        # Filter by first company
        response = await client.get("/api/v1/reports", params={"company_id": company_id1})
        assert len(response.json()) == 1
        assert response.json()[0]["company_ticker"] == "TEST"

    async def test_get_report(self, client, sample_report_data):
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id

        create_resp = await client.post("/api/v1/reports", json=sample_report_data)
        report_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/reports/{report_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["executive_summary"] == sample_report_data["executive_summary"]
        assert data["business_model_analysis"] == sample_report_data["business_model_analysis"]

    async def test_get_report_not_found(self, client):
        response = await client.get("/api/v1/reports/000000000000000000000000")
        assert response.status_code == 404

    async def test_delete_report(self, client, sample_report_data):
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id

        create_resp = await client.post("/api/v1/reports", json=sample_report_data)
        report_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/reports/{report_id}")
        assert response.status_code == 200
        assert response.json()["deleted"] is True

        response = await client.get(f"/api/v1/reports/{report_id}")
        assert response.status_code == 404

    async def test_create_report_invalid_company(self, client, sample_report_data):
        sample_report_data["company_id"] = "000000000000000000000000"
        response = await client.post("/api/v1/reports", json=sample_report_data)
        assert response.status_code == 404

    async def test_create_report_validation(self, client, sample_report_data):
        """Signal confidence must be 0-100."""
        company_id = await self._create_company(client)
        sample_report_data["company_id"] = company_id
        sample_report_data["signal_confidence"] = 150
        response = await client.post("/api/v1/reports", json=sample_report_data)
        assert response.status_code == 422
