"""Pytest configuration and fixtures for TMS backend tests."""
import asyncio
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import set_database
from app.config import get_settings

settings = get_settings()


# Use a test database
TEST_DB_NAME = "expertly_tms_test"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def mongo_client():
    """Create MongoDB client for tests."""
    client = AsyncIOMotorClient(settings.mongodb_url)
    yield client
    client.close()


@pytest.fixture(autouse=True)
async def clean_database(mongo_client):
    """Clean test database before each test and inject it into the app."""
    db = mongo_client[TEST_DB_NAME]

    # Inject test database into the app so API routes use it
    set_database(db)

    # Drop all collections before each test
    collections = await db.list_collection_names()
    for collection in collections:
        await db.drop_collection(collection)

    yield db

    # Clean up after test
    collections = await db.list_collection_names()
    for collection in collections:
        await db.drop_collection(collection)


@pytest.fixture
async def test_db(mongo_client):
    """Get test database instance."""
    return mongo_client[TEST_DB_NAME]


@pytest.fixture
async def client():
    """Create test HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Helper: create entities via API and return response data
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_customer_data():
    """Sample customer data for tests."""
    return {
        "name": "Test Customer Inc",
        "code": "TEST",
        "billing_email": "billing@test.com",
        "city": "Chicago",
        "state": "IL",
        "zip_code": "60601",
        "payment_terms": 30,
        "default_margin_percent": 15.0,
    }


@pytest.fixture
def sample_carrier_data():
    """Sample carrier data for tests."""
    return {
        "name": "Test Trucking LLC",
        "mc_number": "MC-999999",
        "dot_number": "9999999",
        "dispatch_email": "dispatch@testtrucking.com",
        "dispatch_phone": "555-9999",
        "equipment_types": ["van", "reefer"],
        "city": "Dallas",
        "state": "TX",
    }


@pytest.fixture
def sample_quote_request_data():
    """Sample quote request data for tests."""
    return {
        "source_type": "manual",
        "source_subject": "Rate request Chicago to Dallas",
        "raw_content": """
        Hi, I need a rate for:
        - Pickup: Chicago, IL
        - Delivery: Dallas, TX
        - Date: Next Monday
        - Equipment: Dry Van
        - Weight: 42,000 lbs
        - Commodity: General merchandise

        Thanks,
        John
        """,
        "sender_email": "john@customer.com",
    }


@pytest.fixture
def sample_quote_data():
    """Sample quote data for tests (requires customer_id to be set)."""
    return {
        "origin_city": "Chicago",
        "origin_state": "IL",
        "destination_city": "Dallas",
        "destination_state": "TX",
        "equipment_type": "van",
        "weight_lbs": 42000,
        "commodity": "General merchandise",
        "line_items": [
            {"description": "Linehaul", "quantity": 1, "unit_price": 250000, "is_accessorial": False},
            {"description": "Fuel Surcharge", "quantity": 1, "unit_price": 30000, "is_accessorial": True},
        ],
        "estimated_cost": 200000,
    }


@pytest.fixture
def sample_invoice_data():
    """Sample invoice data for tests (requires customer_id to be set)."""
    return {
        "billing_name": "Test Customer Inc",
        "billing_email": "billing@test.com",
        "line_items": [
            {"description": "Freight charges", "quantity": 1, "unit_price": 280000},
        ],
        "tax_amount": 0,
    }


# ---------------------------------------------------------------------------
# Convenience fixtures that create entities via API
# ---------------------------------------------------------------------------

@pytest.fixture
async def created_customer(client, sample_customer_data):
    """Create a customer via API and return the response data."""
    response = await client.post("/api/v1/customers", json=sample_customer_data)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def created_carrier(client, sample_carrier_data):
    """Create a carrier via API and return the response data."""
    response = await client.post("/api/v1/carriers", json=sample_carrier_data)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def created_quote(client, created_customer, sample_quote_data):
    """Create a quote via API and return the response data."""
    quote_data = {**sample_quote_data, "customer_id": created_customer["id"]}
    response = await client.post("/api/v1/quotes", json=quote_data)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def created_shipment(client, created_customer):
    """Create a shipment via API and return the response data."""
    shipment_data = {
        "customer_id": created_customer["id"],
        "equipment_type": "van",
        "customer_price": 280000,
        "carrier_cost": 200000,
    }
    response = await client.post("/api/v1/shipments", json=shipment_data)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def created_invoice(client, created_customer, sample_invoice_data):
    """Create an invoice via API and return the response data."""
    invoice_data = {**sample_invoice_data, "customer_id": created_customer["id"]}
    response = await client.post("/api/v1/invoices", json=invoice_data)
    assert response.status_code == 201
    return response.json()
