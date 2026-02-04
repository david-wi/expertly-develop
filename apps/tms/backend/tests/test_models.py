"""Unit tests for TMS data models."""
import pytest
from datetime import datetime, timezone, timedelta

from app.models.customer import Customer, CustomerStatus, CustomerContact
from app.models.carrier import Carrier, CarrierStatus, EquipmentType
from app.models.quote import Quote, QuoteStatus, QuoteLineItem
from app.models.shipment import Shipment, ShipmentStatus, Stop, StopType
from app.models.invoice import Invoice, InvoiceStatus


class TestCustomerModel:
    """Tests for Customer model."""

    def test_create_customer(self):
        """Test creating a customer with defaults."""
        customer = Customer(name="Test Corp")

        assert customer.name == "Test Corp"
        assert customer.status == CustomerStatus.ACTIVE
        assert customer.payment_terms == 30
        assert customer.default_margin_percent == 15.0
        assert customer.total_shipments == 0

    def test_customer_with_contacts(self):
        """Test customer with contacts."""
        customer = Customer(
            name="Test Corp",
            contacts=[
                CustomerContact(name="John Doe", email="john@test.com", is_primary=True),
                CustomerContact(name="Jane Doe", email="jane@test.com", is_primary=False),
            ]
        )

        assert len(customer.contacts) == 2
        assert customer.contacts[0].is_primary is True

    def test_customer_status_transitions(self):
        """Test valid and invalid status transitions."""
        customer = Customer(name="Test Corp")

        # Valid: ACTIVE -> PAUSED
        assert customer.can_transition_to(CustomerStatus.PAUSED) is True
        customer.transition_to(CustomerStatus.PAUSED)
        assert customer.status == CustomerStatus.PAUSED

        # Valid: PAUSED -> ACTIVE
        assert customer.can_transition_to(CustomerStatus.ACTIVE) is True
        customer.transition_to(CustomerStatus.ACTIVE)
        assert customer.status == CustomerStatus.ACTIVE

        # Valid: ACTIVE -> CREDIT_HOLD
        customer.transition_to(CustomerStatus.CREDIT_HOLD)
        assert customer.status == CustomerStatus.CREDIT_HOLD

        # Valid: CREDIT_HOLD -> INACTIVE
        customer.transition_to(CustomerStatus.INACTIVE)
        assert customer.status == CustomerStatus.INACTIVE

    def test_customer_invalid_transition(self):
        """Test invalid status transition raises error."""
        customer = Customer(name="Test Corp", status=CustomerStatus.INACTIVE)

        # Invalid: INACTIVE -> CREDIT_HOLD
        assert customer.can_transition_to(CustomerStatus.CREDIT_HOLD) is False

        with pytest.raises(ValueError, match="Cannot transition"):
            customer.transition_to(CustomerStatus.CREDIT_HOLD)


class TestCarrierModel:
    """Tests for Carrier model."""

    def test_create_carrier(self):
        """Test creating a carrier."""
        carrier = Carrier(
            name="Swift Trucking",
            mc_number="MC-123456",
            dot_number="1234567",
            equipment_types=[EquipmentType.VAN, EquipmentType.REEFER],
        )

        assert carrier.name == "Swift Trucking"
        assert carrier.status == CarrierStatus.ACTIVE
        assert EquipmentType.VAN in carrier.equipment_types

    def test_carrier_insurance_expiring(self):
        """Test insurance expiration check."""
        # Insurance expiring in 20 days
        carrier = Carrier(
            name="Test Carrier",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=20),
        )
        assert carrier.is_insurance_expiring is True

        # Insurance expiring in 60 days
        carrier2 = Carrier(
            name="Test Carrier 2",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=60),
        )
        assert carrier2.is_insurance_expiring is False

    def test_carrier_on_time_percentage(self):
        """Test on-time percentage calculation."""
        carrier = Carrier(
            name="Test Carrier",
            total_loads=100,
            on_time_deliveries=95,
        )
        assert carrier.on_time_percentage == 95.0

    def test_carrier_status_transitions(self):
        """Test carrier status transitions."""
        carrier = Carrier(name="Test Carrier")

        # Valid: ACTIVE -> SUSPENDED
        assert carrier.can_transition_to(CarrierStatus.SUSPENDED) is True
        carrier.transition_to(CarrierStatus.SUSPENDED)
        assert carrier.status == CarrierStatus.SUSPENDED

        # Valid: SUSPENDED -> DO_NOT_USE
        carrier.transition_to(CarrierStatus.DO_NOT_USE)
        assert carrier.status == CarrierStatus.DO_NOT_USE

        # Invalid: DO_NOT_USE -> ACTIVE (can't reactivate)
        assert carrier.can_transition_to(CarrierStatus.ACTIVE) is False


class TestQuoteModel:
    """Tests for Quote model."""

    def test_create_quote(self):
        """Test creating a quote."""
        quote = Quote(
            quote_number="Q-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
        )

        assert quote.quote_number == "Q-2024-00001"
        assert quote.status == QuoteStatus.DRAFT

    def test_quote_line_items(self):
        """Test quote with line items and total calculation."""
        quote = Quote(
            quote_number="Q-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
            line_items=[
                QuoteLineItem(description="Linehaul", quantity=1, unit_price=250000),
                QuoteLineItem(description="Fuel Surcharge", quantity=1, unit_price=30000, is_accessorial=True),
            ],
            estimated_cost=200000,
        )

        quote.calculate_totals()

        assert quote.total_price == 280000  # $2,800
        assert quote.margin_percent == pytest.approx(28.57, rel=0.01)  # (280000-200000)/280000

    def test_quote_status_transitions(self):
        """Test quote status transitions."""
        quote = Quote(
            quote_number="Q-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
        )

        # Valid: DRAFT -> SENT
        assert quote.can_transition_to(QuoteStatus.SENT) is True
        quote.transition_to(QuoteStatus.SENT)
        assert quote.status == QuoteStatus.SENT
        assert quote.sent_at is not None

        # Valid: SENT -> ACCEPTED
        quote.transition_to(QuoteStatus.ACCEPTED)
        assert quote.status == QuoteStatus.ACCEPTED
        assert quote.customer_response_at is not None

        # Invalid: ACCEPTED -> anything
        assert quote.can_transition_to(QuoteStatus.DRAFT) is False

    def test_quote_declined_can_requote(self):
        """Test that declined quotes can be re-quoted."""
        quote = Quote(
            quote_number="Q-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
            status=QuoteStatus.DECLINED,
        )

        # Valid: DECLINED -> DRAFT (re-quote)
        assert quote.can_transition_to(QuoteStatus.DRAFT) is True


class TestShipmentModel:
    """Tests for Shipment model."""

    def test_create_shipment(self):
        """Test creating a shipment."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
        )

        assert shipment.shipment_number == "S-2024-00001"
        assert shipment.status == ShipmentStatus.BOOKED

    def test_shipment_margin_calculation(self):
        """Test shipment margin calculation."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            customer_price=280000,
            carrier_cost=200000,
        )

        assert shipment.margin == 80000  # $800
        assert shipment.margin_percent == pytest.approx(28.57, rel=0.01)

    def test_shipment_status_transitions(self):
        """Test shipment status transitions."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
        )

        # Valid: BOOKED -> PENDING_PICKUP
        shipment.transition_to(ShipmentStatus.PENDING_PICKUP)
        assert shipment.status == ShipmentStatus.PENDING_PICKUP

        # Valid: PENDING_PICKUP -> IN_TRANSIT
        shipment.transition_to(ShipmentStatus.IN_TRANSIT)
        assert shipment.status == ShipmentStatus.IN_TRANSIT
        assert shipment.actual_pickup_date is not None

        # Valid: IN_TRANSIT -> DELIVERED
        shipment.transition_to(ShipmentStatus.DELIVERED)
        assert shipment.status == ShipmentStatus.DELIVERED
        assert shipment.actual_delivery_date is not None

        # Invalid: DELIVERED -> anything
        assert shipment.can_transition_to(ShipmentStatus.IN_TRANSIT) is False

    def test_shipment_cancellation(self):
        """Test shipment can be cancelled from most states."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
        )

        # Can cancel from BOOKED
        assert shipment.can_transition_to(ShipmentStatus.CANCELLED) is True

        # Move to IN_TRANSIT
        shipment.transition_to(ShipmentStatus.PENDING_PICKUP)
        shipment.transition_to(ShipmentStatus.IN_TRANSIT)

        # Can still cancel
        assert shipment.can_transition_to(ShipmentStatus.CANCELLED) is True

        # After delivery, cannot cancel
        shipment.transition_to(ShipmentStatus.DELIVERED)
        assert shipment.can_transition_to(ShipmentStatus.CANCELLED) is False

    def test_shipment_at_risk_no_carrier(self):
        """Test at-risk detection for unassigned loads."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            pickup_date=datetime.now(timezone.utc) + timedelta(hours=12),  # 12 hours away
        )

        # No carrier assigned and pickup is within 24 hours
        assert shipment.is_at_risk is True

        # Assign a carrier
        shipment.carrier_id = "507f1f77bcf86cd799439012"
        assert shipment.is_at_risk is False

    def test_shipment_stops(self):
        """Test shipment with stops."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            stops=[
                Stop(
                    stop_number=1,
                    stop_type=StopType.PICKUP,
                    address="123 Main St",
                    city="Chicago",
                    state="IL",
                    zip_code="60601",
                ),
                Stop(
                    stop_number=2,
                    stop_type=StopType.DELIVERY,
                    address="456 Oak Ave",
                    city="Dallas",
                    state="TX",
                    zip_code="75201",
                ),
            ]
        )

        assert len(shipment.stops) == 2
        assert shipment.stops[0].stop_type == StopType.PICKUP
        assert shipment.stops[1].stop_type == StopType.DELIVERY


class TestInvoiceModel:
    """Tests for Invoice model."""

    def test_invoice_status_transitions(self):
        """Test invoice status transitions."""
        invoice = Invoice(
            invoice_number="INV-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            billing_name="Test Customer",
        )

        assert invoice.status == InvoiceStatus.DRAFT

        # Valid: DRAFT -> SENT
        assert invoice.can_transition_to(InvoiceStatus.SENT) is True
        invoice.transition_to(InvoiceStatus.SENT)
        assert invoice.status == InvoiceStatus.SENT

        # Valid: SENT -> PAID
        invoice.transition_to(InvoiceStatus.PAID)
        assert invoice.status == InvoiceStatus.PAID

    def test_invoice_void(self):
        """Test invoice can be voided."""
        invoice = Invoice(
            invoice_number="INV-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
            billing_name="Test Customer",
        )

        # Can void from DRAFT
        assert invoice.can_transition_to(InvoiceStatus.VOID) is True

        invoice.transition_to(InvoiceStatus.SENT)

        # Can void from SENT
        assert invoice.can_transition_to(InvoiceStatus.VOID) is True
