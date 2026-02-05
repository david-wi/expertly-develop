from fastapi import APIRouter

from . import customers, carriers, facilities, quote_requests, quotes, shipments, tenders, tracking, documents, invoices, work_items, ai, analytics, emails, customs, loadboards, accounting, carrier_portal, customer_portal, automation, notifications

router = APIRouter()

router.include_router(customers.router, prefix="/customers", tags=["customers"])
router.include_router(carriers.router, prefix="/carriers", tags=["carriers"])
router.include_router(facilities.router, prefix="/facilities", tags=["facilities"])
router.include_router(quote_requests.router, prefix="/quote-requests", tags=["quote-requests"])
router.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
router.include_router(tenders.router, prefix="/tenders", tags=["tenders"])
router.include_router(tracking.router, prefix="/tracking", tags=["tracking"])
router.include_router(documents.router, prefix="/documents", tags=["documents"])
router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
router.include_router(work_items.router, prefix="/work-items", tags=["work-items"])
router.include_router(ai.router, prefix="/ai", tags=["ai"])
router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
router.include_router(emails.router, prefix="/emails", tags=["emails"])
router.include_router(customs.router, prefix="/customs", tags=["customs"])
router.include_router(loadboards.router, prefix="/loadboards", tags=["loadboards"])
router.include_router(accounting.router, prefix="/accounting", tags=["accounting"])
router.include_router(carrier_portal.router, prefix="/carrier-portal", tags=["carrier-portal"])
router.include_router(customer_portal.router, prefix="/customer-portal", tags=["customer-portal"])
router.include_router(automation.router, prefix="/automation", tags=["automation"])
router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
