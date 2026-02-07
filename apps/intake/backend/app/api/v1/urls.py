"""URL source and snapshot management routes."""

import hashlib
from datetime import datetime, timezone
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_collection
from app.core.security import get_current_user
from app.schemas.url import (
    UrlFetchStatus,
    UrlSnapshotResponse,
    UrlSourceCreate,
    UrlSourceResponse,
)
from app.schemas.common import ResponseEnvelope

router = APIRouter()


def _doc_to_source_response(doc: dict) -> UrlSourceResponse:
    """Convert a MongoDB url_source document to a response model."""
    return UrlSourceResponse(
        urlSourceId=str(doc["_id"]),
        intakeId=doc["intakeId"],
        accountId=doc["accountId"],
        url=doc["url"],
        label=doc.get("label"),
        refreshPolicy=doc["refreshPolicy"],
        isActive=doc.get("isActive", True),
        lastFetchedAt=doc.get("lastFetchedAt"),
        lastFetchStatus=doc.get("lastFetchStatus"),
        lastDiffSummary=doc.get("lastDiffSummary"),
        snapshotCount=doc.get("snapshotCount", 0),
        createdAt=doc["createdAt"],
        updatedAt=doc["updatedAt"],
    )


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/urls
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/urls",
    response_model=ResponseEnvelope[UrlSourceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Add a URL source",
)
async def add_url_source(
    intakeId: str,
    body: UrlSourceCreate,
    current_user: dict = Depends(get_current_user),
):
    """Register a URL to monitor for an intake."""
    intakes_col = get_collection("intakes")
    urls_col = get_collection("url_sources")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    now = datetime.now(timezone.utc)

    url_doc = {
        "intakeId": intakeId,
        "accountId": current_user["accountId"],
        "url": body.url,
        "label": body.label,
        "refreshPolicy": body.refresh_policy.value,
        "isActive": True,
        "lastFetchedAt": None,
        "lastFetchStatus": None,
        "lastDiffSummary": None,
        "snapshotCount": 0,
        "createdBy": current_user["userId"],
        "createdAt": now,
        "updatedAt": now,
    }

    result = await urls_col.insert_one(url_doc)
    url_doc["_id"] = result.inserted_id

    return ResponseEnvelope(data=_doc_to_source_response(url_doc))


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/urls
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/urls",
    response_model=ResponseEnvelope[list[UrlSourceResponse]],
    summary="List URL sources",
)
async def list_url_sources(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all URL sources for an intake."""
    urls_col = get_collection("url_sources")

    cursor = urls_col.find({"intakeId": intakeId}).sort("createdAt", -1)

    items = []
    async for doc in cursor:
        items.append(_doc_to_source_response(doc))

    return ResponseEnvelope(data=items)


# ---------------------------------------------------------------------------
# POST /intakes/{intakeId}/urls/{urlSourceId}/refresh
# ---------------------------------------------------------------------------

@router.post(
    "/intakes/{intakeId}/urls/{urlSourceId}/refresh",
    response_model=ResponseEnvelope[UrlSnapshotResponse],
    summary="Refresh a URL source",
)
async def refresh_url(
    intakeId: str,
    urlSourceId: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch the URL, create a snapshot, compute diff, and create proposals.

    Uses httpx for fetching. Creates a usage_ledger entry for urlRefreshCount.
    """
    urls_col = get_collection("url_sources")
    snapshots_col = get_collection("url_snapshots")
    proposals_col = get_collection("proposals")
    usage_col = get_collection("usage_ledger")

    url_source = await urls_col.find_one(
        {"_id": ObjectId(urlSourceId), "intakeId": intakeId}
    )
    if not url_source:
        raise HTTPException(status_code=404, detail="URL source not found")

    now = datetime.now(timezone.utc)

    # Fetch the URL content
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url_source["url"])
    except httpx.RequestError as exc:
        # Record a failed fetch
        snapshot_doc = {
            "urlSourceId": urlSourceId,
            "intakeId": intakeId,
            "fetchedAt": now,
            "fetchStatus": UrlFetchStatus.FAILED.value,
            "httpStatusCode": None,
            "contentHash": None,
            "diffSummary": f"Fetch failed: {exc}",
            "extractedTextPreview": None,
            "createdAt": now,
        }
        result = await snapshots_col.insert_one(snapshot_doc)

        await urls_col.update_one(
            {"_id": ObjectId(urlSourceId)},
            {
                "$set": {
                    "lastFetchedAt": now,
                    "lastFetchStatus": UrlFetchStatus.FAILED.value,
                    "updatedAt": now,
                },
                "$inc": {"snapshotCount": 1},
            },
        )

        return ResponseEnvelope(
            data=UrlSnapshotResponse(
                urlSnapshotId=str(result.inserted_id),
                urlSourceId=urlSourceId,
                fetchedAt=now,
                fetchStatus=UrlFetchStatus.FAILED,
                httpStatusCode=None,
                contentHash=None,
                diffSummary=f"Fetch failed: {exc}",
                extractedTextPreview=None,
                createdAt=now,
            )
        )

    content = response.text
    content_hash = hashlib.sha256(content.encode()).hexdigest()

    # Compare with previous snapshot
    previous = await snapshots_col.find_one(
        {"urlSourceId": urlSourceId, "fetchStatus": UrlFetchStatus.SUCCESS.value},
        sort=[("fetchedAt", -1)],
    )

    has_changes = True
    diff_summary = None
    if previous and previous.get("contentHash") == content_hash:
        has_changes = False
        diff_summary = "No changes detected"
    elif previous:
        diff_summary = "Content changed since last fetch"
    else:
        diff_summary = "Initial fetch"

    # Store snapshot
    text_preview = content[:2000] if content else None

    snapshot_doc = {
        "urlSourceId": urlSourceId,
        "intakeId": intakeId,
        "fetchedAt": now,
        "fetchStatus": UrlFetchStatus.SUCCESS.value,
        "httpStatusCode": response.status_code,
        "contentHash": content_hash,
        "contentText": content,
        "diffSummary": diff_summary,
        "extractedTextPreview": text_preview,
        "hasChanges": has_changes,
        "createdAt": now,
    }

    result = await snapshots_col.insert_one(snapshot_doc)
    snapshot_id = str(result.inserted_id)

    # Update the URL source
    await urls_col.update_one(
        {"_id": ObjectId(urlSourceId)},
        {
            "$set": {
                "lastFetchedAt": now,
                "lastFetchStatus": UrlFetchStatus.SUCCESS.value,
                "lastDiffSummary": diff_summary,
                "updatedAt": now,
            },
            "$inc": {"snapshotCount": 1},
        },
    )

    # Create usage ledger entry
    await usage_col.insert_one(
        {
            "intakeId": intakeId,
            "accountId": url_source["accountId"],
            "urlSourceId": urlSourceId,
            "metricType": "urlRefreshCount",
            "quantity": 1,
            "createdAt": now,
        }
    )

    # If changes found, create proposals (placeholder -- would normally
    # use AI to extract answers from the content diff)
    if has_changes and previous:
        # Placeholder: no automatic proposal creation without AI integration
        pass

    return ResponseEnvelope(
        data=UrlSnapshotResponse(
            urlSnapshotId=snapshot_id,
            urlSourceId=urlSourceId,
            fetchedAt=now,
            fetchStatus=UrlFetchStatus.SUCCESS,
            httpStatusCode=response.status_code,
            contentHash=content_hash,
            diffSummary=diff_summary,
            extractedTextPreview=text_preview,
            createdAt=now,
        )
    )


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/urls/{urlSourceId}/snapshots
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/urls/{urlSourceId}/snapshots",
    response_model=ResponseEnvelope[list[UrlSnapshotResponse]],
    summary="List snapshots for a URL source",
)
async def list_snapshots(
    intakeId: str,
    urlSourceId: str,
    current_user: dict = Depends(get_current_user),
):
    """List all snapshots for a URL source, sorted by fetchedAt descending."""
    snapshots_col = get_collection("url_snapshots")

    cursor = snapshots_col.find(
        {"urlSourceId": urlSourceId, "intakeId": intakeId}
    ).sort("fetchedAt", -1)

    items = []
    async for doc in cursor:
        items.append(
            UrlSnapshotResponse(
                urlSnapshotId=str(doc["_id"]),
                urlSourceId=doc["urlSourceId"],
                fetchedAt=doc["fetchedAt"],
                fetchStatus=doc["fetchStatus"],
                httpStatusCode=doc.get("httpStatusCode"),
                contentHash=doc.get("contentHash"),
                diffSummary=doc.get("diffSummary"),
                extractedTextPreview=doc.get("extractedTextPreview"),
                createdAt=doc["createdAt"],
            )
        )

    return ResponseEnvelope(data=items)
