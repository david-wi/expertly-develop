from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import get_settings
from app.database import connect_to_mongo, close_mongo_connection, check_database_connection
from app.utils.seed import seed_database, ensure_indexes
from app.api.v1 import organizations, users, teams, queues, tasks, projects, sops, playbooks, bot, websocket, recurring_tasks, images, backlog, connections, ai

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
    logger.info("Starting Expertly Manage API")
    await connect_to_mongo()

    # Always ensure indexes exist (idempotent, safe to run on every startup)
    await ensure_indexes()

    # Seed database in dev mode
    if settings.skip_auth:
        logger.info("Dev mode enabled (SKIP_AUTH=true), seeding database")
        await seed_database()

    yield

    # Shutdown
    logger.info("Shutting down Expertly Manage API")
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    description="Multi-tenant SaaS for managing organizations via queue-driven tasks",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://manage.ai.devintensive.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["organizations"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(teams.router, prefix="/api/v1/teams", tags=["teams"])
app.include_router(queues.router, prefix="/api/v1/queues", tags=["queues"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(sops.router, prefix="/api/v1/sops", tags=["sops"])
app.include_router(playbooks.router, prefix="/api/v1/playbooks", tags=["playbooks"])
app.include_router(bot.router, prefix="/api/v1/bot", tags=["bot"])
app.include_router(recurring_tasks.router, prefix="/api/v1/recurring-tasks", tags=["recurring-tasks"])
app.include_router(images.router, prefix="/api/v1/images", tags=["images"])
app.include_router(backlog.router, prefix="/api/v1/backlog", tags=["backlog"])
app.include_router(connections.router, prefix="/api/v1/connections", tags=["connections"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(websocket.router, tags=["websocket"])


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
