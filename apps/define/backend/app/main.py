from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import os

from app.config import get_settings
from app.database import init_db
from app.api.v1 import products, requirements, releases, jira, uploads, ai, users

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Expertly Define API")
    init_db()
    logger.info("Database initialized")

    # Ensure uploads directory exists
    os.makedirs(settings.uploads_dir, exist_ok=True)

    yield

    # Shutdown
    logger.info("Shutting down Expertly Define API")


app = FastAPI(
    title=settings.app_name,
    description="AI-powered Requirements Management API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://define.ai.devintensive.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(requirements.router, prefix="/api/v1/requirements", tags=["requirements"])
app.include_router(releases.router, prefix="/api/v1/releases", tags=["releases"])
app.include_router(jira.router, prefix="/api/v1/jira", tags=["jira"])
app.include_router(uploads.router, prefix="/api/v1/uploads", tags=["uploads"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }
