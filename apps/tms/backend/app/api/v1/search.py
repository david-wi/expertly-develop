"""
Unified search endpoint for Expertly TMS.

Searches across shipments, customers, and carriers using MongoDB text
indexes with relevance scoring and cursor-based pagination.
"""

from typing import Optional, Literal

from bson import ObjectId
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.database import get_database

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SearchResultItem(BaseModel):
    id: str
    type: Literal["shipment", "customer", "carrier"]
    title: str
    subtitle: str
    score: float
    data: dict


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    total: int
    next_cursor: Optional[str] = None
    query: str
    entity_type: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SEARCHABLE_COLLECTIONS: dict[str, dict] = {
    "shipment": {
        "collection": "shipments",
        "title_field": "shipment_number",
        "subtitle_template": "{origin_city}, {origin_state} -> {destination_city}, {destination_state}",
    },
    "customer": {
        "collection": "customers",
        "title_field": "name",
        "subtitle_template": "{city}, {state} | {status}",
    },
    "carrier": {
        "collection": "carriers",
        "title_field": "name",
        "subtitle_template": "MC# {mc_number} | DOT# {dot_number}",
    },
}


def _build_title(doc: dict, field: str) -> str:
    return str(doc.get(field, "Unknown"))


def _build_subtitle(doc: dict, template: str) -> str:
    try:
        return template.format_map({k: (v or "") for k, v in doc.items()})
    except (KeyError, ValueError):
        return ""


def _serialize_doc(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialisation."""
    out: dict = {}
    for key, value in doc.items():
        if isinstance(value, ObjectId):
            out[key] = str(value)
        else:
            out[key] = value
    return out


async def _search_collection(
    collection_name: str,
    query: str,
    entity_type: str,
    limit: int,
    cursor: Optional[str],
) -> tuple[list[SearchResultItem], int]:
    """Run a text search on a single collection and return scored results."""
    db = get_database()
    meta = _SEARCHABLE_COLLECTIONS[entity_type]
    collection = db[collection_name]

    # Build text search filter
    text_filter: dict = {"$text": {"$search": query}}
    if cursor:
        try:
            text_filter["_id"] = {"$gt": ObjectId(cursor)}
        except Exception:
            pass

    # Project the text score for relevance ranking
    projection = {"score": {"$meta": "textScore"}}

    total = await collection.count_documents({"$text": {"$search": query}})

    cursor_result = (
        collection.find(text_filter, projection)
        .sort([("score", {"$meta": "textScore"})])
        .limit(limit)
    )

    results: list[SearchResultItem] = []
    async for doc in cursor_result:
        doc_id = str(doc["_id"])
        serialized = _serialize_doc(doc)
        results.append(
            SearchResultItem(
                id=doc_id,
                type=entity_type,  # type: ignore[arg-type]
                title=_build_title(doc, meta["title_field"]),
                subtitle=_build_subtitle(doc, meta["subtitle_template"]),
                score=doc.get("score", 0.0),
                data=serialized,
            )
        )

    return results, total


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("", response_model=SearchResponse)
async def unified_search(
    q: str = Query(..., min_length=1, description="Search query"),
    type: str = Query("all", description="Entity type: shipment, customer, carrier, or all"),
    limit: int = Query(20, ge=1, le=100, description="Max results per page"),
    cursor: Optional[str] = Query(None, description="Cursor for pagination (last _id)"),
) -> SearchResponse:
    """
    Search across TMS entities using MongoDB text search.

    Results are ranked by relevance score. When ``type=all`` the results
    from all collections are merged and sorted by score.
    """
    entity_types: list[str]
    if type == "all":
        entity_types = list(_SEARCHABLE_COLLECTIONS.keys())
    elif type in _SEARCHABLE_COLLECTIONS:
        entity_types = [type]
    else:
        return SearchResponse(results=[], total=0, query=q, entity_type=type)

    all_results: list[SearchResultItem] = []
    total_count = 0

    for et in entity_types:
        meta = _SEARCHABLE_COLLECTIONS[et]
        try:
            results, count = await _search_collection(
                collection_name=meta["collection"],
                query=q,
                entity_type=et,
                limit=limit,
                cursor=cursor if len(entity_types) == 1 else None,
            )
            all_results.extend(results)
            total_count += count
        except Exception:
            # Collection may not have text index yet; silently skip.
            pass

    # Sort merged results by score descending, take top `limit`
    all_results.sort(key=lambda r: r.score, reverse=True)
    page = all_results[:limit]

    next_cursor_value: Optional[str] = None
    if page:
        next_cursor_value = page[-1].id

    return SearchResponse(
        results=page,
        total=total_count,
        next_cursor=next_cursor_value if len(page) == limit else None,
        query=q,
        entity_type=type,
    )
