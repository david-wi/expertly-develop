"""Vibe QA - Main FastAPI application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.config import get_settings
from app.api.v1 import api_router
from app.database import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Ensure artifacts directory exists
    settings = get_settings()
    os.makedirs(settings.artifacts_path, exist_ok=True)

    yield

    # Shutdown
    # Cleanup browser service
    from app.services.browser import get_browser_service
    try:
        browser_service = get_browser_service()
        browser_service.close()
    except Exception:
        pass


settings = get_settings()

app = FastAPI(
    title="Vibe QA",
    description="AI-powered testing platform",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix="/api/v1")


# Serve artifacts
@app.get("/api/v1/artifacts/{artifact_path:path}")
async def serve_artifact(artifact_path: str):
    """Serve artifact files."""
    full_path = os.path.join(settings.artifacts_path, artifact_path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return FileResponse(full_path)
    return {"error": "Artifact not found"}, 404


# Root endpoint
@app.get("/api")
def api_root():
    """API root endpoint."""
    return {
        "name": "Vibe QA API",
        "version": "0.1.0",
        "docs": "/api/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
