"""Integration tests for the quote-to-invoice flow."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestQuoteRequestFlow:
    """Tests for quote request creation and extraction."""

    async def test_create_quote_request(self, client: AsyncClient, sample_quote_request_data):
        """Test creating a quote request."""
        response = await client.post("/api/v1/quote-requests", json=sample_quote_request_data)

        assert response.status_code == 201
        data = response.json()
        assert data["source_type"] == "manual"
        assert data["status"] == "new"
        assert "id" in data

    async def test_list_quote_requests(self, client: AsyncClient, sample_quote_request_data):
        """Test listing quote requests."""
        # Create a quote request first
        await client.post("/api/v1/quote-requests", json=sample_quote_request_data)

        response = await client.get("/api/v1/quote-requests")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestCustomerFlow:
    """Tests for customer management."""

    async def test_create_customer(self, client: AsyncClient, sample_customer_data):
        """Test creating a customer."""
        response = await client.post("/api/v1/customers", json=sample_customer_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_customer_data["name"]
        assert data["status"] == "active"
        assert "id" in data

    async def test_list_customers(self, client: AsyncClient, sample_customer_data):
        """Test listing customers."""
        # Create a customer first
        await client.post("/api/v1/customers", json=sample_customer_data)

        response = await client.get("/api/v1/customers")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_get_customer(self, client: AsyncClient, sample_customer_data):
        """Test getting a single customer."""
        # Create a customer
        create_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = create_response.json()["id"]

        # Get the customer
        response = await client.get(f"/api/v1/customers/{customer_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == customer_id
        assert data["name"] == sample_customer_data["name"]


class TestCarrierFlow:
    """Tests for carrier management."""

    async def test_create_carrier(self, client: AsyncClient, sample_carrier_data):
        """Test creating a carrier."""
        response = await client.post("/api/v1/carriers", json=sample_carrier_data)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_carrier_data["name"]
        assert data["status"] == "active"

    async def test_list_carriers_by_equipment(self, client: AsyncClient, sample_carrier_data):
        """Test listing carriers filtered by equipment type."""
        # Create a carrier
        await client.post("/api/v1/carriers", json=sample_carrier_data)

        # Filter by van
        response = await client.get("/api/v1/carriers", params={"equipment_type": "van"})

        assert response.status_code == 200
        data = response.json()
        assert all("van" in c.get("equipment_types", []) for c in data)


class TestQuoteFlow:
    """Tests for quote creation and management."""

    async def test_create_quote(self, client: AsyncClient, sample_customer_data, sample_quote_data):
        """Test creating a quote."""
        # Create a customer first
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        # Create quote with customer
        quote_data = {**sample_quote_data, "customer_id": customer_id}
        response = await client.post("/api/v1/quotes", json=quote_data)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["origin_city"] == "Chicago"
        assert "quote_number" in data

    async def test_update_quote(self, client: AsyncClient, sample_customer_data, sample_quote_data):
        """Test updating a quote."""
        # Create customer and quote
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        quote_data = {**sample_quote_data, "customer_id": customer_id}
        create_response = await client.post("/api/v1/quotes", json=quote_data)
        quote_id = create_response.json()["id"]

        # Update the quote
        update_data = {"estimated_cost": 180000}
        response = await client.patch(f"/api/v1/quotes/{quote_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert data["estimated_cost"] == 180000

    async def test_send_quote(self, client: AsyncClient, sample_customer_data, sample_quote_data):
        """Test sending a quote to customer."""
        # Create customer and quote
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        quote_data = {**sample_quote_data, "customer_id": customer_id}
        create_response = await client.post("/api/v1/quotes", json=quote_data)
        quote_id = create_response.json()["id"]

        # Send the quote
        response = await client.post(
            f"/api/v1/quotes/{quote_id}/send",
            json={"email": "customer@test.com"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "sent"
        assert data["sent_to"] == "customer@test.com"


class TestShipmentFlow:
    """Tests for shipment management."""

    async def test_book_quote_creates_shipment(
        self, client: AsyncClient, sample_customer_data, sample_quote_data
    ):
        """Test that booking a quote creates a shipment."""
        # Create customer and quote
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        quote_data = {**sample_quote_data, "customer_id": customer_id}
        create_response = await client.post("/api/v1/quotes", json=quote_data)
        quote_id = create_response.json()["id"]

        # Send the quote
        await client.post(f"/api/v1/quotes/{quote_id}/send", json={"email": "test@test.com"})

        # Accept the quote (simulate customer acceptance)
        await client.post(f"/api/v1/quotes/{quote_id}/accept")

        # Book the quote
        response = await client.post(f"/api/v1/quotes/{quote_id}/book")

        assert response.status_code == 200
        data = response.json()
        assert "shipment_id" in data
        assert "shipment_number" in data

    async def test_shipment_status_transitions(
        self, client: AsyncClient, sample_customer_data, sample_carrier_data
    ):
        """Test shipment status transitions."""
        # Create customer
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        # Create carrier
        carrier_response = await client.post("/api/v1/carriers", json=sample_carrier_data)
        carrier_id = carrier_response.json()["id"]

        # Create shipment directly
        shipment_data = {
            "customer_id": customer_id,
            "origin_city": "Chicago",
            "origin_state": "IL",
            "destination_city": "Dallas",
            "destination_state": "TX",
            "equipment_type": "van",
            "customer_price": 280000,
        }
        create_response = await client.post("/api/v1/shipments", json=shipment_data)
        shipment_id = create_response.json()["id"]

        # Assign carrier
        await client.patch(
            f"/api/v1/shipments/{shipment_id}",
            json={"carrier_id": carrier_id, "carrier_cost": 200000}
        )

        # Transition to pending pickup
        response = await client.post(
            f"/api/v1/shipments/{shipment_id}/transition",
            json={"status": "pending_pickup"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "pending_pickup"

        # Transition to in transit
        response = await client.post(
            f"/api/v1/shipments/{shipment_id}/transition",
            json={"status": "in_transit"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_transit"

        # Transition to delivered
        response = await client.post(
            f"/api/v1/shipments/{shipment_id}/transition",
            json={"status": "delivered"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "delivered"


class TestInvoiceFlow:
    """Tests for invoice management."""

    async def test_create_invoice_from_shipment(
        self, client: AsyncClient, sample_customer_data
    ):
        """Test creating an invoice from a delivered shipment."""
        # Create customer
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        # Create shipment
        shipment_data = {
            "customer_id": customer_id,
            "origin_city": "Chicago",
            "origin_state": "IL",
            "destination_city": "Dallas",
            "destination_state": "TX",
            "equipment_type": "van",
            "customer_price": 280000,
        }
        shipment_response = await client.post("/api/v1/shipments", json=shipment_data)
        shipment_id = shipment_response.json()["id"]

        # Deliver the shipment
        await client.post(f"/api/v1/shipments/{shipment_id}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{shipment_id}/transition", json={"status": "in_transit"})
        await client.post(f"/api/v1/shipments/{shipment_id}/transition", json={"status": "delivered"})

        # Create invoice from shipment
        response = await client.post(f"/api/v1/invoices/from-shipment/{shipment_id}")

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert "invoice_number" in data

    async def test_send_invoice(self, client: AsyncClient, sample_customer_data):
        """Test sending an invoice."""
        # Create customer
        customer_response = await client.post("/api/v1/customers", json=sample_customer_data)
        customer_id = customer_response.json()["id"]

        # Create invoice directly
        invoice_data = {
            "customer_id": customer_id,
            "line_items": [
                {"description": "Freight charges", "quantity": 1, "unit_price": 280000}
            ]
        }
        create_response = await client.post("/api/v1/invoices", json=invoice_data)
        invoice_id = create_response.json()["id"]

        # Send the invoice
        response = await client.post(f"/api/v1/invoices/{invoice_id}/send")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "sent"


class TestWorkItemFlow:
    """Tests for work item (inbox) management."""

    async def test_list_work_items(self, client: AsyncClient):
        """Test listing work items."""
        response = await client.get("/api/v1/work-items")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_dashboard_stats(self, client: AsyncClient):
        """Test getting dashboard stats."""
        response = await client.get("/api/v1/work-items/dashboard")

        assert response.status_code == 200
        data = response.json()
        assert "work_items_by_type" in data
        assert "overdue_count" in data


class TestHealthCheck:
    """Tests for API health."""

    async def test_health_endpoint(self, client: AsyncClient):
        """Test health check endpoint."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
