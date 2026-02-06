"""API tests for quote requests and quotes."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ============================================================================
# Quote Requests
# ============================================================================

class TestCreateQuoteRequest:
    """Tests for POST /api/v1/quote-requests."""

    async def test_create_quote_request_returns_201(
        self, client: AsyncClient, sample_quote_request_data
    ):
        """Creating a quote request with valid data returns 201."""
        response = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)

        assert response.status_code == 201
        data = response.json()
        assert data["source_type"] == "manual"
        assert data["status"] == "new"
        assert data["source_subject"] == "Rate request Chicago to Dallas"
        assert data["sender_email"] == "john@customer.com"
        assert "id" in data

    async def test_create_quote_request_minimal(self, client: AsyncClient):
        """Creating a quote request with minimal data."""
        response = await client.post(
            "/api/v1/quote-requests",
            json={"source_type": "phone"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["source_type"] == "phone"
        assert data["status"] == "new"

    async def test_create_quote_request_with_customer(self, client: AsyncClient, created_customer):
        """Creating a quote request linked to a customer."""
        payload = {
            "source_type": "manual",
            "customer_id": created_customer["id"],
            "source_subject": "Rate request from existing customer",
        }
        response = await client.post("/api/v1/quote-requests", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["customer_id"] == created_customer["id"]


class TestListQuoteRequests:
    """Tests for GET /api/v1/quote-requests."""

    async def test_list_quote_requests_empty(self, client: AsyncClient):
        """Listing quote requests when none exist."""
        response = await client.get("/api/v1/quote-requests")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_quote_requests_returns_all(
        self, client: AsyncClient, sample_quote_request_data
    ):
        """Listing returns all created quote requests."""
        await client.post("/api/v1/quote-requests", json=sample_quote_request_data)
        await client.post("/api/v1/quote-requests", json={"source_type": "phone"})

        response = await client.get("/api/v1/quote-requests")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_list_quote_requests_filter_by_status(
        self, client: AsyncClient, sample_quote_request_data
    ):
        """Filtering quote requests by status."""
        await client.post("/api/v1/quote-requests", json=sample_quote_request_data)

        response = await client.get("/api/v1/quote-requests", params={"status": "new"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(qr["status"] == "new" for qr in data)


class TestGetQuoteRequest:
    """Tests for GET /api/v1/quote-requests/{id}."""

    async def test_get_quote_request_by_id(self, client: AsyncClient, sample_quote_request_data):
        """Getting a quote request by ID."""
        create_resp = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)
        qr_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/quote-requests/{qr_id}")

        assert response.status_code == 200
        assert response.json()["id"] == qr_id

    async def test_get_quote_request_not_found(self, client: AsyncClient):
        """Getting a non-existent quote request returns 404."""
        response = await client.get("/api/v1/quote-requests/507f1f77bcf86cd799439011")

        assert response.status_code == 404


class TestUpdateQuoteRequest:
    """Tests for PATCH /api/v1/quote-requests/{id}."""

    async def test_update_quote_request_assign_user(
        self, client: AsyncClient, sample_quote_request_data
    ):
        """Assigning a user to a quote request."""
        create_resp = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)
        qr_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/quote-requests/{qr_id}",
            json={"assigned_to": "user-123"},
        )

        assert response.status_code == 200
        assert response.json()["assigned_to"] == "user-123"

    async def test_update_quote_request_status_transition(
        self, client: AsyncClient, sample_quote_request_data
    ):
        """Valid status transition: new -> in_progress."""
        create_resp = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)
        qr_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/quote-requests/{qr_id}",
            json={"status": "in_progress"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"

    async def test_update_quote_request_link_customer(
        self, client: AsyncClient, sample_quote_request_data, created_customer
    ):
        """Linking a customer to a quote request."""
        create_resp = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)
        qr_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/quote-requests/{qr_id}",
            json={"customer_id": created_customer["id"]},
        )

        assert response.status_code == 200
        assert response.json()["customer_id"] == created_customer["id"]


class TestCreateQuoteFromRequest:
    """Tests for POST /api/v1/quote-requests/{id}/create-quote."""

    async def test_create_quote_from_request_requires_customer(
        self, client: AsyncClient, sample_quote_request_data
    ):
        """Creating a quote from request without customer returns 400."""
        create_resp = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)
        qr_id = create_resp.json()["id"]

        response = await client.post(f"/api/v1/quote-requests/{qr_id}/create-quote")

        assert response.status_code == 400
        assert "customer" in response.json()["detail"].lower()

    async def test_create_quote_from_request_with_customer(
        self, client: AsyncClient, sample_quote_request_data, created_customer
    ):
        """Creating a quote from a request that has a customer."""
        # Create and link customer
        qr_data = {**sample_quote_request_data, "customer_id": created_customer["id"]}
        create_resp = await client.post("/api/v1/quote-requests", json=qr_data)
        qr_id = create_resp.json()["id"]

        response = await client.post(f"/api/v1/quote-requests/{qr_id}/create-quote")

        assert response.status_code == 200
        data = response.json()
        assert "quote_id" in data
        assert "quote_number" in data
        assert data["quote_number"].startswith("Q-")

    async def test_create_quote_from_request_updates_status(
        self, client: AsyncClient, sample_quote_request_data, created_customer
    ):
        """Creating a quote from request updates the request status to quoted."""
        qr_data = {**sample_quote_request_data, "customer_id": created_customer["id"]}
        create_resp = await client.post("/api/v1/quote-requests", json=qr_data)
        qr_id = create_resp.json()["id"]

        await client.post(f"/api/v1/quote-requests/{qr_id}/create-quote")

        # Verify the quote request status changed
        qr_response = await client.get(f"/api/v1/quote-requests/{qr_id}")
        assert qr_response.json()["status"] == "quoted"
        assert qr_response.json()["quote_id"] is not None


# ============================================================================
# Quotes
# ============================================================================

class TestCreateQuote:
    """Tests for POST /api/v1/quotes."""

    async def test_create_quote_returns_201(
        self, client: AsyncClient, created_customer, sample_quote_data
    ):
        """Creating a quote with valid data returns 201."""
        quote_data = {**sample_quote_data, "customer_id": created_customer["id"]}
        response = await client.post("/api/v1/quotes", json=quote_data)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["origin_city"] == "Chicago"
        assert data["origin_state"] == "IL"
        assert data["destination_city"] == "Dallas"
        assert data["destination_state"] == "TX"
        assert data["equipment_type"] == "van"
        assert "quote_number" in data
        assert data["quote_number"].startswith("Q-")
        # Totals should be calculated
        assert data["total_price"] == 280000  # 250000 + 30000
        assert data["estimated_cost"] == 200000

    async def test_create_quote_generates_unique_numbers(
        self, client: AsyncClient, created_customer, sample_quote_data
    ):
        """Each quote gets a unique number."""
        quote_data = {**sample_quote_data, "customer_id": created_customer["id"]}
        resp1 = await client.post("/api/v1/quotes", json=quote_data)
        resp2 = await client.post("/api/v1/quotes", json=quote_data)

        assert resp1.json()["quote_number"] != resp2.json()["quote_number"]

    async def test_create_quote_calculates_margin(
        self, client: AsyncClient, created_customer, sample_quote_data
    ):
        """Quote creation calculates margin percent correctly."""
        quote_data = {**sample_quote_data, "customer_id": created_customer["id"]}
        response = await client.post("/api/v1/quotes", json=quote_data)

        data = response.json()
        # Total = 280000, Cost = 200000, Margin = (280000-200000)/280000 = 28.57%
        assert data["margin_percent"] == pytest.approx(28.57, rel=0.01)


class TestListQuotes:
    """Tests for GET /api/v1/quotes."""

    async def test_list_quotes_empty(self, client: AsyncClient):
        """Listing quotes when none exist."""
        response = await client.get("/api/v1/quotes")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_quotes_filter_by_status(
        self, client: AsyncClient, created_customer, sample_quote_data
    ):
        """Filtering quotes by status."""
        quote_data = {**sample_quote_data, "customer_id": created_customer["id"]}
        await client.post("/api/v1/quotes", json=quote_data)

        response = await client.get("/api/v1/quotes", params={"status": "draft"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(q["status"] == "draft" for q in data)

    async def test_list_quotes_filter_by_customer(
        self, client: AsyncClient, created_customer, sample_quote_data
    ):
        """Filtering quotes by customer_id."""
        quote_data = {**sample_quote_data, "customer_id": created_customer["id"]}
        await client.post("/api/v1/quotes", json=quote_data)

        response = await client.get("/api/v1/quotes", params={"customer_id": created_customer["id"]})
        data = response.json()
        assert len(data) >= 1
        assert all(q["customer_id"] == created_customer["id"] for q in data)


class TestGetQuote:
    """Tests for GET /api/v1/quotes/{id}."""

    async def test_get_quote_by_id(self, client: AsyncClient, created_quote):
        """Getting a quote by ID."""
        response = await client.get(f"/api/v1/quotes/{created_quote['id']}")

        assert response.status_code == 200
        assert response.json()["id"] == created_quote["id"]

    async def test_get_quote_not_found(self, client: AsyncClient):
        """Getting a non-existent quote returns 404."""
        response = await client.get("/api/v1/quotes/507f1f77bcf86cd799439011")

        assert response.status_code == 404


class TestUpdateQuote:
    """Tests for PATCH /api/v1/quotes/{id}."""

    async def test_update_quote_estimated_cost(self, client: AsyncClient, created_quote):
        """Updating estimated cost recalculates margin."""
        response = await client.patch(
            f"/api/v1/quotes/{created_quote['id']}",
            json={"estimated_cost": 180000},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["estimated_cost"] == 180000
        # Margin should be recalculated: (280000-180000)/280000 = 35.71%
        assert data["margin_percent"] == pytest.approx(35.71, rel=0.01)

    async def test_update_quote_line_items(self, client: AsyncClient, created_quote):
        """Updating line items recalculates totals."""
        new_line_items = [
            {"description": "Linehaul", "quantity": 1, "unit_price": 300000, "is_accessorial": False},
        ]
        response = await client.patch(
            f"/api/v1/quotes/{created_quote['id']}",
            json={"line_items": new_line_items},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_price"] == 300000

    async def test_update_quote_not_found(self, client: AsyncClient):
        """Updating a non-existent quote returns 404."""
        response = await client.patch(
            "/api/v1/quotes/507f1f77bcf86cd799439011",
            json={"equipment_type": "reefer"},
        )

        assert response.status_code == 404


class TestSendQuote:
    """Tests for POST /api/v1/quotes/{id}/send."""

    async def test_send_quote(self, client: AsyncClient, created_quote):
        """Sending a draft quote transitions it to sent."""
        response = await client.post(
            f"/api/v1/quotes/{created_quote['id']}/send",
            json={"email": "customer@test.com"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "sent"
        assert data["sent_to"] == "customer@test.com"
        assert data["sent_at"] is not None

    async def test_send_quote_not_found(self, client: AsyncClient):
        """Sending a non-existent quote returns 404."""
        response = await client.post(
            "/api/v1/quotes/507f1f77bcf86cd799439011/send",
            json={"email": "test@test.com"},
        )

        assert response.status_code == 404


class TestQuoteStatusTransitions:
    """Tests for quote status state machine."""

    async def test_draft_to_sent(self, client: AsyncClient, created_quote):
        """Valid transition: draft -> sent."""
        response = await client.post(
            f"/api/v1/quotes/{created_quote['id']}/send",
            json={"email": "test@test.com"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "sent"

    async def test_draft_to_pending_approval(self, client: AsyncClient, created_quote):
        """Valid transition: draft -> pending_approval."""
        response = await client.patch(
            f"/api/v1/quotes/{created_quote['id']}",
            json={"status": "pending_approval"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "pending_approval"


class TestBookQuote:
    """Tests for POST /api/v1/quotes/{id}/book."""

    async def test_book_sent_quote_creates_shipment(self, client: AsyncClient, created_quote):
        """Booking a sent quote creates a shipment."""
        # First send the quote
        await client.post(
            f"/api/v1/quotes/{created_quote['id']}/send",
            json={"email": "test@test.com"},
        )

        # Book the quote
        response = await client.post(f"/api/v1/quotes/{created_quote['id']}/book")

        assert response.status_code == 200
        data = response.json()
        assert "shipment_id" in data
        assert "shipment_number" in data
        assert data["shipment_number"].startswith("S-")

    async def test_book_draft_quote_fails(self, client: AsyncClient, created_quote):
        """Cannot book a quote that has not been sent."""
        response = await client.post(f"/api/v1/quotes/{created_quote['id']}/book")

        assert response.status_code == 400
        assert "sent" in response.json()["detail"].lower()

    async def test_book_quote_updates_quote_status(self, client: AsyncClient, created_quote):
        """Booking a quote updates its status to accepted."""
        await client.post(
            f"/api/v1/quotes/{created_quote['id']}/send",
            json={"email": "test@test.com"},
        )
        await client.post(f"/api/v1/quotes/{created_quote['id']}/book")

        # Check the quote
        quote_resp = await client.get(f"/api/v1/quotes/{created_quote['id']}")
        data = quote_resp.json()
        assert data["status"] == "accepted"
        assert data["shipment_id"] is not None

    async def test_book_quote_not_found(self, client: AsyncClient):
        """Booking a non-existent quote returns 404."""
        response = await client.post("/api/v1/quotes/507f1f77bcf86cd799439011/book")

        assert response.status_code == 404
