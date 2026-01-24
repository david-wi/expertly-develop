"""API v1 package."""

from fastapi import APIRouter

from app.api.v1 import health, projects, personas, documents, jobs, walkthroughs, artifacts, requirements, scenarios

router = APIRouter()

router.include_router(health.router, tags=["Health"])
router.include_router(projects.router, prefix="/projects", tags=["Projects"])
router.include_router(personas.router, prefix="/personas", tags=["Personas"])
router.include_router(documents.router, prefix="/documents", tags=["Documents"])
router.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
router.include_router(walkthroughs.router, prefix="/walkthroughs", tags=["Walkthroughs"])
router.include_router(artifacts.router, prefix="/artifacts", tags=["Artifacts"])
router.include_router(requirements.router, prefix="/requirements", tags=["Requirements"])
router.include_router(scenarios.router, prefix="/scenarios", tags=["Scenarios"])
