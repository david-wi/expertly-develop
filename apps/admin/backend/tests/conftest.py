"""Pytest configuration and fixtures for Admin backend tests."""

import pytest
import asyncio
from typing import AsyncGenerator, Generator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from app.database import Base, get_db
from app.main import app


# Use in-memory SQLite for tests (fast, isolated)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session_maker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_maker() as session:
        yield session


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def sample_theme_data():
    """Sample theme data for testing."""
    return {
        "name": "Test Theme",
        "slug": "test-theme",
        "description": "A test theme",
        "colors": {
            "light": {
                "primary": {
                    "50": "#f0f9ff",
                    "100": "#e0f2fe",
                    "200": "#bae6fd",
                    "300": "#7dd3fc",
                    "400": "#38bdf8",
                    "500": "#0ea5e9",
                    "600": "#0284c7",
                    "700": "#0369a1",
                    "800": "#075985",
                    "900": "#0c4a6e",
                    "950": "#082f49",
                },
                "background": {
                    "default": "#ffffff",
                    "surface": "#f8fafc",
                    "elevated": "#f1f5f9",
                },
                "text": {
                    "primary": "#0f172a",
                    "secondary": "#475569",
                    "muted": "#94a3b8",
                },
                "border": {
                    "default": "#e2e8f0",
                    "subtle": "#f1f5f9",
                },
            },
            "dark": {
                "primary": {
                    "50": "#f0f9ff",
                    "100": "#e0f2fe",
                    "200": "#bae6fd",
                    "300": "#7dd3fc",
                    "400": "#38bdf8",
                    "500": "#0ea5e9",
                    "600": "#0284c7",
                    "700": "#0369a1",
                    "800": "#075985",
                    "900": "#0c4a6e",
                    "950": "#082f49",
                },
                "background": {
                    "default": "#0f172a",
                    "surface": "#1e293b",
                    "elevated": "#334155",
                },
                "text": {
                    "primary": "#f8fafc",
                    "secondary": "#cbd5e1",
                    "muted": "#64748b",
                },
                "border": {
                    "default": "#334155",
                    "subtle": "#1e293b",
                },
            },
        },
    }
