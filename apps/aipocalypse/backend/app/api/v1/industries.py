from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.database import get_database
from app.models.base import utc_now
from app.schemas.industry import IndustryCreate, IndustryUpdate, IndustryResponse

router = APIRouter()


def _to_response(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    if doc.get("parent_id"):
        doc["parent_id"] = str(doc["parent_id"])
    doc["created_at"] = doc["created_at"].isoformat() if doc.get("created_at") else ""
    doc["updated_at"] = doc["updated_at"].isoformat() if doc.get("updated_at") else ""
    return doc


@router.get("")
async def list_industries(level: int = None, parent_id: str = None):
    db = get_database()
    query = {}
    if level is not None:
        query["level"] = level
    if parent_id:
        query["parent_id"] = parent_id
    cursor = db.industries.find(query).sort("sort_order", 1)
    results = []
    async for doc in cursor:
        results.append(_to_response(doc))
    return results


@router.get("/tree")
async def get_industry_tree():
    db = get_database()
    all_industries = []
    async for doc in db.industries.find().sort("sort_order", 1):
        item = _to_response(doc)
        item["children"] = []
        all_industries.append(item)

    # Build tree
    by_id = {ind["id"]: ind for ind in all_industries}
    tree = []
    for ind in all_industries:
        if ind["parent_id"] and ind["parent_id"] in by_id:
            by_id[ind["parent_id"]]["children"].append(ind)
        elif not ind["parent_id"]:
            tree.append(ind)
    return tree


@router.post("", status_code=201)
async def create_industry(data: IndustryCreate):
    db = get_database()
    now = utc_now()
    doc = {
        **data.model_dump(),
        "company_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    result = await db.industries.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_response(doc)


@router.get("/{industry_id}")
async def get_industry(industry_id: str):
    db = get_database()
    doc = await db.industries.find_one({"_id": ObjectId(industry_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Industry not found")
    return _to_response(doc)


@router.patch("/{industry_id}")
async def update_industry(industry_id: str, data: IndustryUpdate):
    db = get_database()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updated_at"] = utc_now()
    result = await db.industries.update_one(
        {"_id": ObjectId(industry_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")
    doc = await db.industries.find_one({"_id": ObjectId(industry_id)})
    return _to_response(doc)


@router.delete("/{industry_id}")
async def delete_industry(industry_id: str):
    db = get_database()
    result = await db.industries.delete_one({"_id": ObjectId(industry_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Industry not found")
    return {"deleted": True}
