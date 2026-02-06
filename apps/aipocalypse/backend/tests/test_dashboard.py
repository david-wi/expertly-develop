"""Tests for dashboard API endpoints."""


class TestDashboard:
    async def _setup_data(self, client):
        """Create sample companies, hypotheses, and reports for dashboard tests."""
        # Create hypotheses
        hyp_resp = await client.post("/api/v1/hypotheses", json={
            "title": "AI Disruption",
            "description": "AI will disrupt everything",
            "thesis_type": "disruption",
            "confidence_level": 80,
        })
        hyp_id = hyp_resp.json()["id"]

        # Create companies
        companies = []
        for name, ticker, signal in [
            ("Strong Sell Corp", "SSC", "strong_sell"),
            ("Sell Corp", "SLC", "sell"),
            ("Hold Corp", "HLC", "hold"),
        ]:
            resp = await client.post("/api/v1/companies", json={
                "name": name, "ticker": ticker, "description": f"{name} description",
                "linked_hypothesis_ids": [hyp_id],
            })
            companies.append(resp.json())

        # Create reports for each company (this updates their signals)
        for company, signal in zip(companies, ["strong_sell", "sell", "hold"]):
            await client.post("/api/v1/reports", json={
                "company_id": company["id"],
                "signal": signal,
                "signal_confidence": 70,
                "executive_summary": f"Summary for {company['name']}",
                "business_model_analysis": "Test",
                "revenue_sources": "Test",
                "margin_analysis": "Test",
                "moat_assessment": "Test",
                "moat_rating": "moderate",
                "ai_impact_analysis": "Test",
                "ai_vulnerability_score": 60,
                "competitive_landscape": "Test",
                "valuation_assessment": "Test",
                "investment_recommendation": "Test",
            })

        return hyp_id, companies

    async def test_stats_empty(self, client):
        response = await client.get("/api/v1/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_companies"] == 0
        assert data["total_reports"] == 0
        assert data["total_hypotheses"] == 0
        assert data["strong_sell_count"] == 0

    async def test_stats_with_data(self, client):
        await self._setup_data(client)

        response = await client.get("/api/v1/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_companies"] == 3
        assert data["total_reports"] == 3
        assert data["total_hypotheses"] == 1
        assert data["strong_sell_count"] == 1
        assert data["sell_count"] == 1
        assert data["hold_count"] == 1
        assert data["buy_count"] == 0
        assert data["strong_buy_count"] == 0

    async def test_leaderboard_empty(self, client):
        response = await client.get("/api/v1/dashboard/leaderboard")
        assert response.status_code == 200
        assert response.json() == []

    async def test_leaderboard_with_data(self, client):
        await self._setup_data(client)

        response = await client.get("/api/v1/dashboard/leaderboard")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Sorted by name
        assert data[0]["name"] == "Hold Corp"
        assert data[1]["name"] == "Sell Corp"
        assert data[2]["name"] == "Strong Sell Corp"
        # Check signal fields
        assert data[0]["signal"] == "hold"
        assert data[1]["signal"] == "sell"
        assert data[2]["signal"] == "strong_sell"
        # Check hypothesis names
        assert len(data[0]["hypothesis_names"]) == 1
        assert data[0]["hypothesis_names"][0] == "AI Disruption"

    async def test_leaderboard_filter_by_signal(self, client):
        await self._setup_data(client)

        response = await client.get("/api/v1/dashboard/leaderboard", params={"signal": "sell"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["signal"] == "sell"

    async def test_leaderboard_filter_by_hypothesis(self, client):
        hyp_id, _ = await self._setup_data(client)

        response = await client.get("/api/v1/dashboard/leaderboard", params={"hypothesis_id": hyp_id})
        assert response.status_code == 200
        assert len(response.json()) == 3

    async def test_by_hypothesis(self, client):
        hyp_id, _ = await self._setup_data(client)

        response = await client.get(f"/api/v1/dashboard/by-hypothesis/{hyp_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        for entry in data:
            assert "id" in entry
            assert "name" in entry
            assert "ticker" in entry
            assert "latest_signal" in entry

    async def test_by_hypothesis_empty(self, client):
        response = await client.get("/api/v1/dashboard/by-hypothesis/000000000000000000000000")
        assert response.status_code == 200
        assert response.json() == []
