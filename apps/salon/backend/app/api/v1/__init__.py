from fastapi import APIRouter

from .auth import router as auth_router
from .salons import router as salons_router
from .staff import router as staff_router
from .services import router as services_router
from .clients import router as clients_router
from .appointments import router as appointments_router
from .calendar import router as calendar_router
from .waitlist import router as waitlist_router
from .promotions import router as promotions_router
from .notifications import router as notifications_router
from .stripe import router as stripe_router
from .website import router as website_router
from .email import router as email_router
from .websocket import router as websocket_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(salons_router, prefix="/salons", tags=["Salons"])
router.include_router(staff_router, prefix="/staff", tags=["Staff"])
router.include_router(services_router, prefix="/services", tags=["Services"])
router.include_router(clients_router, prefix="/clients", tags=["Clients"])
router.include_router(appointments_router, prefix="/appointments", tags=["Appointments"])
router.include_router(calendar_router, prefix="/calendar", tags=["Calendar"])
router.include_router(waitlist_router, prefix="/waitlist", tags=["Waitlist"])
router.include_router(promotions_router, prefix="/promotions", tags=["Promotions"])
router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
router.include_router(stripe_router, prefix="/stripe", tags=["Payments"])
router.include_router(website_router, prefix="/website", tags=["Website"])
router.include_router(email_router, prefix="/email", tags=["Email"])
router.include_router(websocket_router, tags=["WebSocket"])
