"""Pytest configuration and fixtures for Aipocalypse Fund backend tests."""
import pytest
import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import set_database

TEST_DB_NAME = "aipocalypse_fund_test"


@pytest_asyncio.fixture(autouse=True)
async def clean_database():
    """Create an in-memory test database and inject it into the app."""
    client = AsyncMongoMockClient()
    db = client[TEST_DB_NAME]

    # Inject test database into app
    set_database(db)

    yield db

    # Cleanup
    client.close()


@pytest_asyncio.fixture
async def client():
    """Create test HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_hypothesis_data():
    """Sample hypothesis data for tests."""
    return {
        "title": "AI Coding Tools Devastate IT Services",
        "description": "AI coding assistants will reduce demand for large dev teams.",
        "thesis_type": "disruption",
        "impact_direction": "negative",
        "confidence_level": 85,
        "tags": ["ai-coding", "it-services"],
        "supporting_evidence": ["GitHub Copilot adoption rising"],
        "counter_arguments": ["Complex systems still need humans"],
    }


@pytest.fixture
def sample_company_data():
    """Sample company data for tests."""
    return {
        "name": "Acme Corp",
        "ticker": "ACME",
        "description": "Enterprise software company",
        "exchange": "NYSE",
    }


@pytest.fixture
def sample_report_data():
    """Sample report data for tests. Requires a valid company_id to be set."""
    return {
        "company_id": "",  # Must be set by test
        "signal": "sell",
        "signal_confidence": 75,
        "executive_summary": "Test executive summary for the company.",
        "business_model_analysis": "Test business model analysis.",
        "revenue_sources": "Test revenue sources breakdown.",
        "margin_analysis": "Test margin analysis.",
        "moat_assessment": "Test moat assessment.",
        "moat_rating": "weak",
        "ai_impact_analysis": "Test AI impact analysis.",
        "ai_vulnerability_score": 70,
        "competitive_landscape": "Test competitive landscape.",
        "valuation_assessment": "Test valuation assessment.",
        "investment_recommendation": "Test recommendation: Sell.",
        "hypothesis_impacts": [],
        "citations": [{"source": "Test Source", "url": "https://example.com"}],
        "sec_filings_used": [],
        "model_used": "manual",
    }
