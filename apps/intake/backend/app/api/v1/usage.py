"""Usage metering and reporting routes."""

from datetime import date, datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_collection
from app.core.security import get_current_user, require_admin
from app.schemas.usage import UsageReportResponse, UsageResponse, UsageRollup
from app.schemas.common import ResponseEnvelope

router = APIRouter()


async def _aggregate_usage(
    match_filter: dict,
) -> dict[str, int]:
    """Run an aggregation pipeline on usage_ledger and return totals."""
    usage_col = get_collection("usage_ledger")

    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": "$metricType",
                "total": {"$sum": "$quantity"},
            }
        },
    ]

    totals: dict[str, int] = {
        "callSeconds": 0,
        "transcriptionSeconds": 0,
        "ocrPages": 0,
        "urlRefreshCount": 0,
    }

    async for doc in usage_col.aggregate(pipeline):
        metric = doc["_id"]
        if metric in totals:
            totals[metric] = doc["total"]

    return totals


# ---------------------------------------------------------------------------
# GET /intakes/{intakeId}/usage
# ---------------------------------------------------------------------------

@router.get(
    "/intakes/{intakeId}/usage",
    response_model=ResponseEnvelope[UsageResponse],
    summary="Get usage rollup for an intake",
)
async def get_intake_usage(
    intakeId: str,
    current_user: dict = Depends(get_current_user),
):
    """Return aggregated usage for a specific intake."""
    intakes_col = get_collection("intakes")

    intake = await intakes_col.find_one({"_id": ObjectId(intakeId)})
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    totals = await _aggregate_usage({"intakeId": intakeId})

    return ResponseEnvelope(
        data=UsageResponse(
            intakeId=intakeId,
            usage=UsageRollup(
                callSeconds=totals["callSeconds"],
                transcriptionSeconds=totals["transcriptionSeconds"],
                ocrPages=totals["ocrPages"],
                urlRefreshCount=totals["urlRefreshCount"],
            ),
        )
    )


# ---------------------------------------------------------------------------
# GET /usage/report  (admin only)
# ---------------------------------------------------------------------------

@router.get(
    "/usage/report",
    response_model=ResponseEnvelope[UsageReportResponse],
    summary="Account-level usage report",
)
async def get_usage_report(
    start: date = Query(..., description="Start date (inclusive)"),
    end: date = Query(..., description="End date (inclusive)"),
    current_user: dict = Depends(require_admin),
):
    """Return an account-level usage report for a date range.

    Admin-only endpoint.
    """
    usage_col = get_collection("usage_ledger")
    account_id = current_user["accountId"]

    start_dt = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    end_dt = datetime(
        end.year, end.month, end.day, 23, 59, 59, 999999, tzinfo=timezone.utc
    )

    match_filter = {
        "accountId": account_id,
        "createdAt": {"$gte": start_dt, "$lte": end_dt},
    }

    # Account-level totals
    totals = await _aggregate_usage(match_filter)

    # Per-intake breakdown
    pipeline = [
        {"$match": match_filter},
        {
            "$group": {
                "_id": {
                    "intakeId": "$intakeId",
                    "metricType": "$metricType",
                },
                "total": {"$sum": "$quantity"},
            }
        },
    ]

    per_intake: dict[str, dict[str, int]] = {}
    async for doc in usage_col.aggregate(pipeline):
        iid = doc["_id"]["intakeId"]
        metric = doc["_id"]["metricType"]
        if iid not in per_intake:
            per_intake[iid] = {
                "callSeconds": 0,
                "transcriptionSeconds": 0,
                "ocrPages": 0,
                "urlRefreshCount": 0,
            }
        if metric in per_intake[iid]:
            per_intake[iid][metric] = doc["total"]

    breakdown = [
        UsageResponse(
            intakeId=iid,
            usage=UsageRollup(
                callSeconds=metrics["callSeconds"],
                transcriptionSeconds=metrics["transcriptionSeconds"],
                ocrPages=metrics["ocrPages"],
                urlRefreshCount=metrics["urlRefreshCount"],
            ),
        )
        for iid, metrics in per_intake.items()
    ]

    return ResponseEnvelope(
        data=UsageReportResponse(
            accountId=account_id,
            dateRangeStart=start,
            dateRangeEnd=end,
            totalUsage=UsageRollup(
                callSeconds=totals["callSeconds"],
                transcriptionSeconds=totals["transcriptionSeconds"],
                ocrPages=totals["ocrPages"],
                urlRefreshCount=totals["urlRefreshCount"],
            ),
            perIntake=breakdown,
            generatedAt=datetime.now(timezone.utc),
        )
    )
