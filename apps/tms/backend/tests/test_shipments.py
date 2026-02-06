"""API tests for shipment CRUD, status transitions, and tracking."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestCreateShipment:
    """Tests for POST /api/v1/shipments."""

    async def test_create_shipment_returns_201(self, client: AsyncClient, created_customer):
        """Creating a shipment with valid data returns 201."""
        payload = {
            "customer_id": created_customer["id"],
            "equipment_type": "van",
            "customer_price": 280000,
            "carrier_cost": 200000,
            "commodity": "Electronics",
            "weight_lbs": 35000,
        }
        response = await client.post("/api/v1/shipments", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "booked"
        assert data["customer_id"] == created_customer["id"]
        assert data["equipment_type"] == "van"
        assert data["customer_price"] == 280000
        assert data["carrier_cost"] == 200000
        assert data["commodity"] == "Electronics"
        assert data["weight_lbs"] == 35000
        assert "shipment_number" in data
        assert data["shipment_number"].startswith("S-")
        assert "id" in data

    async def test_create_shipment_generates_unique_numbers(self, client: AsyncClient, created_customer):
        """Each shipment gets a unique shipment number."""
        payload = {"customer_id": created_customer["id"]}
        resp1 = await client.post("/api/v1/shipments", json=payload)
        resp2 = await client.post("/api/v1/shipments", json=payload)

        assert resp1.json()["shipment_number"] != resp2.json()["shipment_number"]

    async def test_create_shipment_with_stops(self, client: AsyncClient, created_customer):
        """Creating a shipment with pickup and delivery stops."""
        payload = {
            "customer_id": created_customer["id"],
            "stops": [
                {
                    "stop_number": 1,
                    "stop_type": "pickup",
                    "address": "123 Main St",
                    "city": "Chicago",
                    "state": "IL",
                    "zip_code": "60601",
                    "contact_name": "John",
                },
                {
                    "stop_number": 2,
                    "stop_type": "delivery",
                    "address": "456 Oak Ave",
                    "city": "Dallas",
                    "state": "TX",
                    "zip_code": "75201",
                },
            ],
            "customer_price": 280000,
        }
        response = await client.post("/api/v1/shipments", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert len(data["stops"]) == 2
        assert data["stops"][0]["stop_type"] == "pickup"
        assert data["stops"][0]["city"] == "Chicago"
        assert data["stops"][1]["stop_type"] == "delivery"
        assert data["stops"][1]["city"] == "Dallas"

    async def test_create_shipment_margin_calculations(self, client: AsyncClient, created_customer):
        """Verify margin calculations on created shipment."""
        payload = {
            "customer_id": created_customer["id"],
            "customer_price": 300000,  # $3,000
            "carrier_cost": 210000,  # $2,100
        }
        response = await client.post("/api/v1/shipments", json=payload)

        data = response.json()
        assert data["margin"] == 90000  # $900
        assert data["margin_percent"] == pytest.approx(30.0, rel=0.01)

    async def test_create_shipment_zero_price_margin(self, client: AsyncClient, created_customer):
        """Margin percent is 0 when customer price is 0."""
        payload = {
            "customer_id": created_customer["id"],
            "customer_price": 0,
            "carrier_cost": 0,
        }
        response = await client.post("/api/v1/shipments", json=payload)

        data = response.json()
        assert data["margin"] == 0
        assert data["margin_percent"] == 0.0


class TestListShipments:
    """Tests for GET /api/v1/shipments."""

    async def test_list_shipments_empty(self, client: AsyncClient):
        """Listing shipments when none exist returns empty list."""
        response = await client.get("/api/v1/shipments")

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_shipments_returns_all(self, client: AsyncClient, created_customer):
        """Listing returns all created shipments."""
        payload = {"customer_id": created_customer["id"]}
        await client.post("/api/v1/shipments", json=payload)
        await client.post("/api/v1/shipments", json=payload)

        response = await client.get("/api/v1/shipments")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_list_shipments_filter_by_status(self, client: AsyncClient, created_customer):
        """Filtering shipments by status."""
        payload = {"customer_id": created_customer["id"]}
        resp1 = await client.post("/api/v1/shipments", json=payload)
        resp2 = await client.post("/api/v1/shipments", json=payload)

        # Transition one to pending_pickup
        await client.post(
            f"/api/v1/shipments/{resp2.json()['id']}/transition",
            json={"status": "pending_pickup"},
        )

        response = await client.get("/api/v1/shipments", params={"status": "booked"})
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "booked"

    async def test_list_shipments_filter_by_customer(self, client: AsyncClient):
        """Filtering shipments by customer_id."""
        # Create two customers
        resp1 = await client.post("/api/v1/customers", json={"name": "Customer A"})
        resp2 = await client.post("/api/v1/customers", json={"name": "Customer B"})

        cid1 = resp1.json()["id"]
        cid2 = resp2.json()["id"]

        await client.post("/api/v1/shipments", json={"customer_id": cid1})
        await client.post("/api/v1/shipments", json={"customer_id": cid2})
        await client.post("/api/v1/shipments", json={"customer_id": cid1})

        response = await client.get("/api/v1/shipments", params={"customer_id": cid1})
        data = response.json()
        assert len(data) == 2
        assert all(s["customer_id"] == cid1 for s in data)


class TestGetShipment:
    """Tests for GET /api/v1/shipments/{id}."""

    async def test_get_shipment_by_id(self, client: AsyncClient, created_shipment):
        """Getting a shipment by ID returns the correct shipment."""
        response = await client.get(f"/api/v1/shipments/{created_shipment['id']}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_shipment["id"]
        assert data["shipment_number"] == created_shipment["shipment_number"]

    async def test_get_shipment_not_found_returns_404(self, client: AsyncClient):
        """Getting a non-existent shipment returns 404."""
        response = await client.get("/api/v1/shipments/507f1f77bcf86cd799439011")

        assert response.status_code == 404


class TestUpdateShipment:
    """Tests for PATCH /api/v1/shipments/{id}."""

    async def test_update_shipment_carrier_assignment(
        self, client: AsyncClient, created_shipment, created_carrier
    ):
        """Assigning a carrier to a shipment."""
        response = await client.patch(
            f"/api/v1/shipments/{created_shipment['id']}",
            json={"carrier_id": created_carrier["id"], "carrier_cost": 200000},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["carrier_id"] == created_carrier["id"]
        assert data["carrier_cost"] == 200000

    async def test_update_shipment_tracking_info(self, client: AsyncClient, created_shipment):
        """Updating tracking info on a shipment."""
        response = await client.patch(
            f"/api/v1/shipments/{created_shipment['id']}",
            json={
                "last_known_location": "Memphis, TN",
                "pro_number": "PRO-12345",
                "bol_number": "BOL-67890",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["last_known_location"] == "Memphis, TN"
        assert data["pro_number"] == "PRO-12345"
        assert data["bol_number"] == "BOL-67890"

    async def test_update_shipment_not_found_returns_404(self, client: AsyncClient):
        """Updating a non-existent shipment returns 404."""
        response = await client.patch(
            "/api/v1/shipments/507f1f77bcf86cd799439011",
            json={"internal_notes": "test"},
        )

        assert response.status_code == 404


class TestShipmentStatusTransitions:
    """Tests for POST /api/v1/shipments/{id}/transition."""

    async def test_booked_to_pending_pickup(self, client: AsyncClient, created_shipment):
        """Valid transition: booked -> pending_pickup."""
        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "pending_pickup"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "pending_pickup"

    async def test_pending_pickup_to_in_transit(self, client: AsyncClient, created_shipment):
        """Valid transition: pending_pickup -> in_transit sets actual_pickup_date."""
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "pending_pickup"},
        )

        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "in_transit"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_transit"
        assert data["actual_pickup_date"] is not None

    async def test_in_transit_to_delivered(self, client: AsyncClient, created_shipment):
        """Valid transition: in_transit -> delivered sets actual_delivery_date."""
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "pending_pickup"},
        )
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "in_transit"},
        )

        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "delivered"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "delivered"
        assert data["actual_delivery_date"] is not None

    async def test_in_transit_to_out_for_delivery(self, client: AsyncClient, created_shipment):
        """Valid transition: in_transit -> out_for_delivery."""
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "pending_pickup"},
        )
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "in_transit"},
        )

        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "out_for_delivery"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "out_for_delivery"

    async def test_out_for_delivery_to_delivered(self, client: AsyncClient, created_shipment):
        """Valid transition: out_for_delivery -> delivered."""
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "pending_pickup"},
        )
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "in_transit"},
        )
        await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "out_for_delivery"},
        )

        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "delivered"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "delivered"

    async def test_full_lifecycle_booked_to_delivered(self, client: AsyncClient, created_shipment):
        """Full lifecycle: booked -> pending_pickup -> in_transit -> delivered."""
        sid = created_shipment["id"]

        for status in ["pending_pickup", "in_transit", "delivered"]:
            response = await client.post(
                f"/api/v1/shipments/{sid}/transition",
                json={"status": status},
            )
            assert response.status_code == 200
            assert response.json()["status"] == status

    async def test_cancellation_from_booked(self, client: AsyncClient, created_shipment):
        """Shipment can be cancelled from booked status."""
        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "cancelled"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    async def test_cancellation_from_in_transit(self, client: AsyncClient, created_shipment):
        """Shipment can be cancelled from in_transit status."""
        sid = created_shipment["id"]
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "in_transit"})

        response = await client.post(
            f"/api/v1/shipments/{sid}/transition",
            json={"status": "cancelled"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    async def test_invalid_transition_delivered_to_in_transit_returns_400(
        self, client: AsyncClient, created_shipment
    ):
        """Invalid transition: delivered -> in_transit returns 400."""
        sid = created_shipment["id"]
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "in_transit"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "delivered"})

        response = await client.post(
            f"/api/v1/shipments/{sid}/transition",
            json={"status": "in_transit"},
        )

        assert response.status_code == 400
        assert "Cannot transition" in response.json()["detail"]

    async def test_invalid_transition_delivered_to_cancelled_returns_400(
        self, client: AsyncClient, created_shipment
    ):
        """Invalid transition: delivered -> cancelled returns 400."""
        sid = created_shipment["id"]
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "in_transit"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "delivered"})

        response = await client.post(
            f"/api/v1/shipments/{sid}/transition",
            json={"status": "cancelled"},
        )

        assert response.status_code == 400

    async def test_invalid_transition_cancelled_to_booked_returns_400(
        self, client: AsyncClient, created_shipment
    ):
        """Invalid transition: cancelled -> booked returns 400."""
        sid = created_shipment["id"]
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "cancelled"})

        response = await client.post(
            f"/api/v1/shipments/{sid}/transition",
            json={"status": "booked"},
        )

        assert response.status_code == 400

    async def test_invalid_transition_booked_to_delivered_returns_400(
        self, client: AsyncClient, created_shipment
    ):
        """Invalid transition: booked -> delivered (skipping intermediate states)."""
        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "delivered"},
        )

        assert response.status_code == 400

    async def test_transition_nonexistent_shipment_returns_404(self, client: AsyncClient):
        """Transitioning a non-existent shipment returns 404."""
        response = await client.post(
            "/api/v1/shipments/507f1f77bcf86cd799439011/transition",
            json={"status": "pending_pickup"},
        )

        assert response.status_code == 404

    async def test_transition_with_notes(self, client: AsyncClient, created_shipment):
        """Transition with notes succeeds."""
        response = await client.post(
            f"/api/v1/shipments/{created_shipment['id']}/transition",
            json={"status": "pending_pickup", "notes": "Driver dispatched at 8am"},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "pending_pickup"


class TestShipmentTracking:
    """Tests for shipment tracking endpoints."""

    async def test_add_check_call(self, client: AsyncClient, created_shipment):
        """Adding a check call tracking event."""
        sid = created_shipment["id"]

        # Move to in transit first
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "in_transit"})

        response = await client.post(
            f"/api/v1/shipments/{sid}/tracking",
            json={
                "location_city": "Memphis",
                "location_state": "TN",
                "notes": "Driver stopped for fuel",
            },
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

    async def test_get_tracking_events(self, client: AsyncClient, created_shipment):
        """Getting tracking events for a shipment."""
        sid = created_shipment["id"]

        response = await client.get(f"/api/v1/shipments/{sid}/tracking")

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_tracking_events_after_transitions(self, client: AsyncClient, created_shipment):
        """Status transitions create tracking events."""
        sid = created_shipment["id"]

        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "pending_pickup"})
        await client.post(f"/api/v1/shipments/{sid}/transition", json={"status": "in_transit"})

        response = await client.get(f"/api/v1/shipments/{sid}/tracking")

        data = response.json()
        assert len(data) >= 2  # At least dispatched and departed_pickup events
