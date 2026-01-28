"""API v1 module."""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, projects, environments, tests, suites, runs, quick_start, health, organizations

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(quick_start.router, prefix="/quick-start", tags=["quick-start"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
