"""API routes."""

from fastapi import APIRouter

from app.api.themes import router as themes_router
from app.api.public import router as public_router
from app.api.metrics import router as metrics_router
from app.api.monitoring import router as monitoring_router

api_router = APIRouter()
api_router.include_router(themes_router, prefix="/themes", tags=["themes"])
api_router.include_router(public_router, prefix="/public", tags=["public"])
api_router.include_router(metrics_router, prefix="/metrics", tags=["metrics"])
api_router.include_router(monitoring_router, prefix="/monitoring", tags=["monitoring"])
