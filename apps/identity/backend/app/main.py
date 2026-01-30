"""Expertly Identity - User and Team Management Service."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.api.v1 import users, teams, organizations, images, auth, admin
from app.core.redis import close_redis

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and Redis on startup, cleanup on shutdown."""
    await init_db()
    yield
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    description="Centralized identity management for the Expertly product suite",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow all subdomains of ai.devintensive.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://define.ai.devintensive.com",
        "https://develop.ai.devintensive.com",
        "https://identity.ai.devintensive.com",
        "https://manage.ai.devintensive.com",
        "https://today.ai.devintensive.com",
        "https://admin.ai.devintensive.com",
        "https://salon.ai.devintensive.com",
        "https://qa.ai.devintensive.com",
        "https://vibecode.ai.devintensive.com",
        "https://vibetest.ai.devintensive.com",
        "http://localhost:3000",
        "http://localhost:3010",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["Organizations"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(teams.router, prefix="/api/v1/teams", tags=["Teams"])
app.include_router(images.router, prefix="/api/v1/images", tags=["Images"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

# Static file serving for uploaded avatars
uploads_path = Path(settings.uploads_dir)
try:
    uploads_path.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")
except OSError:
    # Directory cannot be created (e.g., in testing environment)
    pass


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "identity"}
