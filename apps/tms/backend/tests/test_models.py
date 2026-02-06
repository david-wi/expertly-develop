"""Unit tests for TMS data models - state machines, calculations, and serialization."""
import pytest
from datetime import datetime, timezone, timedelta

from app.models.base import MongoModel, PyObjectId, utc_now
from app.models.customer import Customer, CustomerStatus, CustomerContact, CUSTOMER_STATUS_TRANSITIONS
from app.models.carrier import Carrier, CarrierStatus, EquipmentType, CARRIER_STATUS_TRANSITIONS
from app.models.quote import Quote, QuoteStatus, QuoteLineItem, QUOTE_STATUS_TRANSITIONS
from app.models.quote_request import QuoteRequest, QuoteRequestStatus, ExtractedField, QUOTE_REQUEST_TRANSITIONS
from app.models.shipment import Shipment, ShipmentStatus, Stop, StopType, SHIPMENT_STATUS_TRANSITIONS
from app.models.invoice import Invoice, InvoiceStatus, InvoiceLineItem, InvoicePayment, INVOICE_STATUS_TRANSITIONS


# ============================================================================
# MongoModel base
# ============================================================================

class TestMongoModel:
    """Tests for MongoModel base class."""

    def test_default_id_generated(self):
        """MongoModel generates a default ID."""
        customer = Customer(name="Test")
        assert customer.id is not None

    def test_created_at_set(self):
        """MongoModel sets created_at on construction."""
        customer = Customer(name="Test")
        assert customer.created_at is not None

    def test_updated_at_set(self):
        """MongoModel sets updated_at on construction."""
        customer = Customer(name="Test")
        assert customer.updated_at is not None

    def test_mark_updated_changes_timestamp(self):
        """mark_updated changes the updated_at timestamp."""
        customer = Customer(name="Test")
        original = customer.updated_at
        import time
        time.sleep(0.01)
        customer.mark_updated()
        assert customer.updated_at >= original

    def test_model_dump_mongo(self):
        """model_dump_mongo produces a dictionary with _id alias."""
        customer = Customer(name="Test")
        data = customer.model_dump_mongo()
        assert "_id" in data
        assert "name" in data
        assert "created_at" in data

    def test_pyobjectid_from_string(self):
        """PyObjectId can be constructed from a valid hex string."""
        oid = PyObjectId._validate("507f1f77bcf86cd799439011")
        assert str(oid) == "507f1f77bcf86cd799439011"

    def test_pyobjectid_invalid_string_raises(self):
        """PyObjectId raises ValueError for invalid string."""
        with pytest.raises(ValueError):
            PyObjectId._validate("not-a-valid-id")


# ============================================================================
# Customer model
# ============================================================================

class TestCustomerModel:
    """Tests for Customer model."""

    def test_create_customer_defaults(self):
        """Customer has correct default values."""
        customer = Customer(name="Test Corp")
        assert customer.name == "Test Corp"
        assert customer.status == CustomerStatus.ACTIVE
        assert customer.payment_terms == 30
        assert customer.default_margin_percent == 15.0
        assert customer.total_shipments == 0
        assert customer.total_revenue == 0
        assert customer.country == "USA"
        assert customer.contacts == []

    def test_customer_with_contacts(self):
        """Customer can be created with contacts."""
        customer = Customer(
            name="Test Corp",
            contacts=[
                CustomerContact(name="John", email="john@test.com", is_primary=True),
                CustomerContact(name="Jane", email="jane@test.com"),
            ],
        )
        assert len(customer.contacts) == 2
        assert customer.contacts[0].is_primary is True
        assert customer.contacts[1].is_primary is False

    def test_all_valid_status_transitions(self):
        """Test all valid transitions defined in the transition map."""
        for from_status, to_statuses in CUSTOMER_STATUS_TRANSITIONS.items():
            for to_status in to_statuses:
                customer = Customer(name="Test", status=from_status)
                assert customer.can_transition_to(to_status) is True
                customer.transition_to(to_status)
                assert customer.status == to_status

    def test_customer_active_to_paused(self):
        """ACTIVE -> PAUSED is valid."""
        customer = Customer(name="Test")
        customer.transition_to(CustomerStatus.PAUSED)
        assert customer.status == CustomerStatus.PAUSED

    def test_customer_active_to_credit_hold(self):
        """ACTIVE -> CREDIT_HOLD is valid."""
        customer = Customer(name="Test")
        customer.transition_to(CustomerStatus.CREDIT_HOLD)
        assert customer.status == CustomerStatus.CREDIT_HOLD

    def test_customer_active_to_inactive(self):
        """ACTIVE -> INACTIVE is valid."""
        customer = Customer(name="Test")
        customer.transition_to(CustomerStatus.INACTIVE)
        assert customer.status == CustomerStatus.INACTIVE

    def test_customer_paused_to_active(self):
        """PAUSED -> ACTIVE is valid."""
        customer = Customer(name="Test", status=CustomerStatus.PAUSED)
        customer.transition_to(CustomerStatus.ACTIVE)
        assert customer.status == CustomerStatus.ACTIVE

    def test_customer_inactive_to_active(self):
        """INACTIVE -> ACTIVE is valid."""
        customer = Customer(name="Test", status=CustomerStatus.INACTIVE)
        customer.transition_to(CustomerStatus.ACTIVE)
        assert customer.status == CustomerStatus.ACTIVE

    def test_customer_invalid_transition_raises_valueerror(self):
        """Invalid transition raises ValueError."""
        customer = Customer(name="Test", status=CustomerStatus.INACTIVE)
        with pytest.raises(ValueError, match="Cannot transition"):
            customer.transition_to(CustomerStatus.CREDIT_HOLD)

    def test_customer_can_transition_to_returns_false_for_invalid(self):
        """can_transition_to returns False for invalid transitions."""
        customer = Customer(name="Test", status=CustomerStatus.INACTIVE)
        assert customer.can_transition_to(CustomerStatus.CREDIT_HOLD) is False
        assert customer.can_transition_to(CustomerStatus.PAUSED) is False


# ============================================================================
# Carrier model
# ============================================================================

class TestCarrierModel:
    """Tests for Carrier model."""

    def test_create_carrier_defaults(self):
        """Carrier has correct default values."""
        carrier = Carrier(name="Test Trucking")
        assert carrier.status == CarrierStatus.PENDING
        assert carrier.equipment_types == []
        assert carrier.payment_terms == 30
        assert carrier.quickpay_available is False
        assert carrier.quickpay_discount_percent == 2.0
        assert carrier.total_loads == 0
        assert carrier.authority_active is True

    def test_on_time_percentage_with_loads(self):
        """on_time_percentage calculates correctly with loads."""
        carrier = Carrier(name="Test", total_loads=100, on_time_deliveries=95)
        assert carrier.on_time_percentage == 95.0

    def test_on_time_percentage_no_loads(self):
        """on_time_percentage returns None when no loads."""
        carrier = Carrier(name="Test", total_loads=0)
        assert carrier.on_time_percentage is None

    def test_on_time_percentage_perfect(self):
        """on_time_percentage is 100 when all deliveries are on time."""
        carrier = Carrier(name="Test", total_loads=50, on_time_deliveries=50)
        assert carrier.on_time_percentage == 100.0

    def test_insurance_expiring_within_30_days(self):
        """is_insurance_expiring returns True when within 30 days."""
        carrier = Carrier(
            name="Test",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=20),
        )
        assert carrier.is_insurance_expiring is True

    def test_insurance_not_expiring_beyond_30_days(self):
        """is_insurance_expiring returns False when beyond 30 days."""
        carrier = Carrier(
            name="Test",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=60),
        )
        assert carrier.is_insurance_expiring is False

    def test_insurance_already_expired(self):
        """is_insurance_expiring returns False when already expired."""
        carrier = Carrier(
            name="Test",
            insurance_expiration=datetime.now(timezone.utc) - timedelta(days=5),
        )
        assert carrier.is_insurance_expiring is False

    def test_insurance_no_expiration_set(self):
        """is_insurance_expiring returns False when no expiration set."""
        carrier = Carrier(name="Test")
        assert carrier.is_insurance_expiring is False

    def test_all_valid_carrier_status_transitions(self):
        """Test all valid transitions in the carrier status map."""
        for from_status, to_statuses in CARRIER_STATUS_TRANSITIONS.items():
            for to_status in to_statuses:
                carrier = Carrier(name="Test", status=from_status)
                assert carrier.can_transition_to(to_status) is True
                carrier.transition_to(to_status)
                assert carrier.status == to_status

    def test_carrier_active_to_suspended(self):
        """ACTIVE -> SUSPENDED is valid."""
        carrier = Carrier(name="Test", status=CarrierStatus.ACTIVE)
        carrier.transition_to(CarrierStatus.SUSPENDED)
        assert carrier.status == CarrierStatus.SUSPENDED

    def test_carrier_do_not_use_to_active_invalid(self):
        """DO_NOT_USE -> ACTIVE is invalid (must go through PENDING)."""
        carrier = Carrier(name="Test", status=CarrierStatus.DO_NOT_USE)
        assert carrier.can_transition_to(CarrierStatus.ACTIVE) is False
        with pytest.raises(ValueError):
            carrier.transition_to(CarrierStatus.ACTIVE)

    def test_carrier_do_not_use_to_pending(self):
        """DO_NOT_USE -> PENDING is valid."""
        carrier = Carrier(name="Test", status=CarrierStatus.DO_NOT_USE)
        carrier.transition_to(CarrierStatus.PENDING)
        assert carrier.status == CarrierStatus.PENDING


# ============================================================================
# Shipment model
# ============================================================================

class TestShipmentModel:
    """Tests for Shipment model."""

    def test_create_shipment_defaults(self):
        """Shipment has correct default values."""
        shipment = Shipment(
            shipment_number="S-2024-00001",
            customer_id="507f1f77bcf86cd799439011",
        )
        assert shipment.status == ShipmentStatus.BOOKED
        assert shipment.equipment_type == "van"
        assert shipment.customer_price == 0
        assert shipment.carrier_cost == 0
        assert shipment.stops == []

    def test_margin_calculation(self):
        """margin returns customer_price minus carrier_cost."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            customer_price=280000,
            carrier_cost=200000,
        )
        assert shipment.margin == 80000

    def test_margin_percent_calculation(self):
        """margin_percent calculates correctly."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            customer_price=280000,
            carrier_cost=200000,
        )
        assert shipment.margin_percent == pytest.approx(28.57, rel=0.01)

    def test_margin_percent_zero_price(self):
        """margin_percent is 0 when customer_price is 0."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            customer_price=0,
            carrier_cost=0,
        )
        assert shipment.margin_percent == 0.0

    def test_margin_negative(self):
        """Margin can be negative when carrier_cost exceeds customer_price."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            customer_price=200000,
            carrier_cost=250000,
        )
        assert shipment.margin == -50000
        assert shipment.margin_percent < 0

    def test_all_valid_shipment_status_transitions(self):
        """Test all valid transitions in the shipment status map."""
        for from_status, to_statuses in SHIPMENT_STATUS_TRANSITIONS.items():
            for to_status in to_statuses:
                shipment = Shipment(
                    shipment_number="S-001",
                    customer_id="507f1f77bcf86cd799439011",
                    status=from_status,
                )
                assert shipment.can_transition_to(to_status) is True
                shipment.transition_to(to_status)
                assert shipment.status == to_status

    def test_transition_to_in_transit_sets_actual_pickup(self):
        """Transitioning to IN_TRANSIT sets actual_pickup_date."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            status=ShipmentStatus.PENDING_PICKUP,
        )
        assert shipment.actual_pickup_date is None
        shipment.transition_to(ShipmentStatus.IN_TRANSIT)
        assert shipment.actual_pickup_date is not None

    def test_transition_to_delivered_sets_actual_delivery(self):
        """Transitioning to DELIVERED sets actual_delivery_date."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            status=ShipmentStatus.IN_TRANSIT,
        )
        assert shipment.actual_delivery_date is None
        shipment.transition_to(ShipmentStatus.DELIVERED)
        assert shipment.actual_delivery_date is not None

    def test_delivered_cannot_transition(self):
        """DELIVERED has no valid transitions."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            status=ShipmentStatus.DELIVERED,
        )
        for status in ShipmentStatus:
            assert shipment.can_transition_to(status) is False

    def test_cancelled_cannot_transition(self):
        """CANCELLED has no valid transitions."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            status=ShipmentStatus.CANCELLED,
        )
        for status in ShipmentStatus:
            assert shipment.can_transition_to(status) is False

    def test_is_at_risk_no_carrier_pickup_soon(self):
        """is_at_risk True when no carrier and pickup within 24 hours."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            pickup_date=datetime.now(timezone.utc) + timedelta(hours=12),
        )
        assert shipment.is_at_risk is True

    def test_is_at_risk_carrier_assigned(self):
        """is_at_risk False when carrier is assigned even with soon pickup."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            carrier_id="507f1f77bcf86cd799439012",
            pickup_date=datetime.now(timezone.utc) + timedelta(hours=12),
        )
        assert shipment.is_at_risk is False

    def test_is_at_risk_no_carrier_pickup_far(self):
        """is_at_risk False when no carrier but pickup is far away."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            pickup_date=datetime.now(timezone.utc) + timedelta(days=5),
        )
        assert shipment.is_at_risk is False

    def test_is_at_risk_stale_check_call(self):
        """is_at_risk True when in_transit with stale check call (> 4 hours)."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            carrier_id="507f1f77bcf86cd799439012",
            status=ShipmentStatus.IN_TRANSIT,
            last_check_call=datetime.now(timezone.utc) - timedelta(hours=5),
        )
        assert shipment.is_at_risk is True

    def test_is_at_risk_recent_check_call(self):
        """is_at_risk False when in_transit with recent check call."""
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            carrier_id="507f1f77bcf86cd799439012",
            status=ShipmentStatus.IN_TRANSIT,
            last_check_call=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        assert shipment.is_at_risk is False

    def test_shipment_with_stops(self):
        """Shipment can be created with multiple stops."""
        stops = [
            Stop(stop_number=1, stop_type=StopType.PICKUP, address="123 Main", city="Chicago", state="IL", zip_code="60601"),
            Stop(stop_number=2, stop_type=StopType.STOP, address="789 Elm", city="Memphis", state="TN", zip_code="38101"),
            Stop(stop_number=3, stop_type=StopType.DELIVERY, address="456 Oak", city="Dallas", state="TX", zip_code="75201"),
        ]
        shipment = Shipment(
            shipment_number="S-001",
            customer_id="507f1f77bcf86cd799439011",
            stops=stops,
        )
        assert len(shipment.stops) == 3
        assert shipment.stops[1].stop_type == StopType.STOP

    def test_stop_is_completed(self):
        """Stop is_completed returns True when actual_departure is set."""
        stop = Stop(
            stop_number=1,
            stop_type=StopType.PICKUP,
            address="123 Main",
            city="Chicago",
            state="IL",
            zip_code="60601",
            actual_departure=datetime.now(timezone.utc),
        )
        assert stop.is_completed is True

    def test_stop_not_completed(self):
        """Stop is_completed returns False when actual_departure is None."""
        stop = Stop(
            stop_number=1,
            stop_type=StopType.PICKUP,
            address="123 Main",
            city="Chicago",
            state="IL",
            zip_code="60601",
        )
        assert stop.is_completed is False


# ============================================================================
# Quote model
# ============================================================================

class TestQuoteModel:
    """Tests for Quote model."""

    def test_create_quote_defaults(self):
        """Quote has correct default values."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
        )
        assert quote.status == QuoteStatus.DRAFT
        assert quote.equipment_type == "van"
        assert quote.total_price == 0
        assert quote.line_items == []

    def test_calculate_totals(self):
        """calculate_totals sums line items and computes margin."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
            line_items=[
                QuoteLineItem(description="Linehaul", quantity=1, unit_price=250000),
                QuoteLineItem(description="Fuel", quantity=1, unit_price=30000),
            ],
            estimated_cost=200000,
        )
        quote.calculate_totals()

        assert quote.total_price == 280000
        assert quote.margin_percent == pytest.approx(28.57, rel=0.01)

    def test_calculate_totals_no_cost(self):
        """calculate_totals with zero estimated_cost does not set margin."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="Chicago",
            origin_state="IL",
            destination_city="Dallas",
            destination_state="TX",
            line_items=[
                QuoteLineItem(description="Linehaul", quantity=1, unit_price=250000),
            ],
            estimated_cost=0,
        )
        quote.calculate_totals()

        assert quote.total_price == 250000
        assert quote.margin_percent == 0.0

    def test_line_item_total(self):
        """QuoteLineItem.total computes quantity * unit_price."""
        item = QuoteLineItem(description="Test", quantity=3, unit_price=10000)
        assert item.total == 30000

    def test_all_valid_quote_transitions(self):
        """Test all valid transitions in the quote status map."""
        for from_status, to_statuses in QUOTE_STATUS_TRANSITIONS.items():
            for to_status in to_statuses:
                quote = Quote(
                    quote_number="Q-001",
                    customer_id="507f1f77bcf86cd799439011",
                    origin_city="A",
                    origin_state="B",
                    destination_city="C",
                    destination_state="D",
                    status=from_status,
                )
                assert quote.can_transition_to(to_status) is True
                quote.transition_to(to_status)
                assert quote.status == to_status

    def test_transition_to_sent_sets_sent_at(self):
        """Transitioning to SENT sets sent_at timestamp."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="A",
            origin_state="B",
            destination_city="C",
            destination_state="D",
        )
        assert quote.sent_at is None
        quote.transition_to(QuoteStatus.SENT)
        assert quote.sent_at is not None

    def test_transition_to_accepted_sets_response_at(self):
        """Transitioning to ACCEPTED sets customer_response_at."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="A",
            origin_state="B",
            destination_city="C",
            destination_state="D",
            status=QuoteStatus.SENT,
        )
        quote.transition_to(QuoteStatus.ACCEPTED)
        assert quote.customer_response_at is not None

    def test_transition_to_declined_sets_response_at(self):
        """Transitioning to DECLINED sets customer_response_at."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="A",
            origin_state="B",
            destination_city="C",
            destination_state="D",
            status=QuoteStatus.SENT,
        )
        quote.transition_to(QuoteStatus.DECLINED)
        assert quote.customer_response_at is not None

    def test_accepted_cannot_transition(self):
        """ACCEPTED has no valid transitions."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="A",
            origin_state="B",
            destination_city="C",
            destination_state="D",
            status=QuoteStatus.ACCEPTED,
        )
        for status in QuoteStatus:
            assert quote.can_transition_to(status) is False

    def test_declined_can_requote(self):
        """DECLINED -> DRAFT is valid (re-quote)."""
        quote = Quote(
            quote_number="Q-001",
            customer_id="507f1f77bcf86cd799439011",
            origin_city="A",
            origin_state="B",
            destination_city="C",
            destination_state="D",
            status=QuoteStatus.DECLINED,
        )
        assert quote.can_transition_to(QuoteStatus.DRAFT) is True


# ============================================================================
# Quote Request model
# ============================================================================

class TestQuoteRequestModel:
    """Tests for QuoteRequest model."""

    def test_create_quote_request_defaults(self):
        """QuoteRequest has correct default values."""
        qr = QuoteRequest(source_type="email")
        assert qr.status == QuoteRequestStatus.NEW
        assert qr.missing_fields == []
        assert qr.extraction_confidence == 0.0

    def test_extraction_confidence_with_fields(self):
        """extraction_confidence averages all non-None extracted field confidences."""
        qr = QuoteRequest(
            source_type="email",
            extracted_origin_city=ExtractedField(value="Chicago", confidence=0.9, evidence_source="email_body"),
            extracted_origin_state=ExtractedField(value="IL", confidence=0.95, evidence_source="email_body"),
            extracted_destination_city=ExtractedField(value="Dallas", confidence=0.85, evidence_source="email_body"),
            extracted_destination_state=ExtractedField(value="TX", confidence=0.9, evidence_source="email_body"),
            extracted_pickup_date=ExtractedField(value="2024-01-15", confidence=0.7, evidence_source="email_body"),
            extracted_equipment_type=ExtractedField(value="van", confidence=0.8, evidence_source="email_body"),
        )
        expected = (0.9 + 0.95 + 0.85 + 0.9 + 0.7 + 0.8) / 6
        assert qr.extraction_confidence == pytest.approx(expected, rel=0.01)

    def test_extraction_confidence_partial_fields(self):
        """extraction_confidence works with partially extracted fields."""
        qr = QuoteRequest(
            source_type="email",
            extracted_origin_city=ExtractedField(value="Chicago", confidence=0.9, evidence_source="email_body"),
        )
        assert qr.extraction_confidence == 0.9

    def test_all_valid_quote_request_transitions(self):
        """Test all valid transitions in the quote request status map."""
        for from_status, to_statuses in QUOTE_REQUEST_TRANSITIONS.items():
            for to_status in to_statuses:
                qr = QuoteRequest(source_type="email", status=from_status)
                assert qr.can_transition_to(to_status) is True
                qr.transition_to(to_status)
                assert qr.status == to_status

    def test_declined_cannot_transition(self):
        """DECLINED has no valid transitions."""
        qr = QuoteRequest(source_type="email", status=QuoteRequestStatus.DECLINED)
        for status in QuoteRequestStatus:
            assert qr.can_transition_to(status) is False


# ============================================================================
# Invoice model
# ============================================================================

class TestInvoiceModel:
    """Tests for Invoice model."""

    def _make_invoice(self, **kwargs) -> Invoice:
        """Helper to create a test invoice."""
        defaults = {
            "invoice_number": "INV-001",
            "customer_id": "507f1f77bcf86cd799439011",
            "billing_name": "Test Corp",
        }
        defaults.update(kwargs)
        return Invoice(**defaults)

    def test_create_invoice_defaults(self):
        """Invoice has correct default values."""
        invoice = self._make_invoice()
        assert invoice.status == InvoiceStatus.DRAFT
        assert invoice.subtotal == 0
        assert invoice.total == 0
        assert invoice.amount_paid == 0
        assert invoice.tax_amount == 0

    def test_amount_due_calculation(self):
        """amount_due returns total minus amount_paid."""
        invoice = self._make_invoice(total=100000, amount_paid=40000)
        assert invoice.amount_due == 60000

    def test_calculate_totals(self):
        """calculate_totals sums line items and adds tax."""
        invoice = self._make_invoice(
            line_items=[
                InvoiceLineItem(description="Freight", quantity=1, unit_price=250000),
                InvoiceLineItem(description="Fuel", quantity=1, unit_price=30000),
            ],
            tax_amount=5000,
        )
        invoice.calculate_totals()

        assert invoice.subtotal == 280000
        assert invoice.total == 285000

    def test_add_payment_partial(self):
        """add_payment with partial amount sets status to PARTIAL."""
        invoice = self._make_invoice(total=100000, status=InvoiceStatus.SENT)
        payment = InvoicePayment(
            amount=50000,
            payment_date=datetime.now(timezone.utc),
            payment_method="check",
        )
        invoice.add_payment(payment)

        assert invoice.amount_paid == 50000
        assert invoice.status == InvoiceStatus.PARTIAL
        assert len(invoice.payments) == 1

    def test_add_payment_full(self):
        """add_payment with full amount sets status to PAID."""
        invoice = self._make_invoice(total=100000, status=InvoiceStatus.SENT)
        payment = InvoicePayment(
            amount=100000,
            payment_date=datetime.now(timezone.utc),
            payment_method="ach",
        )
        invoice.add_payment(payment)

        assert invoice.amount_paid == 100000
        assert invoice.status == InvoiceStatus.PAID

    def test_add_multiple_payments(self):
        """Multiple payments accumulate correctly."""
        invoice = self._make_invoice(total=100000, status=InvoiceStatus.SENT)
        p1 = InvoicePayment(amount=30000, payment_date=datetime.now(timezone.utc), payment_method="check")
        p2 = InvoicePayment(amount=70000, payment_date=datetime.now(timezone.utc), payment_method="ach")
        invoice.add_payment(p1)
        assert invoice.status == InvoiceStatus.PARTIAL
        invoice.add_payment(p2)
        assert invoice.status == InvoiceStatus.PAID
        assert invoice.amount_paid == 100000
        assert len(invoice.payments) == 2

    def test_invoice_line_item_total(self):
        """InvoiceLineItem.total computes quantity * unit_price."""
        item = InvoiceLineItem(description="Test", quantity=2, unit_price=15000)
        assert item.total == 30000

    def test_all_valid_invoice_transitions(self):
        """Test all valid transitions in the invoice status map."""
        for from_status, to_statuses in INVOICE_STATUS_TRANSITIONS.items():
            for to_status in to_statuses:
                invoice = self._make_invoice(status=from_status)
                assert invoice.can_transition_to(to_status) is True
                invoice.transition_to(to_status)
                assert invoice.status == to_status

    def test_transition_to_sent_sets_sent_at(self):
        """Transitioning to SENT sets sent_at timestamp."""
        invoice = self._make_invoice(status=InvoiceStatus.PENDING)
        assert invoice.sent_at is None
        invoice.transition_to(InvoiceStatus.SENT)
        assert invoice.sent_at is not None

    def test_paid_cannot_transition(self):
        """PAID has no valid transitions."""
        invoice = self._make_invoice(status=InvoiceStatus.PAID)
        for status in InvoiceStatus:
            assert invoice.can_transition_to(status) is False

    def test_void_cannot_transition(self):
        """VOID has no valid transitions."""
        invoice = self._make_invoice(status=InvoiceStatus.VOID)
        for status in InvoiceStatus:
            assert invoice.can_transition_to(status) is False
