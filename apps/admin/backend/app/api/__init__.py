"""API routes."""

from fastapi import APIRouter

from app.api.themes import router as themes_router
from app.api.public import router as public_router
from app.api.metrics import router as metrics_router
from app.api.monitoring import router as monitoring_router
from app.api.users import router as users_router
from app.api.error_logs import router as error_logs_router
from app.api.ai_config import router as ai_config_router
from app.api.known_issues import router as known_issues_router

api_router = APIRouter()
api_router.include_router(themes_router, prefix="/themes", tags=["themes"])
api_router.include_router(public_router, prefix="/public", tags=["public"])
api_router.include_router(metrics_router, prefix="/metrics", tags=["metrics"])
api_router.include_router(monitoring_router, prefix="/monitoring", tags=["monitoring"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(error_logs_router, prefix="/error-logs", tags=["error-logs"])
api_router.include_router(ai_config_router, prefix="/ai-config", tags=["ai-config"])
api_router.include_router(known_issues_router, prefix="/known-issues", tags=["known-issues"])
