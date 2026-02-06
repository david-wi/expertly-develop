from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import get_database
from app.models.base import utc_now
from app.schemas.research_queue import QueueItemCreate, QueueItemBatchCreate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _to_response(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    for field in ["created_at", "updated_at", "started_at", "completed_at"]:
        if doc.get(field) and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()
        elif not doc.get(field):
            doc[field] = None
    return doc


@router.get("")
async def list_queue(status: str = None):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    cursor = db.research_queue.find(query).sort([("priority", -1), ("created_at", 1)])
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


@router.post("", status_code=201)
async def add_to_queue(data: QueueItemCreate):
    db = get_database()
    now = utc_now()
    doc = {
        **data.model_dump(),
        "status": "queued",
        "started_at": None,
        "completed_at": None,
        "report_id": None,
        "error_message": None,
        "retry_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.research_queue.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.post("/batch", status_code=201)
async def add_batch_to_queue(data: QueueItemBatchCreate):
    db = get_database()
    now = utc_now()
    docs = []
    for item in data.items:
        docs.append({
            **item.model_dump(),
            "status": "queued",
            "started_at": None,
            "completed_at": None,
            "report_id": None,
            "error_message": None,
            "retry_count": 0,
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        await db.research_queue.insert_many(docs)
    return {"added": len(docs)}


@router.get("/status")
async def queue_status():
    db = get_database()
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    counts = {}
    async for doc in db.research_queue.aggregate(pipeline):
        counts[doc["_id"]] = doc["count"]
    return {
        "queued": counts.get("queued", 0),
        "in_progress": counts.get("in_progress", 0),
        "completed": counts.get("completed", 0),
        "failed": counts.get("failed", 0),
        "total": sum(counts.values()),
    }


@router.post("/process")
async def process_queue():
    try:
        from app.services.queue_processor import process_next
        from app.config import get_settings
        settings = get_settings()
        results = await process_next(settings.queue_batch_size)
        return {"processed": len(results), "results": results}
    except Exception as e:
        logger.error(f"Queue processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Queue processing failed: {str(e)}")


@router.post("/{item_id}/retry")
async def retry_queue_item(item_id: str):
    db = get_database()
    result = await db.research_queue.update_one(
        {"_id": ObjectId(item_id)},
        {
            "$set": {
                "status": "queued",
                "error_message": None,
                "started_at": None,
                "completed_at": None,
                "updated_at": utc_now(),
            },
            "$inc": {"retry_count": 1}
        }
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return {"retried": True}


@router.delete("/{item_id}")
async def delete_queue_item(item_id: str):
    db = get_database()
    result = await db.research_queue.delete_one({"_id": ObjectId(item_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return {"deleted": True}


@router.post("/clear-completed")
async def clear_completed():
    db = get_database()
    result = await db.research_queue.delete_many({"status": "completed"})
    return {"deleted": result.deleted_count}
