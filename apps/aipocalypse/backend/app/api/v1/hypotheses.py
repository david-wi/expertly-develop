from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import get_database
from app.models.base import utc_now
from app.schemas.hypothesis import HypothesisCreate, HypothesisUpdate, HypothesisResponse

router = APIRouter()


def _to_response(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc["created_at"] = doc["created_at"].isoformat() if doc.get("created_at") else ""
    doc["updated_at"] = doc["updated_at"].isoformat() if doc.get("updated_at") else ""
    return doc


@router.get("")
async def list_hypotheses(status: str = None):
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    cursor = db.hypotheses.find(query).sort("created_at", -1)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


@router.post("", status_code=201)
async def create_hypothesis(data: HypothesisCreate):
    db = get_database()
    now = utc_now()
    doc = {
        **data.model_dump(),
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    result = await db.hypotheses.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.get("/{hypothesis_id}")
async def get_hypothesis(hypothesis_id: str):
    db = get_database()
    doc = await db.hypotheses.find_one({"_id": ObjectId(hypothesis_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    return _to_response(doc)


@router.patch("/{hypothesis_id}")
async def update_hypothesis(hypothesis_id: str, data: HypothesisUpdate):
    db = get_database()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = utc_now()
    result = await db.hypotheses.update_one(
        {"_id": ObjectId(hypothesis_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    doc = await db.hypotheses.find_one({"_id": ObjectId(hypothesis_id)})
    return _to_response(doc)


@router.delete("/{hypothesis_id}")
async def delete_hypothesis(hypothesis_id: str):
    db = get_database()
    result = await db.hypotheses.delete_one({"_id": ObjectId(hypothesis_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    return {"deleted": True}


@router.post("/{hypothesis_id}/archive")
async def archive_hypothesis(hypothesis_id: str):
    db = get_database()
    result = await db.hypotheses.update_one(
        {"_id": ObjectId(hypothesis_id)},
        {"$set": {"status": "archived", "updated_at": utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    return {"status": "archived"}


@router.post("/{hypothesis_id}/activate")
async def activate_hypothesis(hypothesis_id: str):
    db = get_database()
    result = await db.hypotheses.update_one(
        {"_id": ObjectId(hypothesis_id)},
        {"$set": {"status": "active", "updated_at": utc_now()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    return {"status": "active"}
