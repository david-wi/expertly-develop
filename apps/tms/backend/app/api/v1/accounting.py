"""
Accounting Integration API endpoints.

Provides endpoints for:
- QuickBooks OAuth flow
- Sync operations
- Connection management
- Mapping management
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from bson import ObjectId

from ...database import get_database
from ...models.accounting import (
    AccountingProvider,
    AccountingConnection,
    EntityMapping,
    SyncJob,
    SyncStatus,
    EntityType,
)
from ...services.quickbooks_service import QuickBooksService


router = APIRouter()


# ==================== Request/Response Schemas ====================

class ConnectionResponse(BaseModel):
    """Response for connection status."""
    provider: str
    is_connected: bool
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    connected_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    connection_error: Optional[str] = None

    # Sync settings
    auto_sync_enabled: bool = False
    sync_interval_minutes: int = 60
    sync_customers: bool = True
    sync_invoices: bool = True
    sync_payments: bool = True
    sync_vendors: bool = True
    sync_bills: bool = False

    # Account mappings
    revenue_account_id: Optional[str] = None
    revenue_account_name: Optional[str] = None
    expense_account_id: Optional[str] = None
    expense_account_name: Optional[str] = None


class ConnectionSettingsUpdate(BaseModel):
    """Request to update connection settings."""
    auto_sync_enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None
    sync_customers: Optional[bool] = None
    sync_invoices: Optional[bool] = None
    sync_payments: Optional[bool] = None
    sync_vendors: Optional[bool] = None
    sync_bills: Optional[bool] = None
    revenue_account_id: Optional[str] = None
    revenue_account_name: Optional[str] = None
    expense_account_id: Optional[str] = None
    expense_account_name: Optional[str] = None
    ar_account_id: Optional[str] = None
    ap_account_id: Optional[str] = None
    tax_code_id: Optional[str] = None
    tax_rate_percent: Optional[float] = None


class AuthorizationUrlResponse(BaseModel):
    """Response with authorization URL."""
    url: str
    state: str


class MappingResponse(BaseModel):
    """Response for entity mapping."""
    id: str
    entity_type: str
    tms_entity_id: str
    tms_entity_name: Optional[str] = None
    provider_entity_id: str
    provider_entity_name: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    sync_error: Optional[str] = None


class SyncJobResponse(BaseModel):
    """Response for sync job."""
    id: str
    status: str
    direction: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    triggered_by: str
    entity_types: List[str]
    full_sync: bool
    total_records: int
    synced_count: int
    failed_count: int
    skipped_count: int
    error_message: Optional[str] = None
    created_at: datetime


class SyncLogEntryResponse(BaseModel):
    """Response for sync log entry."""
    entity_type: str
    tms_entity_id: Optional[str] = None
    provider_entity_id: Optional[str] = None
    operation: str
    status: str
    error_message: Optional[str] = None
    timestamp: datetime


class SyncRequest(BaseModel):
    """Request to trigger sync."""
    full_sync: bool = False
    entity_types: Optional[List[str]] = None


class SyncEntityRequest(BaseModel):
    """Request to sync a single entity."""
    entity_type: str
    entity_id: str


# ==================== OAuth Endpoints ====================

@router.get("/connect/quickbooks")
async def get_quickbooks_auth_url() -> AuthorizationUrlResponse:
    """Get QuickBooks authorization URL to start OAuth flow."""
    db = await get_database()
    service = QuickBooksService(db)

    import uuid
    state = str(uuid.uuid4())

    # In production, store state in session/cache for verification
    url = service.get_authorization_url(state)

    return AuthorizationUrlResponse(url=url, state=state)


@router.get("/callback")
async def oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    realmId: Optional[str] = None,
    error: Optional[str] = None,
):
    """Handle OAuth callback from QuickBooks."""
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    if not code or not realmId:
        raise HTTPException(status_code=400, detail="Missing code or realmId")

    # In production, verify state matches what we stored

    db = await get_database()
    service = QuickBooksService(db)

    try:
        connection = await service.exchange_code_for_tokens(code, realmId)
        return {
            "status": "connected",
            "company_id": connection.company_id,
            "company_name": connection.company_name,
            "redirect_url": "/settings?tab=accounting"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/disconnect")
async def disconnect_quickbooks():
    """Disconnect from QuickBooks."""
    db = await get_database()
    service = QuickBooksService(db)

    success = await service.disconnect()
    if not success:
        raise HTTPException(status_code=400, detail="Not connected to QuickBooks")

    return {"status": "disconnected"}


# ==================== Connection Management ====================

@router.get("/connection", response_model=ConnectionResponse)
async def get_connection():
    """Get current QuickBooks connection status."""
    db = await get_database()
    service = QuickBooksService(db)

    connection = await service.get_connection()
    if not connection:
        return ConnectionResponse(
            provider="quickbooks",
            is_connected=False,
        )

    return ConnectionResponse(
        provider=connection.provider.value,
        is_connected=connection.is_connected,
        company_id=connection.company_id,
        company_name=connection.company_name,
        connected_at=connection.connected_at,
        last_sync_at=connection.last_sync_at,
        connection_error=connection.connection_error,
        auto_sync_enabled=connection.auto_sync_enabled,
        sync_interval_minutes=connection.sync_interval_minutes,
        sync_customers=connection.sync_customers,
        sync_invoices=connection.sync_invoices,
        sync_payments=connection.sync_payments,
        sync_vendors=connection.sync_vendors,
        sync_bills=connection.sync_bills,
        revenue_account_id=connection.revenue_account_id,
        revenue_account_name=connection.revenue_account_name,
        expense_account_id=connection.expense_account_id,
        expense_account_name=connection.expense_account_name,
    )


@router.patch("/connection", response_model=ConnectionResponse)
async def update_connection_settings(data: ConnectionSettingsUpdate):
    """Update QuickBooks connection settings."""
    db = await get_database()
    service = QuickBooksService(db)

    settings = data.model_dump(exclude_unset=True)
    connection = await service.update_connection_settings(settings)

    return ConnectionResponse(
        provider=connection.provider.value,
        is_connected=connection.is_connected,
        company_id=connection.company_id,
        company_name=connection.company_name,
        connected_at=connection.connected_at,
        last_sync_at=connection.last_sync_at,
        connection_error=connection.connection_error,
        auto_sync_enabled=connection.auto_sync_enabled,
        sync_interval_minutes=connection.sync_interval_minutes,
        sync_customers=connection.sync_customers,
        sync_invoices=connection.sync_invoices,
        sync_payments=connection.sync_payments,
        sync_vendors=connection.sync_vendors,
        sync_bills=connection.sync_bills,
        revenue_account_id=connection.revenue_account_id,
        revenue_account_name=connection.revenue_account_name,
        expense_account_id=connection.expense_account_id,
        expense_account_name=connection.expense_account_name,
    )


# ==================== Sync Operations ====================

@router.post("/sync", response_model=SyncJobResponse)
async def trigger_sync(
    data: SyncRequest,
    background_tasks: BackgroundTasks
):
    """Trigger a sync operation."""
    db = await get_database()
    service = QuickBooksService(db)

    connection = await service.get_connection()
    if not connection or not connection.is_connected:
        raise HTTPException(status_code=400, detail="QuickBooks not connected")

    try:
        job = await service.sync_all(
            full_sync=data.full_sync,
            triggered_by="manual"
        )

        return SyncJobResponse(
            id=str(job.id),
            status=job.status.value,
            direction=job.direction.value,
            started_at=job.started_at,
            completed_at=job.completed_at,
            triggered_by=job.triggered_by,
            entity_types=[et.value for et in job.entity_types],
            full_sync=job.full_sync,
            total_records=job.total_records,
            synced_count=job.synced_count,
            failed_count=job.failed_count,
            skipped_count=job.skipped_count,
            error_message=job.error_message,
            created_at=job.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/entity", response_model=SyncLogEntryResponse)
async def sync_single_entity(data: SyncEntityRequest):
    """Sync a single entity to QuickBooks."""
    db = await get_database()
    service = QuickBooksService(db)

    try:
        entity_type = EntityType(data.entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {data.entity_type}")

    try:
        entry = await service.sync_entity(entity_type, data.entity_id)
        return SyncLogEntryResponse(
            entity_type=entry.entity_type.value,
            tms_entity_id=entry.tms_entity_id,
            provider_entity_id=entry.provider_entity_id,
            operation=entry.operation,
            status=entry.status.value,
            error_message=entry.error_message,
            timestamp=entry.timestamp,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync/jobs", response_model=List[SyncJobResponse])
async def list_sync_jobs(
    status: Optional[SyncStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """List sync job history."""
    db = await get_database()
    service = QuickBooksService(db)

    jobs = await service.get_sync_jobs(status=status, skip=skip, limit=limit)

    return [
        SyncJobResponse(
            id=str(job.id),
            status=job.status.value,
            direction=job.direction.value,
            started_at=job.started_at,
            completed_at=job.completed_at,
            triggered_by=job.triggered_by,
            entity_types=[et.value for et in job.entity_types],
            full_sync=job.full_sync,
            total_records=job.total_records,
            synced_count=job.synced_count,
            failed_count=job.failed_count,
            skipped_count=job.skipped_count,
            error_message=job.error_message,
            created_at=job.created_at,
        )
        for job in jobs
    ]


@router.get("/sync/jobs/{job_id}", response_model=SyncJobResponse)
async def get_sync_job(job_id: str):
    """Get details of a sync job."""
    db = await get_database()
    service = QuickBooksService(db)

    job = await service.get_sync_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Sync job not found")

    return SyncJobResponse(
        id=str(job.id),
        status=job.status.value,
        direction=job.direction.value,
        started_at=job.started_at,
        completed_at=job.completed_at,
        triggered_by=job.triggered_by,
        entity_types=[et.value for et in job.entity_types],
        full_sync=job.full_sync,
        total_records=job.total_records,
        synced_count=job.synced_count,
        failed_count=job.failed_count,
        skipped_count=job.skipped_count,
        error_message=job.error_message,
        created_at=job.created_at,
    )


@router.get("/sync/jobs/{job_id}/logs", response_model=List[SyncLogEntryResponse])
async def get_sync_job_logs(job_id: str):
    """Get logs for a sync job."""
    db = await get_database()
    service = QuickBooksService(db)

    job = await service.get_sync_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Sync job not found")

    return [
        SyncLogEntryResponse(
            entity_type=entry.entity_type.value,
            tms_entity_id=entry.tms_entity_id,
            provider_entity_id=entry.provider_entity_id,
            operation=entry.operation,
            status=entry.status.value,
            error_message=entry.error_message,
            timestamp=entry.timestamp,
        )
        for entry in job.log_entries
    ]


# ==================== Entity Mappings ====================

@router.get("/mappings", response_model=List[MappingResponse])
async def list_mappings(
    entity_type: Optional[EntityType] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List entity mappings."""
    db = await get_database()
    service = QuickBooksService(db)

    mappings = await service.get_mappings(
        entity_type=entity_type,
        skip=skip,
        limit=limit
    )

    return [
        MappingResponse(
            id=str(mapping.id),
            entity_type=mapping.entity_type.value,
            tms_entity_id=str(mapping.tms_entity_id),
            tms_entity_name=mapping.tms_entity_name,
            provider_entity_id=mapping.provider_entity_id,
            provider_entity_name=mapping.provider_entity_name,
            last_synced_at=mapping.last_synced_at,
            sync_error=mapping.sync_error,
        )
        for mapping in mappings
    ]


@router.delete("/mappings/{mapping_id}")
async def delete_mapping(mapping_id: str):
    """Delete an entity mapping (useful for re-syncing)."""
    db = await get_database()

    result = await db.accounting_mappings.delete_one({"_id": ObjectId(mapping_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mapping not found")

    return {"status": "deleted"}


# ==================== Stats ====================

@router.get("/stats")
async def get_accounting_stats():
    """Get accounting sync statistics."""
    db = await get_database()

    # Count mappings by type
    mapping_pipeline = [
        {"$match": {"provider": "quickbooks"}},
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}}
    ]
    mapping_counts = {}
    async for doc in db.accounting_mappings.aggregate(mapping_pipeline):
        mapping_counts[doc["_id"]] = doc["count"]

    # Get recent sync jobs
    recent_jobs = await db.accounting_sync_jobs.find(
        {"provider": "quickbooks"}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Count jobs by status
    job_pipeline = [
        {"$match": {"provider": "quickbooks"}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    job_counts = {}
    async for doc in db.accounting_sync_jobs.aggregate(job_pipeline):
        job_counts[doc["_id"]] = doc["count"]

    return {
        "mappings": mapping_counts,
        "sync_jobs": job_counts,
        "recent_syncs": [
            {
                "id": str(job["_id"]),
                "status": job.get("status"),
                "synced_count": job.get("synced_count", 0),
                "failed_count": job.get("failed_count", 0),
                "created_at": job.get("created_at"),
            }
            for job in recent_jobs
        ]
    }
