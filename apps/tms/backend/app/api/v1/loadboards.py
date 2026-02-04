"""
Load Board API endpoints.

Provides endpoints for:
- Managing load board credentials
- Posting loads to DAT, Truckstop
- Searching for available carriers
- Fetching market rates
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from bson import ObjectId

from ...database import get_database
from ...models.loadboard import (
    LoadBoardProvider,
    LoadBoardPosting,
    LoadBoardSearch,
    LoadBoardCredentials,
    RateIndex,
    PostingStatus,
)
from ...services.loadboard_service import LoadBoardService


router = APIRouter()


# ==================== Request/Response Schemas ====================

class CredentialsCreate(BaseModel):
    """Schema for creating/updating load board credentials."""
    provider: LoadBoardProvider
    username: str
    password: Optional[str] = None
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    company_name: Optional[str] = None
    mc_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None


class CredentialsResponse(BaseModel):
    """Schema for credentials response (no sensitive data)."""
    id: str
    provider: str
    username: str
    is_active: bool
    last_connected_at: Optional[datetime] = None
    connection_error: Optional[str] = None
    company_name: Optional[str] = None
    mc_number: Optional[str] = None
    contact_name: Optional[str] = None


class PostingCreate(BaseModel):
    """Schema for creating a load board posting."""
    shipment_id: str
    providers: List[LoadBoardProvider]

    # Can override shipment data
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    origin_zip: Optional[str] = None
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_zip: Optional[str] = None

    equipment_type: Optional[str] = None
    weight_lbs: Optional[int] = None
    length_ft: Optional[int] = None
    commodity: Optional[str] = None

    pickup_date_start: Optional[datetime] = None
    pickup_date_end: Optional[datetime] = None
    delivery_date: Optional[datetime] = None

    posted_rate: Optional[int] = None
    rate_per_mile: Optional[float] = None
    rate_type: str = "flat"

    hazmat: bool = False
    team_required: bool = False
    tarps_required: bool = False
    twic_required: bool = False
    special_instructions: Optional[str] = None
    notes: Optional[str] = None


class PostingUpdate(BaseModel):
    """Schema for updating a posting."""
    posted_rate: Optional[int] = None
    rate_per_mile: Optional[float] = None
    pickup_date_start: Optional[datetime] = None
    pickup_date_end: Optional[datetime] = None
    special_instructions: Optional[str] = None
    notes: Optional[str] = None


class PostingResponse(BaseModel):
    """Schema for posting response."""
    id: str
    posting_number: str
    shipment_id: str
    status: str
    providers: List[str]
    provider_post_ids: dict

    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str
    equipment_type: str
    weight_lbs: Optional[int] = None

    pickup_date_start: Optional[datetime] = None
    pickup_date_end: Optional[datetime] = None
    delivery_date: Optional[datetime] = None

    posted_rate: Optional[int] = None
    rate_per_mile: Optional[float] = None
    rate_type: str

    posted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    view_count: int = 0
    call_count: int = 0
    bid_count: int = 0

    created_at: datetime


class CarrierSearchRequest(BaseModel):
    """Schema for carrier search."""
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    origin_radius_miles: int = 100
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    equipment_type: Optional[str] = None
    pickup_date: Optional[datetime] = None
    providers: Optional[List[LoadBoardProvider]] = None
    shipment_id: Optional[str] = None


class CarrierSearchResultResponse(BaseModel):
    """Schema for a single carrier search result."""
    provider: str
    provider_carrier_id: Optional[str] = None
    carrier_name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    equipment_types: List[str] = []
    rating: Optional[float] = None
    total_loads: Optional[int] = None
    on_time_percentage: Optional[float] = None
    days_to_pay: Optional[int] = None
    truck_count: Optional[int] = None
    deadhead_miles: Optional[int] = None


class CarrierSearchResponse(BaseModel):
    """Schema for carrier search response."""
    id: str
    result_count: int
    results: List[CarrierSearchResultResponse]
    searched_at: datetime


class RateIndexResponse(BaseModel):
    """Schema for market rate response."""
    provider: str
    origin: str
    destination: str
    equipment_type: str
    rate_per_mile_low: Optional[float] = None
    rate_per_mile_avg: Optional[float] = None
    rate_per_mile_high: Optional[float] = None
    flat_rate_low: Optional[int] = None
    flat_rate_avg: Optional[int] = None
    flat_rate_high: Optional[int] = None
    load_count: Optional[int] = None
    truck_count: Optional[int] = None
    date_range: str
    fetched_at: datetime


# ==================== Credentials Endpoints ====================

@router.get("/credentials", response_model=List[CredentialsResponse])
async def list_credentials():
    """List all configured load board credentials."""
    db = await get_database()
    cursor = db.loadboard_credentials.find({})
    credentials = []
    async for doc in cursor:
        credentials.append(CredentialsResponse(
            id=str(doc["_id"]),
            provider=doc["provider"],
            username=doc["username"],
            is_active=doc.get("is_active", False),
            last_connected_at=doc.get("last_connected_at"),
            connection_error=doc.get("connection_error"),
            company_name=doc.get("company_name"),
            mc_number=doc.get("mc_number"),
            contact_name=doc.get("contact_name"),
        ))
    return credentials


@router.post("/credentials", response_model=CredentialsResponse)
async def save_credentials(data: CredentialsCreate):
    """Save or update load board credentials."""
    db = await get_database()
    service = LoadBoardService(db)

    # In production, encrypt the password/API key
    creds = LoadBoardCredentials(
        provider=data.provider,
        username=data.username,
        encrypted_password=data.password,  # Would be encrypted
        api_key=data.api_key,
        client_id=data.client_id,
        client_secret=data.client_secret,
        company_name=data.company_name,
        mc_number=data.mc_number,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
    )

    saved = await service.save_credentials(creds)

    return CredentialsResponse(
        id=str(saved.id),
        provider=saved.provider.value,
        username=saved.username,
        is_active=saved.is_active,
        last_connected_at=saved.last_connected_at,
        connection_error=saved.connection_error,
        company_name=saved.company_name,
        mc_number=saved.mc_number,
        contact_name=saved.contact_name,
    )


@router.post("/credentials/{provider}/test")
async def test_credentials(provider: LoadBoardProvider):
    """Test connection to a load board provider."""
    db = await get_database()
    service = LoadBoardService(db)

    result = await service.test_connection(provider)
    return result


@router.delete("/credentials/{provider}")
async def delete_credentials(provider: LoadBoardProvider):
    """Delete credentials for a load board provider."""
    db = await get_database()
    result = await db.loadboard_credentials.delete_one({"provider": provider.value})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Credentials not found")

    return {"message": f"Credentials for {provider.value} deleted"}


# ==================== Posting Endpoints ====================

@router.get("/postings", response_model=List[PostingResponse])
async def list_postings(
    status: Optional[PostingStatus] = None,
    shipment_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List load board postings."""
    db = await get_database()

    query = {}
    if status:
        query["status"] = status.value
    if shipment_id:
        query["shipment_id"] = ObjectId(shipment_id)

    cursor = db.loadboard_postings.find(query).skip(skip).limit(limit).sort("created_at", -1)

    postings = []
    async for doc in cursor:
        postings.append(PostingResponse(
            id=str(doc["_id"]),
            posting_number=doc["posting_number"],
            shipment_id=str(doc["shipment_id"]),
            status=doc["status"],
            providers=doc.get("providers", []),
            provider_post_ids=doc.get("provider_post_ids", {}),
            origin_city=doc["origin_city"],
            origin_state=doc["origin_state"],
            destination_city=doc["destination_city"],
            destination_state=doc["destination_state"],
            equipment_type=doc.get("equipment_type", "van"),
            weight_lbs=doc.get("weight_lbs"),
            pickup_date_start=doc.get("pickup_date_start"),
            pickup_date_end=doc.get("pickup_date_end"),
            delivery_date=doc.get("delivery_date"),
            posted_rate=doc.get("posted_rate"),
            rate_per_mile=doc.get("rate_per_mile"),
            rate_type=doc.get("rate_type", "flat"),
            posted_at=doc.get("posted_at"),
            expires_at=doc.get("expires_at"),
            view_count=doc.get("view_count", 0),
            call_count=doc.get("call_count", 0),
            bid_count=doc.get("bid_count", 0),
            created_at=doc["created_at"],
        ))

    return postings


@router.post("/postings", response_model=PostingResponse)
async def create_posting(data: PostingCreate, background_tasks: BackgroundTasks):
    """Create and post a load to load boards."""
    db = await get_database()
    service = LoadBoardService(db)

    # Get shipment to populate defaults
    shipment = await db.shipments.find_one({"_id": ObjectId(data.shipment_id)})
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Get next posting number
    count = await db.loadboard_postings.count_documents({})
    posting_number = f"LBP-{datetime.utcnow().year}-{count + 1:05d}"

    # Extract origin/destination from shipment stops
    origin_city = data.origin_city
    origin_state = data.origin_state
    dest_city = data.destination_city
    dest_state = data.destination_state

    stops = shipment.get("stops", [])
    if stops and not origin_city:
        origin_city = stops[0].get("city", "")
        origin_state = stops[0].get("state", "")
    if stops and len(stops) > 1 and not dest_city:
        dest_city = stops[-1].get("city", "")
        dest_state = stops[-1].get("state", "")

    posting = LoadBoardPosting(
        posting_number=posting_number,
        shipment_id=ObjectId(data.shipment_id),
        status=PostingStatus.DRAFT,
        origin_city=origin_city or "",
        origin_state=origin_state or "",
        origin_zip=data.origin_zip,
        destination_city=dest_city or "",
        destination_state=dest_state or "",
        destination_zip=data.destination_zip,
        equipment_type=data.equipment_type or shipment.get("equipment_type", "van"),
        weight_lbs=data.weight_lbs or shipment.get("weight_lbs"),
        length_ft=data.length_ft,
        commodity=data.commodity or shipment.get("commodity"),
        pickup_date_start=data.pickup_date_start or shipment.get("pickup_date"),
        pickup_date_end=data.pickup_date_end,
        delivery_date=data.delivery_date or shipment.get("delivery_date"),
        posted_rate=data.posted_rate,
        rate_per_mile=data.rate_per_mile,
        rate_type=data.rate_type,
        hazmat=data.hazmat,
        team_required=data.team_required,
        tarps_required=data.tarps_required,
        twic_required=data.twic_required,
        special_instructions=data.special_instructions,
        notes=data.notes,
    )

    # Post to load boards
    result = await service.post_load(posting, data.providers)

    return PostingResponse(
        id=str(result.id),
        posting_number=result.posting_number,
        shipment_id=str(result.shipment_id),
        status=result.status.value,
        providers=[p.value for p in result.providers],
        provider_post_ids=result.provider_post_ids,
        origin_city=result.origin_city,
        origin_state=result.origin_state,
        destination_city=result.destination_city,
        destination_state=result.destination_state,
        equipment_type=result.equipment_type,
        weight_lbs=result.weight_lbs,
        pickup_date_start=result.pickup_date_start,
        pickup_date_end=result.pickup_date_end,
        delivery_date=result.delivery_date,
        posted_rate=result.posted_rate,
        rate_per_mile=result.rate_per_mile,
        rate_type=result.rate_type,
        posted_at=result.posted_at,
        expires_at=result.expires_at,
        view_count=result.view_count,
        call_count=result.call_count,
        bid_count=result.bid_count,
        created_at=result.created_at,
    )


@router.get("/postings/{posting_id}", response_model=PostingResponse)
async def get_posting(posting_id: str):
    """Get a specific posting."""
    db = await get_database()
    service = LoadBoardService(db)

    posting = await service.get_posting(posting_id)
    if not posting:
        raise HTTPException(status_code=404, detail="Posting not found")

    return PostingResponse(
        id=str(posting.id),
        posting_number=posting.posting_number,
        shipment_id=str(posting.shipment_id),
        status=posting.status.value,
        providers=[p.value for p in posting.providers],
        provider_post_ids=posting.provider_post_ids,
        origin_city=posting.origin_city,
        origin_state=posting.origin_state,
        destination_city=posting.destination_city,
        destination_state=posting.destination_state,
        equipment_type=posting.equipment_type,
        weight_lbs=posting.weight_lbs,
        pickup_date_start=posting.pickup_date_start,
        pickup_date_end=posting.pickup_date_end,
        delivery_date=posting.delivery_date,
        posted_rate=posting.posted_rate,
        rate_per_mile=posting.rate_per_mile,
        rate_type=posting.rate_type,
        posted_at=posting.posted_at,
        expires_at=posting.expires_at,
        view_count=posting.view_count,
        call_count=posting.call_count,
        bid_count=posting.bid_count,
        created_at=posting.created_at,
    )


@router.patch("/postings/{posting_id}", response_model=PostingResponse)
async def update_posting(posting_id: str, data: PostingUpdate):
    """Update a posting on all load boards."""
    db = await get_database()
    service = LoadBoardService(db)

    updates = data.model_dump(exclude_unset=True)
    posting = await service.update_posting(posting_id, updates)

    if not posting:
        raise HTTPException(status_code=404, detail="Posting not found")

    return PostingResponse(
        id=str(posting.id),
        posting_number=posting.posting_number,
        shipment_id=str(posting.shipment_id),
        status=posting.status.value,
        providers=[p.value for p in posting.providers],
        provider_post_ids=posting.provider_post_ids,
        origin_city=posting.origin_city,
        origin_state=posting.origin_state,
        destination_city=posting.destination_city,
        destination_state=posting.destination_state,
        equipment_type=posting.equipment_type,
        weight_lbs=posting.weight_lbs,
        pickup_date_start=posting.pickup_date_start,
        pickup_date_end=posting.pickup_date_end,
        delivery_date=posting.delivery_date,
        posted_rate=posting.posted_rate,
        rate_per_mile=posting.rate_per_mile,
        rate_type=posting.rate_type,
        posted_at=posting.posted_at,
        expires_at=posting.expires_at,
        view_count=posting.view_count,
        call_count=posting.call_count,
        bid_count=posting.bid_count,
        created_at=posting.created_at,
    )


@router.post("/postings/{posting_id}/cancel")
async def cancel_posting(posting_id: str):
    """Cancel a posting and remove from all load boards."""
    db = await get_database()
    service = LoadBoardService(db)

    success = await service.cancel_posting(posting_id)
    if not success:
        raise HTTPException(status_code=404, detail="Posting not found")

    return {"message": "Posting cancelled"}


@router.get("/postings/stats/summary")
async def get_posting_stats():
    """Get load board posting statistics."""
    db = await get_database()
    service = LoadBoardService(db)

    stats = await service.get_posting_stats()
    return stats


# ==================== Carrier Search Endpoints ====================

@router.post("/search/carriers", response_model=CarrierSearchResponse)
async def search_carriers(data: CarrierSearchRequest):
    """Search for available carriers across load boards."""
    db = await get_database()
    service = LoadBoardService(db)

    search = await service.search_carriers(
        origin_city=data.origin_city,
        origin_state=data.origin_state,
        origin_radius_miles=data.origin_radius_miles,
        destination_city=data.destination_city,
        destination_state=data.destination_state,
        equipment_type=data.equipment_type,
        pickup_date=data.pickup_date,
        providers=data.providers,
        shipment_id=data.shipment_id,
    )

    results = [
        CarrierSearchResultResponse(
            provider=r.provider.value,
            provider_carrier_id=r.provider_carrier_id,
            carrier_name=r.carrier_name,
            mc_number=r.mc_number,
            dot_number=r.dot_number,
            contact_name=r.contact_name,
            contact_phone=r.contact_phone,
            contact_email=r.contact_email,
            city=r.city,
            state=r.state,
            equipment_types=r.equipment_types,
            rating=r.rating,
            total_loads=r.total_loads,
            on_time_percentage=r.on_time_percentage,
            days_to_pay=r.days_to_pay,
            truck_count=r.truck_count,
            deadhead_miles=r.deadhead_miles,
        )
        for r in search.results
    ]

    return CarrierSearchResponse(
        id=str(search.id),
        result_count=search.result_count,
        results=results,
        searched_at=search.searched_at,
    )


# ==================== Market Rates Endpoints ====================

@router.get("/rates", response_model=List[RateIndexResponse])
async def get_market_rates(
    origin_city: str,
    origin_state: str,
    destination_city: str,
    destination_state: str,
    equipment_type: str = "van",
):
    """Get market rate data for a lane."""
    db = await get_database()
    service = LoadBoardService(db)

    rates = await service.get_market_rates(
        origin_city=origin_city,
        origin_state=origin_state,
        destination_city=destination_city,
        destination_state=destination_state,
        equipment_type=equipment_type,
    )

    return [
        RateIndexResponse(
            provider=r.provider.value,
            origin=f"{r.origin_city}, {r.origin_state}",
            destination=f"{r.destination_city}, {r.destination_state}",
            equipment_type=r.equipment_type,
            rate_per_mile_low=r.rate_per_mile_low,
            rate_per_mile_avg=r.rate_per_mile_avg,
            rate_per_mile_high=r.rate_per_mile_high,
            flat_rate_low=r.flat_rate_low,
            flat_rate_avg=r.flat_rate_avg,
            flat_rate_high=r.flat_rate_high,
            load_count=r.load_count,
            truck_count=r.truck_count,
            date_range=f"{r.date_from.strftime('%Y-%m-%d')} to {r.date_to.strftime('%Y-%m-%d')}",
            fetched_at=r.fetched_at,
        )
        for r in rates
    ]


@router.get("/rates/history")
async def get_rate_history(
    origin_city: str,
    origin_state: str,
    destination_city: str,
    destination_state: str,
    equipment_type: str = "van",
    days: int = Query(30, ge=7, le=365),
):
    """Get historical rate data for a lane."""
    db = await get_database()
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(days=days)

    cursor = db.loadboard_rate_indexes.find({
        "origin_city": origin_city,
        "origin_state": origin_state,
        "destination_city": destination_city,
        "destination_state": destination_state,
        "equipment_type": equipment_type,
        "fetched_at": {"$gte": cutoff}
    }).sort("fetched_at", 1)

    history = []
    async for doc in cursor:
        history.append({
            "provider": doc["provider"],
            "date": doc["fetched_at"].strftime("%Y-%m-%d"),
            "rate_per_mile_avg": doc.get("rate_per_mile_avg"),
            "flat_rate_avg": doc.get("flat_rate_avg"),
            "load_count": doc.get("load_count"),
            "truck_count": doc.get("truck_count"),
        })

    return history
