import logging
from datetime import datetime, timezone, timedelta

from app.database import get_database
from app.models.customer import Customer, CustomerStatus, CustomerContact
from app.models.carrier import Carrier, CarrierStatus, EquipmentType, CarrierContact

logger = logging.getLogger(__name__)


async def ensure_indexes():
    """Create database indexes."""
    db = get_database()

    # Customers
    await db.customers.create_index("name")
    await db.customers.create_index("code", sparse=True)
    await db.customers.create_index("status")

    # Carriers
    await db.carriers.create_index("name")
    await db.carriers.create_index("mc_number", sparse=True)
    await db.carriers.create_index("dot_number", sparse=True)
    await db.carriers.create_index("status")
    await db.carriers.create_index("equipment_types")

    # Facilities
    await db.facilities.create_index("customer_id", sparse=True)
    await db.facilities.create_index([("city", 1), ("state", 1)])

    # Quote Requests
    await db.quote_requests.create_index("status")
    await db.quote_requests.create_index("customer_id", sparse=True)
    await db.quote_requests.create_index("received_at")

    # Quotes
    await db.quotes.create_index("quote_number", unique=True)
    await db.quotes.create_index("status")
    await db.quotes.create_index("customer_id")

    # Shipments
    await db.shipments.create_index("shipment_number", unique=True)
    await db.shipments.create_index("status")
    await db.shipments.create_index("customer_id")
    await db.shipments.create_index("carrier_id", sparse=True)
    await db.shipments.create_index("pickup_date")
    await db.shipments.create_index("delivery_date")

    # Tenders
    await db.tenders.create_index("shipment_id")
    await db.tenders.create_index("carrier_id")
    await db.tenders.create_index("status")

    # Tracking Events
    await db.tracking_events.create_index("shipment_id")
    await db.tracking_events.create_index("event_timestamp")

    # Documents
    await db.documents.create_index("shipment_id", sparse=True)
    await db.documents.create_index("carrier_id", sparse=True)
    await db.documents.create_index("customer_id", sparse=True)

    # Invoices
    await db.invoices.create_index("invoice_number", unique=True)
    await db.invoices.create_index("customer_id")
    await db.invoices.create_index("status")

    # Work Items
    await db.work_items.create_index("status")
    await db.work_items.create_index("work_type")
    await db.work_items.create_index("assigned_to", sparse=True)
    await db.work_items.create_index([("priority", -1), ("created_at", 1)])

    # Sequences
    await db.sequences.create_index([("type", 1), ("year", 1)], unique=True)

    logger.info("Database indexes created")


async def seed_database():
    """Seed database with sample data for development."""
    db = get_database()

    # Check if already seeded
    existing = await db.customers.find_one()
    if existing:
        logger.info("Database already seeded, skipping")
        return

    logger.info("Seeding database with sample data...")

    # Create sample customers
    customers = [
        Customer(
            name="ABC Manufacturing",
            code="ABC",
            status=CustomerStatus.ACTIVE,
            contacts=[
                CustomerContact(name="John Smith", email="john@abc-mfg.com", phone="555-0101", role="Logistics Manager", is_primary=True),
            ],
            billing_email="ap@abc-mfg.com",
            city="Chicago",
            state="IL",
            zip_code="60601",
            payment_terms=30,
            default_margin_percent=15.0,
        ),
        Customer(
            name="XYZ Distribution",
            code="XYZ",
            status=CustomerStatus.ACTIVE,
            contacts=[
                CustomerContact(name="Jane Doe", email="jane@xyz-dist.com", phone="555-0202", role="Transportation Director", is_primary=True),
            ],
            billing_email="billing@xyz-dist.com",
            city="Dallas",
            state="TX",
            zip_code="75201",
            payment_terms=45,
            default_margin_percent=18.0,
        ),
        Customer(
            name="QuickShip Retail",
            code="QSR",
            status=CustomerStatus.ACTIVE,
            contacts=[
                CustomerContact(name="Bob Wilson", email="bob@quickship.com", phone="555-0303", role="Shipping Coordinator", is_primary=True),
            ],
            billing_email="invoices@quickship.com",
            city="Atlanta",
            state="GA",
            zip_code="30301",
            payment_terms=30,
            default_margin_percent=12.0,
        ),
    ]

    for customer in customers:
        await db.customers.insert_one(customer.model_dump_mongo())

    # Create sample carriers
    carriers = [
        Carrier(
            name="Swift Freight Services",
            mc_number="MC-123456",
            dot_number="1234567",
            status=CarrierStatus.ACTIVE,
            contacts=[
                CarrierContact(name="Mike Johnson", email="dispatch@swiftfreight.com", phone="555-1001", role="Dispatch", is_primary=True),
            ],
            dispatch_email="dispatch@swiftfreight.com",
            dispatch_phone="555-1001",
            equipment_types=[EquipmentType.VAN, EquipmentType.REEFER],
            city="Indianapolis",
            state="IN",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=180),
            authority_active=True,
            safety_rating="Satisfactory",
            total_loads=150,
            on_time_deliveries=142,
        ),
        Carrier(
            name="Flatbed Express",
            mc_number="MC-234567",
            dot_number="2345678",
            status=CarrierStatus.ACTIVE,
            contacts=[
                CarrierContact(name="Tom Davis", email="tom@flatbedexpress.com", phone="555-2002", role="Owner/Operator", is_primary=True),
            ],
            dispatch_email="tom@flatbedexpress.com",
            dispatch_phone="555-2002",
            equipment_types=[EquipmentType.FLATBED, EquipmentType.STEP_DECK],
            city="Houston",
            state="TX",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=90),
            authority_active=True,
            total_loads=75,
            on_time_deliveries=70,
        ),
        Carrier(
            name="Cold Chain Logistics",
            mc_number="MC-345678",
            dot_number="3456789",
            status=CarrierStatus.ACTIVE,
            contacts=[
                CarrierContact(name="Sarah Lee", email="sarah@coldchain.com", phone="555-3003", role="Dispatch Manager", is_primary=True),
            ],
            dispatch_email="dispatch@coldchain.com",
            dispatch_phone="555-3003",
            equipment_types=[EquipmentType.REEFER],
            city="Phoenix",
            state="AZ",
            insurance_expiration=datetime.now(timezone.utc) + timedelta(days=25),  # Expiring soon
            authority_active=True,
            safety_rating="Satisfactory",
            total_loads=200,
            on_time_deliveries=188,
        ),
    ]

    for carrier in carriers:
        await db.carriers.insert_one(carrier.model_dump_mongo())

    logger.info("Database seeded successfully")
