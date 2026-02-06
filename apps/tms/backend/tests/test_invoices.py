"""API tests for invoice CRUD, status transitions, and payments."""
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCreateInvoice:
    """Tests for POST /api/v1/invoices."""

    async def test_create_invoice_returns_201(
        self, client: AsyncClient, created_customer, sample_invoice_data
    ):
        """Creating an invoice with valid data returns 201."""
        invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
        response = await client.post("/api/v1/invoices", json=invoice_data)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["billing_name"] == "Test Customer Inc"
        assert data["customer_id"] == created_customer["id"]
        assert "invoice_number" in data
        assert data["invoice_number"].startswith("INV-")
        # Totals should be calculated from line items
        assert data["subtotal"] == 280000
        assert data["total"] == 280000  # No tax
        assert data["amount_paid"] == 0
        assert data["amount_due"] == 280000

    async def test_create_invoice_generates_unique_numbers(
        self, client: AsyncClient, created_customer, sample_invoice_data
    ):
        """Each invoice gets a unique number."""
        invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
        resp1 = await client.post("/api/v1/invoices", json=invoice_data)
        resp2 = await client.post("/api/v1/invoices", json=invoice_data)

        assert resp1.json()["invoice_number"] != resp2.json()["invoice_number"]

    async def test_create_invoice_with_tax(
        self, client: AsyncClient, created_customer
    ):
        """Creating an invoice with tax amount."""
        invoice_data = {
            "customer_id": created_customer["id"],
            "billing_name": "Test Corp",
            "line_items": [
                {"description": "Freight", "quantity": 1, "unit_price": 100000},
            ],
            "tax_amount": 8000,
        }
        response = await client.post("/api/v1/invoices", json=invoice_data)

        assert response.status_code == 201
        data = response.json()
        assert data["subtotal"] == 100000
        assert data["tax_amount"] == 8000
        assert data["total"] == 108000

    async def test_create_invoice_with_multiple_line_items(
        self, client: AsyncClient, created_customer
    ):
        """Creating an invoice with multiple line items."""
        invoice_data = {
            "customer_id": created_customer["id"],
            "billing_name": "Test Corp",
            "line_items": [
                {"description": "Linehaul", "quantity": 1, "unit_price": 250000},
                {"description": "Fuel surcharge", "quantity": 1, "unit_price": 30000},
                {"description": "Detention", "quantity": 2, "unit_price": 7500},
            ],
        }
        response = await client.post("/api/v1/invoices", json=invoice_data)

        assert response.status_code == 201
        data = response.json()
        assert len(data["line_items"]) == 3
        assert data["subtotal"] == 295000  # 250000 + 30000 + 2*7500

    async def test_create_invoice_sets_due_date_from_customer_terms(
        self, client: AsyncClient, created_customer, sample_invoice_data
    ):
        """Invoice due date is calculated from customer payment terms."""
        invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
        response = await client.post("/api/v1/invoices", json=invoice_data)

        data = response.json()
        assert data["due_date"] is not None


class TestCreateInvoiceFromShipment:
    """Tests for POST /api/v1/invoices/from-shipment/{shipment_id}."""

    async def test_create_invoice_from_delivered_shipment(self, client: AsyncClient, created_customer):
        """Creating an invoice from a delivered shipment."""
        # Create and deliver a shipment
        shipment_data = {
            "customer_id": created_customer["id"],
            "customer_price": 280000,
            "stops": [
                {"stop_number": 1, "stop_type": "pickup", "address": "123 Main", "city": "Chicago", "state": "IL", "zip_code": "60601"},
                {"stop_number": 2, "stop_type": "delivery", "address": "456 Oak", "city": "Dallas", "state": "TX", "zip_code": "75201"},
            ],
        }
        ship_resp = await client.post("/api/v1/shipments", json=shipment_data)
        sid = ship_resp.json()["id"]

        # Deliver the shipment
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "in_transit"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "delivered"})

        # Create invoice from shipment
        response = await client.post(f"/api/v1/invoices/from-shipment/{sid}")

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["billing_name"] == created_customer["name"]
        assert len(data["line_items"]) == 1
        assert data["total"] == 280000
        assert "invoice_number" in data

    async def test_create_invoice_from_non_delivered_shipment_fails(
        self, client: AsyncClient, created_shipment
    ):
        """Cannot create invoice from a shipment that is not delivered."""
        response = await client.post(
            f"/api/v1/invoices/from-shipment/{created_shipment['id']}"
        )

        assert response.status_code == 400
        assert "delivered" in response.json()["detail"].lower()

    async def test_create_invoice_from_nonexistent_shipment(self, client: AsyncClient):
        """Creating invoice from non-existent shipment returns 404."""
        response = await client.post("/api/v1/invoices/from-shipment/507f1f77bcf86cd799439011")

        assert response.status_code == 404


class TestListInvoices:
    """Tests for GET /api/v1/invoices."""

    async def test_list_invoices_empty(self, client: AsyncClient):
        """Listing invoices when none exist."""
        response = await client.get("/api/v1/invoices")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_invoices_returns_all(
        self, client: AsyncClient, created_customer, sample_invoice_data
    ):
        """Listing returns all created invoices."""
        invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
        await client.post("/api/v1/invoices", json=invoice_data)
        await client.post("/api/v1/invoices", json=invoice_data)

        response = await client.get("/api/v1/invoices")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_list_invoices_filter_by_status(
        self, client: AsyncClient, created_customer, sample_invoice_data
    ):
        """Filtering invoices by status."""
        invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
        await client.post("/api/v1/invoices", json=invoice_data)

        response = await client.get("/api/v1/invoices", params={"status": "draft"})
        data = response.json()
        assert len(data) >= 1
        assert all(i["status"] == "draft" for i in data)

    async def test_list_invoices_filter_by_customer(
        self, client: AsyncClient, created_customer, sample_invoice_data
    ):
        """Filtering invoices by customer_id."""
        invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
        await client.post("/api/v1/invoices", json=invoice_data)

        response = await client.get("/api/v1/invoices", params={"customer_id": created_customer["id"]})
        data = response.json()
        assert len(data) >= 1
        assert all(i["customer_id"] == created_customer["id"] for i in data)


class TestGetInvoice:
    """Tests for GET /api/v1/invoices/{id}."""

    async def test_get_invoice_by_id(self, client: AsyncClient, created_invoice):
        """Getting an invoice by ID."""
        response = await client.get(f"/api/v1/invoices/{created_invoice['id']}")

        assert response.status_code == 200
        assert response.json()["id"] == created_invoice["id"]

    async def test_get_invoice_not_found(self, client: AsyncClient):
        """Getting a non-existent invoice returns 404."""
        response = await client.get("/api/v1/invoices/507f1f77bcf86cd799439011")

        assert response.status_code == 404


class TestUpdateInvoice:
    """Tests for PATCH /api/v1/invoices/{id}."""

    async def test_update_invoice_notes(self, client: AsyncClient, created_invoice):
        """Updating invoice notes."""
        response = await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"notes": "Please pay promptly"},
        )

        assert response.status_code == 200
        assert response.json()["notes"] == "Please pay promptly"

    async def test_update_invoice_line_items_recalculates(self, client: AsyncClient, created_invoice):
        """Updating line items recalculates totals."""
        new_line_items = [
            {"description": "Freight", "quantity": 1, "unit_price": 300000},
            {"description": "Accessorial", "quantity": 1, "unit_price": 15000},
        ]
        response = await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"line_items": new_line_items},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["subtotal"] == 315000
        assert data["total"] == 315000

    async def test_update_invoice_not_found(self, client: AsyncClient):
        """Updating a non-existent invoice returns 404."""
        response = await client.patch(
            "/api/v1/invoices/507f1f77bcf86cd799439011",
            json={"notes": "test"},
        )

        assert response.status_code == 404


class TestInvoiceStatusTransitions:
    """Tests for invoice status state machine."""

    async def test_draft_to_pending(self, client: AsyncClient, created_invoice):
        """Valid transition: draft -> pending."""
        response = await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "pending"

    async def test_draft_to_void(self, client: AsyncClient, created_invoice):
        """Valid transition: draft -> void."""
        response = await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "void"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "void"

    async def test_send_invoice(self, client: AsyncClient, created_invoice):
        """Sending a draft invoice transitions to sent."""
        # First go to pending
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )

        # Send
        response = await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "sent"
        assert data["sent_at"] is not None

    async def test_send_draft_invoice_directly(self, client: AsyncClient, created_invoice):
        """Sending a draft invoice fails (must go to pending first)."""
        # The Invoice model allows DRAFT -> PENDING -> SENT
        # But the /send endpoint calls transition_to(SENT) which from DRAFT is not valid
        # Actually checking the transitions: DRAFT can go to PENDING or VOID
        # PENDING can go to SENT, DRAFT, or VOID
        response = await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")

        # transition_to(SENT) from DRAFT: DRAFT -> [PENDING, VOID], so SENT is invalid
        # The route catches ValueError and should return an error
        assert response.status_code == 500 or response.status_code == 400

    async def test_sent_to_paid(self, client: AsyncClient, created_invoice):
        """Valid transition: sent -> paid."""
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )
        await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")

        response = await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "paid"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "paid"

    async def test_paid_cannot_transition(self, client: AsyncClient, created_invoice):
        """Paid invoices cannot transition to any other status."""
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )
        await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "paid"},
        )

        # Try to void a paid invoice
        response = await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "void"},
        )

        assert response.status_code == 500 or response.status_code == 400


class TestInvoicePayments:
    """Tests for POST /api/v1/invoices/{id}/payment."""

    async def test_record_full_payment(self, client: AsyncClient, created_invoice):
        """Recording a full payment transitions invoice to paid."""
        # Send the invoice first
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )
        await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")

        # Record full payment
        payment_data = {
            "amount": 280000,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "check",
            "reference_number": "CHK-12345",
        }
        response = await client.post(
            f"/api/v1/invoices/{created_invoice['id']}/payment",
            json=payment_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["amount_paid"] == 280000
        assert data["amount_due"] == 0
        assert data["status"] == "paid"
        assert len(data["payments"]) == 1

    async def test_record_partial_payment(self, client: AsyncClient, created_invoice):
        """Recording a partial payment transitions invoice to partial."""
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )
        await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")

        # Record partial payment
        payment_data = {
            "amount": 100000,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "ach",
        }
        response = await client.post(
            f"/api/v1/invoices/{created_invoice['id']}/payment",
            json=payment_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["amount_paid"] == 100000
        assert data["amount_due"] == 180000
        assert data["status"] == "partial"

    async def test_record_multiple_payments_to_full(self, client: AsyncClient, created_invoice):
        """Multiple partial payments that sum to full amount transition to paid."""
        await client.patch(
            f"/api/v1/invoices/{created_invoice['id']}",
            json={"status": "pending"},
        )
        await client.post(f"/api/v1/invoices/{created_invoice['id']}/send")

        # First payment
        payment1 = {
            "amount": 100000,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "check",
        }
        await client.post(
            f"/api/v1/invoices/{created_invoice['id']}/payment",
            json=payment1,
        )

        # Second payment covers the rest
        payment2 = {
            "amount": 180000,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "ach",
        }
        response = await client.post(
            f"/api/v1/invoices/{created_invoice['id']}/payment",
            json=payment2,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["amount_paid"] == 280000
        assert data["status"] == "paid"
        assert len(data["payments"]) == 2

    async def test_payment_nonexistent_invoice_returns_404(self, client: AsyncClient):
        """Recording a payment on non-existent invoice returns 404."""
        payment_data = {
            "amount": 100000,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": "check",
        }
        response = await client.post(
            "/api/v1/invoices/507f1f77bcf86cd799439011/payment",
            json=payment_data,
        )

        assert response.status_code == 404
