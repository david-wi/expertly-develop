from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import get_settings
from app.database import connect_to_mongo, close_mongo_connection, check_database_connection
from app.utils.seed import seed_database, ensure_indexes
from app.api.v1 import router as api_router
from app.api.v1.websocket import router as ws_router

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
    logger.info("Starting Expertly TMS API")
    await connect_to_mongo()

    # Always ensure indexes exist (idempotent, safe to run on every startup)
    await ensure_indexes()

    # Seed database in dev mode
    if settings.skip_auth:
        logger.info("Dev mode enabled (SKIP_AUTH=true), seeding database")
        await seed_database()

    yield

    # Shutdown
    logger.info("Shutting down Expertly TMS API")
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    description="AI-first Transportation Management System for 3PL brokers",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://tms.ai.devintensive.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")

# WebSocket routes
app.include_router(ws_router)


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
        "docs": "/docs"
    }
