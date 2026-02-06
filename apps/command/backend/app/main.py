from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.config import get_settings
from app.database import connect_to_mongo, close_mongo_connection, check_database_connection
from app.utils.seed import seed_database, ensure_indexes
from app.api.v1 import organizations, users, teams, queues, tasks, projects, sops, playbooks, bot, websocket, recurring_tasks, images, backlog, connections, ai, task_attachments, task_comments, task_suggestions, monitors, webhooks, notifications, bots, documents, step_responses, expertise, dashboard_notes, artifacts, tts

settings = get_settings()

# Background task reference
_monitor_polling_task: asyncio.Task | None = None

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def poll_due_monitors():
    """Background task that polls monitors when they're due."""
    from datetime import datetime, timezone
    from app.database import get_database
    from app.services.monitor_service import MonitorService

    logger.info("Monitor polling background task started")

    while True:
        try:
            await asyncio.sleep(60)  # Check every minute

            db = get_database()
            now = datetime.now(timezone.utc)

            # Find monitors that are:
            # - Active
            # - Not deleted
            # - Due for polling (last_polled_at + poll_interval_seconds < now)
            pipeline = [
                {
                    "$match": {
                        "status": "active",
                        "deleted_at": None
                    }
                },
                {
                    "$addFields": {
                        "next_poll_at": {
                            "$add": [
                                {"$ifNull": ["$last_polled_at", "$created_at"]},
                                {"$multiply": ["$poll_interval_seconds", 1000]}
                            ]
                        }
                    }
                },
                {
                    "$match": {
                        "next_poll_at": {"$lte": now}
                    }
                }
            ]

            due_monitors = await db.monitors.aggregate(pipeline).to_list(100)

            if due_monitors:
                logger.info(f"Found {len(due_monitors)} monitors due for polling")
                service = MonitorService()

                for monitor in due_monitors:
                    monitor_id = str(monitor["_id"])
                    try:
                        result = await service.poll_monitor(monitor_id)
                        if result.get("error"):
                            logger.warning(f"Monitor {monitor_id} poll error: {result['error']}")
                        elif result.get("events_found", 0) > 0:
                            logger.info(f"Monitor {monitor_id}: {result['events_found']} events found")
                    except Exception as e:
                        logger.error(f"Error polling monitor {monitor_id}: {e}")

        except asyncio.CancelledError:
            logger.info("Monitor polling task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in monitor polling loop: {e}")
            await asyncio.sleep(60)  # Wait before retrying


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global _monitor_polling_task

    # Startup
    logger.info("Starting Expertly Command API")
    await connect_to_mongo()

    # Always ensure indexes exist (idempotent, safe to run on every startup)
    await ensure_indexes()

    # Seed database in dev mode
    if settings.skip_auth:
        logger.info("Dev mode enabled (SKIP_AUTH=true), seeding database")
        await seed_database()

    # Start background monitor polling task
    _monitor_polling_task = asyncio.create_task(poll_due_monitors())
    logger.info("Started monitor polling background task")

    yield

    # Shutdown
    logger.info("Shutting down Expertly Command API")

    # Cancel the background polling task
    if _monitor_polling_task:
        _monitor_polling_task.cancel()
        try:
            await _monitor_polling_task
        except asyncio.CancelledError:
            pass
        logger.info("Stopped monitor polling background task")

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
        "https://command.ai.devintensive.com",
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
app.include_router(task_attachments.router, prefix="/api/v1", tags=["task-attachments"])
app.include_router(task_comments.router, prefix="/api/v1", tags=["task-comments"])
app.include_router(task_suggestions.router, prefix="/api/v1", tags=["task-suggestions"])
app.include_router(step_responses.router, prefix="/api/v1", tags=["step-responses"])
app.include_router(monitors.router, prefix="/api/v1/monitors", tags=["monitors"])
app.include_router(webhooks.router, prefix="/api/v1/webhooks", tags=["webhooks"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(bots.router, prefix="/api/v1/bots", tags=["bots"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(expertise.router, prefix="/api/v1/expertise", tags=["expertise"])
app.include_router(dashboard_notes.router, prefix="/api/v1/dashboard-notes", tags=["dashboard-notes"])
app.include_router(artifacts.router, prefix="/api/v1/artifacts", tags=["artifacts"])
app.include_router(artifacts.project_artifacts_router, prefix="/api/v1/project-artifacts", tags=["project-artifacts"])
app.include_router(tts.router, prefix="/api/v1/tts", tags=["tts"])
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
