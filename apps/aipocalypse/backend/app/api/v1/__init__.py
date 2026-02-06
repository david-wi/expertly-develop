from fastapi import APIRouter

router = APIRouter()

from app.api.v1 import hypotheses, industries, companies, reports, queue, dashboard, settings

router.include_router(hypotheses.router, prefix="/hypotheses", tags=["hypotheses"])
router.include_router(industries.router, prefix="/industries", tags=["industries"])
router.include_router(companies.router, prefix="/companies", tags=["companies"])
router.include_router(reports.router, prefix="/reports", tags=["reports"])
router.include_router(queue.router, prefix="/queue", tags=["queue"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
