"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import get_settings
from app.database import connect_to_mongo, close_mongo_connection, check_database_connection
from app.utils.seed import seed_database, ensure_indexes
from app.api.v1 import router as api_router

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
    logger.info("Starting Aipocalypse Fund API")
    await connect_to_mongo()
    await ensure_indexes()
    await seed_database()
    yield
    # Shutdown
    logger.info("Shutting down Aipocalypse Fund API")
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    description="AI-impact investment research API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
        "https://aipocalypse.ai.devintensive.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    db_connected = await check_database_connection()
    return {
        "status": "healthy" if db_connected else "degraded",
        "database": "connected" if db_connected else "disconnected"
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": "0.1.0",
        "docs": "/api/docs"
    }
