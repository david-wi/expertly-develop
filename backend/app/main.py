"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import connect_to_mongodb, close_mongodb_connection, get_database
from app.api.v1 import router as api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await connect_to_mongodb()
    await seed_initial_data()
    yield
    # Shutdown
    await close_mongodb_connection()


async def seed_initial_data():
    """Seed initial data if not exists."""
    db = get_database()

    # Check if tenant exists
    tenant = await db.tenants.find_one({"slug": "default"})
    if not tenant:
        # Create default tenant
        result = await db.tenants.insert_one({
            "name": "Default Organization",
            "slug": "default",
            "settings": {"default_visibility": "team"},
        })
        tenant_id = result.inserted_id

        # Create default user (David)
        import uuid
        await db.users.insert_one({
            "tenant_id": tenant_id,
            "email": "david@example.com",
            "name": "David",
            "role": "admin",
            "is_default": True,
            "api_key": str(uuid.uuid4()),
        })

        # Create preconfigured scenarios
        await db.preconfigured_scenarios.insert_many([
            {
                "tenant_id": None,
                "code": "basic_visual_walkthrough",
                "name": "Basic Visual Walkthrough",
                "description": "Navigates through main pages and captures screenshots",
                "scenario_template": """Navigate to /
Capture "Homepage"
Wait 2 seconds
Navigate to /about
Capture "About Page"
Navigate to /contact
Capture "Contact Page"
""",
                "default_observations": [
                    "Note any visual inconsistencies",
                    "Check responsive design",
                    "Verify navigation works correctly",
                ],
                "is_system": True,
            },
            {
                "tenant_id": None,
                "code": "e2e_testing",
                "name": "End-to-End Testing",
                "description": "Comprehensive testing of main user flows",
                "scenario_template": """Navigate to /
Capture "Landing Page"
Navigate to /login
Capture "Login Page"
Navigate to /dashboard
Capture "Dashboard"
Navigate to /settings
Capture "Settings Page"
Navigate to /profile
Capture "Profile Page"
""",
                "default_observations": [
                    "Verify all links work",
                    "Check form validations",
                    "Note loading states",
                    "Check error handling",
                ],
                "is_system": True,
            },
        ])

        print("Initial data seeded successfully")


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Multitenant development tools platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs_url": "/docs",
    }
