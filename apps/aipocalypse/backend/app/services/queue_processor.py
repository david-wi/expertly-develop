import logging
from bson import ObjectId
from app.database import get_database
from app.models.base import utc_now
from app.services.report_generator import generate_research_report

logger = logging.getLogger(__name__)


async def process_next(batch_size: int = 5) -> list[dict]:
    """Process the next batch of queued items."""
    db = get_database()
    results = []

    # Find oldest queued items
    cursor = db.research_queue.find({"status": "queued"}).sort([
        ("priority", -1),
        ("created_at", 1)
    ]).limit(batch_size)

    items = []
    async for item in cursor:
        items.append(item)

    for item in items:
        item_id = item["_id"]
        company_id = item["company_id"]

        # Mark as in_progress
        await db.research_queue.update_one(
            {"_id": item_id},
            {"$set": {"status": "in_progress", "started_at": utc_now(), "updated_at": utc_now()}}
        )

        try:
            # Get company
            company = await db.companies.find_one({"_id": ObjectId(company_id)})
            if not company:
                raise ValueError(f"Company {company_id} not found")

            # Generate report
            report = await generate_research_report(company)

            # Mark completed
            await db.research_queue.update_one(
                {"_id": item_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": utc_now(),
                    "report_id": str(report["_id"]),
                    "updated_at": utc_now(),
                }}
            )
            results.append({
                "item_id": str(item_id),
                "status": "completed",
                "report_id": str(report["_id"]),
            })

        except Exception as e:
            logger.error(f"Failed to process queue item {item_id}: {e}")
            await db.research_queue.update_one(
                {"_id": item_id},
                {"$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": utc_now(),
                    "updated_at": utc_now(),
                }}
            )
            results.append({
                "item_id": str(item_id),
                "status": "failed",
                "error": str(e),
            })

    return results
