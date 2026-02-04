"""
Load Board Integration Model - Track load postings to DAT, Truckstop, and other load boards.

Manages load board postings, search results, and carrier responses.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId


class LoadBoardProvider(str, Enum):
    """Supported load board providers."""
    DAT = "dat"
    TRUCKSTOP = "truckstop"
    LOADLINK = "loadlink"
    DIRECT_FREIGHT = "direct_freight"


class PostingStatus(str, Enum):
    """Status of a load board posting."""
    DRAFT = "draft"
    POSTED = "posted"
    BOOKED = "booked"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class LoadBoardCredentials(MongoModel):
    """
    Stored credentials for load board APIs.
    Encrypted at rest via application-level encryption.
    """
    provider: LoadBoardProvider
    username: str
    # Note: In production, use proper secrets management (e.g., AWS Secrets Manager)
    encrypted_password: Optional[str] = None
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None

    # Status
    is_active: bool = True
    last_connected_at: Optional[datetime] = None
    connection_error: Optional[str] = None

    # Company info for the load board
    company_name: Optional[str] = None
    mc_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    class Config:
        collection = "loadboard_credentials"


class LoadBoardPosting(MongoModel):
    """
    A load posting on one or more load boards.

    Links to a shipment that needs a carrier.
    """
    # Reference
    posting_number: str  # e.g., "LBP-2024-00001"
    shipment_id: PyObjectId

    # Status
    status: PostingStatus = PostingStatus.DRAFT

    # Where posted
    providers: List[LoadBoardProvider] = Field(default_factory=list)
    provider_post_ids: dict = Field(default_factory=dict)  # {"dat": "123456", "truckstop": "789"}

    # Load details (copied from shipment for posting)
    origin_city: str
    origin_state: str
    origin_zip: Optional[str] = None
    destination_city: str
    destination_state: str
    destination_zip: Optional[str] = None

    # Equipment & load
    equipment_type: str = "van"
    weight_lbs: Optional[int] = None
    length_ft: Optional[int] = None  # For flatbed/step deck
    commodity: Optional[str] = None

    # Dates
    pickup_date_start: Optional[datetime] = None
    pickup_date_end: Optional[datetime] = None
    delivery_date: Optional[datetime] = None

    # Pricing
    rate_type: str = "flat"  # "flat", "per_mile", "all_in"
    posted_rate: Optional[int] = None  # Cents
    rate_per_mile: Optional[float] = None
    estimated_miles: Optional[int] = None

    # Special requirements
    hazmat: bool = False
    team_required: bool = False
    tarps_required: bool = False
    twic_required: bool = False
    special_instructions: Optional[str] = None

    # Posting info
    posted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    booked_at: Optional[datetime] = None
    booked_carrier_id: Optional[PyObjectId] = None

    # Stats
    view_count: int = 0
    call_count: int = 0
    bid_count: int = 0

    # Notes
    notes: Optional[str] = None

    class Config:
        collection = "loadboard_postings"


class CarrierBid(BaseModel):
    """A carrier's bid/response to a load posting."""
    carrier_name: str
    mc_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    bid_amount: int  # Cents
    notes: Optional[str] = None

    # From load board
    provider: LoadBoardProvider
    provider_carrier_id: Optional[str] = None

    # Carrier rating from load board
    rating: Optional[float] = None
    total_loads: Optional[int] = None
    days_to_pay: Optional[int] = None

    received_at: datetime = Field(default_factory=datetime.utcnow)


class LoadBoardSearchResult(BaseModel):
    """A carrier search result from a load board."""
    provider: LoadBoardProvider
    provider_carrier_id: Optional[str] = None

    # Carrier info
    carrier_name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    # Location
    city: Optional[str] = None
    state: Optional[str] = None

    # Equipment
    equipment_types: List[str] = Field(default_factory=list)
    available_date: Optional[datetime] = None

    # Rating/performance from load board
    rating: Optional[float] = None
    total_loads: Optional[int] = None
    on_time_percentage: Optional[float] = None
    days_to_pay: Optional[int] = None

    # Availability
    truck_count: Optional[int] = None
    deadhead_miles: Optional[int] = None


class LoadBoardSearch(MongoModel):
    """
    A saved search for available trucks/carriers.

    Used to find carriers for a specific lane.
    """
    # Search criteria
    origin_city: Optional[str] = None
    origin_state: Optional[str] = None
    origin_radius_miles: int = 100
    destination_city: Optional[str] = None
    destination_state: Optional[str] = None
    destination_radius_miles: int = 100

    equipment_type: Optional[str] = None
    pickup_date_start: Optional[datetime] = None
    pickup_date_end: Optional[datetime] = None

    # Search on which providers
    providers: List[LoadBoardProvider] = Field(default_factory=list)

    # Results
    results: List[LoadBoardSearchResult] = Field(default_factory=list)
    result_count: int = 0
    searched_at: Optional[datetime] = None

    # Link to shipment if searching for a specific load
    shipment_id: Optional[PyObjectId] = None

    class Config:
        collection = "loadboard_searches"


class RateIndex(MongoModel):
    """
    Market rate data from load boards.

    Used for pricing guidance and market intelligence.
    """
    provider: LoadBoardProvider

    # Lane
    origin_city: str
    origin_state: str
    destination_city: str
    destination_state: str

    equipment_type: str

    # Rate data
    rate_per_mile_low: Optional[float] = None
    rate_per_mile_avg: Optional[float] = None
    rate_per_mile_high: Optional[float] = None

    flat_rate_low: Optional[int] = None  # Cents
    flat_rate_avg: Optional[int] = None
    flat_rate_high: Optional[int] = None

    # Volume
    load_count: Optional[int] = None
    truck_count: Optional[int] = None

    # Date range
    date_from: datetime
    date_to: datetime
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        collection = "loadboard_rate_indexes"
