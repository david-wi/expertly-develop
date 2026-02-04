"""
Load Board Integration Service.

Provides unified interface to DAT, Truckstop, and other load board APIs.
Handles posting loads, searching for carriers, and fetching market rates.
"""

import httpx
from datetime import datetime, timedelta
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..models.loadboard import (
    LoadBoardProvider,
    LoadBoardPosting,
    LoadBoardSearch,
    LoadBoardSearchResult,
    LoadBoardCredentials,
    RateIndex,
    PostingStatus,
)


class LoadBoardService:
    """
    Unified service for load board operations.

    Supports:
    - DAT Power/One
    - Truckstop.com
    - (Future: LoadLink, Direct Freight)
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._credentials_cache: dict[LoadBoardProvider, LoadBoardCredentials] = {}

    async def get_credentials(self, provider: LoadBoardProvider) -> Optional[LoadBoardCredentials]:
        """Get stored credentials for a provider."""
        if provider in self._credentials_cache:
            return self._credentials_cache[provider]

        creds_doc = await self.db.loadboard_credentials.find_one({
            "provider": provider.value,
            "is_active": True
        })
        if creds_doc:
            creds = LoadBoardCredentials(**creds_doc)
            self._credentials_cache[provider] = creds
            return creds
        return None

    async def save_credentials(self, credentials: LoadBoardCredentials) -> LoadBoardCredentials:
        """Save or update credentials for a provider."""
        existing = await self.db.loadboard_credentials.find_one({
            "provider": credentials.provider.value
        })
        if existing:
            await self.db.loadboard_credentials.update_one(
                {"_id": existing["_id"]},
                {"$set": credentials.model_dump(exclude={"id", "created_at"})}
            )
            credentials.id = existing["_id"]
        else:
            result = await self.db.loadboard_credentials.insert_one(
                credentials.model_dump(by_alias=True)
            )
            credentials.id = result.inserted_id

        # Clear cache
        if credentials.provider in self._credentials_cache:
            del self._credentials_cache[credentials.provider]

        return credentials

    async def test_connection(self, provider: LoadBoardProvider) -> dict:
        """Test connection to a load board provider."""
        creds = await self.get_credentials(provider)
        if not creds:
            return {"success": False, "error": "No credentials configured"}

        try:
            if provider == LoadBoardProvider.DAT:
                return await self._test_dat_connection(creds)
            elif provider == LoadBoardProvider.TRUCKSTOP:
                return await self._test_truckstop_connection(creds)
            else:
                return {"success": False, "error": f"Provider {provider} not supported"}
        except Exception as e:
            # Update credentials with error
            await self.db.loadboard_credentials.update_one(
                {"_id": creds.id},
                {"$set": {"connection_error": str(e)}}
            )
            return {"success": False, "error": str(e)}

    async def _test_dat_connection(self, creds: LoadBoardCredentials) -> dict:
        """Test DAT API connection."""
        # DAT uses OAuth2 for authentication
        # In production, this would use the actual DAT API
        # https://developer.dat.com/

        # Mock successful connection for development
        await self.db.loadboard_credentials.update_one(
            {"_id": creds.id},
            {"$set": {
                "last_connected_at": datetime.utcnow(),
                "connection_error": None
            }}
        )
        return {
            "success": True,
            "provider": "dat",
            "message": "Connected to DAT Power API"
        }

    async def _test_truckstop_connection(self, creds: LoadBoardCredentials) -> dict:
        """Test Truckstop API connection."""
        # Truckstop uses API key authentication
        # https://developer.truckstop.com/

        # Mock successful connection for development
        await self.db.loadboard_credentials.update_one(
            {"_id": creds.id},
            {"$set": {
                "last_connected_at": datetime.utcnow(),
                "connection_error": None
            }}
        )
        return {
            "success": True,
            "provider": "truckstop",
            "message": "Connected to Truckstop API"
        }

    # ==================== Load Posting ====================

    async def post_load(
        self,
        posting: LoadBoardPosting,
        providers: List[LoadBoardProvider]
    ) -> LoadBoardPosting:
        """
        Post a load to one or more load boards.

        Returns updated posting with provider post IDs.
        """
        posting.providers = providers
        posting.provider_post_ids = {}
        errors = []

        for provider in providers:
            try:
                if provider == LoadBoardProvider.DAT:
                    post_id = await self._post_to_dat(posting)
                elif provider == LoadBoardProvider.TRUCKSTOP:
                    post_id = await self._post_to_truckstop(posting)
                else:
                    continue

                if post_id:
                    posting.provider_post_ids[provider.value] = post_id

            except Exception as e:
                errors.append(f"{provider.value}: {str(e)}")

        if posting.provider_post_ids:
            posting.status = PostingStatus.POSTED
            posting.posted_at = datetime.utcnow()
            posting.expires_at = datetime.utcnow() + timedelta(days=7)

        # Save to database
        if posting.id:
            await self.db.loadboard_postings.update_one(
                {"_id": posting.id},
                {"$set": posting.model_dump(exclude={"id", "created_at"})}
            )
        else:
            result = await self.db.loadboard_postings.insert_one(
                posting.model_dump(by_alias=True)
            )
            posting.id = result.inserted_id

        return posting

    async def _post_to_dat(self, posting: LoadBoardPosting) -> Optional[str]:
        """Post load to DAT."""
        creds = await self.get_credentials(LoadBoardProvider.DAT)
        if not creds:
            raise ValueError("DAT credentials not configured")

        # In production, this would call the DAT Power API
        # POST https://freight.dat.com/posting/v2/posts
        #
        # {
        #     "origin": {"city": "Chicago", "state": "IL"},
        #     "destination": {"city": "Dallas", "state": "TX"},
        #     "equipment": {"type": "VAN"},
        #     "pickup": {"date": "2024-01-15"},
        #     "weight": 40000,
        #     "rate": {"amount": 2500, "type": "FLAT"}
        # }

        # Mock response - generate a fake post ID
        import uuid
        post_id = f"DAT-{uuid.uuid4().hex[:8].upper()}"
        return post_id

    async def _post_to_truckstop(self, posting: LoadBoardPosting) -> Optional[str]:
        """Post load to Truckstop."""
        creds = await self.get_credentials(LoadBoardProvider.TRUCKSTOP)
        if not creds:
            raise ValueError("Truckstop credentials not configured")

        # In production, this would call the Truckstop API
        # POST https://api.truckstop.com/v3/posting

        # Mock response
        import uuid
        post_id = f"TS-{uuid.uuid4().hex[:8].upper()}"
        return post_id

    async def update_posting(
        self,
        posting_id: str,
        updates: dict
    ) -> Optional[LoadBoardPosting]:
        """Update an existing posting on all load boards."""
        from bson import ObjectId

        posting_doc = await self.db.loadboard_postings.find_one({"_id": ObjectId(posting_id)})
        if not posting_doc:
            return None

        posting = LoadBoardPosting(**posting_doc)

        # Update on each provider
        for provider_str, post_id in posting.provider_post_ids.items():
            provider = LoadBoardProvider(provider_str)
            try:
                if provider == LoadBoardProvider.DAT:
                    await self._update_dat_posting(post_id, updates)
                elif provider == LoadBoardProvider.TRUCKSTOP:
                    await self._update_truckstop_posting(post_id, updates)
            except Exception:
                pass  # Log but continue

        # Update local record
        await self.db.loadboard_postings.update_one(
            {"_id": posting.id},
            {"$set": {**updates, "updated_at": datetime.utcnow()}}
        )

        return await self.get_posting(posting_id)

    async def _update_dat_posting(self, post_id: str, updates: dict) -> None:
        """Update posting on DAT."""
        # PUT https://freight.dat.com/posting/v2/posts/{postId}
        pass

    async def _update_truckstop_posting(self, post_id: str, updates: dict) -> None:
        """Update posting on Truckstop."""
        # PUT https://api.truckstop.com/v3/posting/{postId}
        pass

    async def cancel_posting(self, posting_id: str) -> bool:
        """Cancel/remove a posting from all load boards."""
        from bson import ObjectId

        posting_doc = await self.db.loadboard_postings.find_one({"_id": ObjectId(posting_id)})
        if not posting_doc:
            return False

        posting = LoadBoardPosting(**posting_doc)

        # Remove from each provider
        for provider_str, post_id in posting.provider_post_ids.items():
            provider = LoadBoardProvider(provider_str)
            try:
                if provider == LoadBoardProvider.DAT:
                    await self._delete_dat_posting(post_id)
                elif provider == LoadBoardProvider.TRUCKSTOP:
                    await self._delete_truckstop_posting(post_id)
            except Exception:
                pass

        # Update local record
        await self.db.loadboard_postings.update_one(
            {"_id": posting.id},
            {"$set": {
                "status": PostingStatus.CANCELLED.value,
                "updated_at": datetime.utcnow()
            }}
        )

        return True

    async def _delete_dat_posting(self, post_id: str) -> None:
        """Delete posting from DAT."""
        # DELETE https://freight.dat.com/posting/v2/posts/{postId}
        pass

    async def _delete_truckstop_posting(self, post_id: str) -> None:
        """Delete posting from Truckstop."""
        # DELETE https://api.truckstop.com/v3/posting/{postId}
        pass

    async def get_posting(self, posting_id: str) -> Optional[LoadBoardPosting]:
        """Get a posting by ID."""
        from bson import ObjectId
        doc = await self.db.loadboard_postings.find_one({"_id": ObjectId(posting_id)})
        if doc:
            return LoadBoardPosting(**doc)
        return None

    async def get_postings_for_shipment(self, shipment_id: str) -> List[LoadBoardPosting]:
        """Get all postings for a shipment."""
        from bson import ObjectId
        cursor = self.db.loadboard_postings.find({"shipment_id": ObjectId(shipment_id)})
        postings = []
        async for doc in cursor:
            postings.append(LoadBoardPosting(**doc))
        return postings

    # ==================== Carrier Search ====================

    async def search_carriers(
        self,
        origin_city: Optional[str] = None,
        origin_state: Optional[str] = None,
        origin_radius_miles: int = 100,
        destination_city: Optional[str] = None,
        destination_state: Optional[str] = None,
        equipment_type: Optional[str] = None,
        pickup_date: Optional[datetime] = None,
        providers: Optional[List[LoadBoardProvider]] = None,
        shipment_id: Optional[str] = None,
    ) -> LoadBoardSearch:
        """
        Search for available carriers across load boards.

        Returns aggregated results from all providers.
        """
        from bson import ObjectId

        if providers is None:
            providers = [LoadBoardProvider.DAT, LoadBoardProvider.TRUCKSTOP]

        search = LoadBoardSearch(
            origin_city=origin_city,
            origin_state=origin_state,
            origin_radius_miles=origin_radius_miles,
            destination_city=destination_city,
            destination_state=destination_state,
            equipment_type=equipment_type,
            pickup_date_start=pickup_date,
            providers=providers,
            shipment_id=ObjectId(shipment_id) if shipment_id else None,
        )

        results: List[LoadBoardSearchResult] = []

        for provider in providers:
            try:
                if provider == LoadBoardProvider.DAT:
                    provider_results = await self._search_dat_carriers(search)
                elif provider == LoadBoardProvider.TRUCKSTOP:
                    provider_results = await self._search_truckstop_carriers(search)
                else:
                    continue

                results.extend(provider_results)

            except Exception as e:
                # Log error but continue with other providers
                print(f"Error searching {provider}: {e}")

        search.results = results
        search.result_count = len(results)
        search.searched_at = datetime.utcnow()

        # Save search
        result = await self.db.loadboard_searches.insert_one(
            search.model_dump(by_alias=True)
        )
        search.id = result.inserted_id

        return search

    async def _search_dat_carriers(self, search: LoadBoardSearch) -> List[LoadBoardSearchResult]:
        """Search for carriers on DAT."""
        creds = await self.get_credentials(LoadBoardProvider.DAT)
        if not creds:
            return []

        # In production, this would call DAT's truck search API
        # GET https://freight.dat.com/search/v3/trucks

        # Mock results for development
        mock_results = [
            LoadBoardSearchResult(
                provider=LoadBoardProvider.DAT,
                provider_carrier_id="DAT-C-001",
                carrier_name="Swift Transportation",
                mc_number="MC-123456",
                dot_number="DOT-789012",
                contact_name="John Dispatch",
                contact_phone="555-123-4567",
                contact_email="dispatch@swift.com",
                city=search.origin_city or "Chicago",
                state=search.origin_state or "IL",
                equipment_types=["van", "reefer"],
                rating=4.5,
                total_loads=1250,
                on_time_percentage=94.2,
                days_to_pay=21,
                truck_count=3,
                deadhead_miles=25,
            ),
            LoadBoardSearchResult(
                provider=LoadBoardProvider.DAT,
                provider_carrier_id="DAT-C-002",
                carrier_name="Midwest Express Trucking",
                mc_number="MC-234567",
                contact_name="Maria Transport",
                contact_phone="555-234-5678",
                city=search.origin_city or "Chicago",
                state=search.origin_state or "IL",
                equipment_types=["van"],
                rating=4.2,
                total_loads=580,
                on_time_percentage=91.5,
                days_to_pay=30,
                truck_count=1,
                deadhead_miles=45,
            ),
        ]

        return mock_results

    async def _search_truckstop_carriers(self, search: LoadBoardSearch) -> List[LoadBoardSearchResult]:
        """Search for carriers on Truckstop."""
        creds = await self.get_credentials(LoadBoardProvider.TRUCKSTOP)
        if not creds:
            return []

        # In production, this would call Truckstop's search API
        # GET https://api.truckstop.com/v3/trucks/search

        # Mock results
        mock_results = [
            LoadBoardSearchResult(
                provider=LoadBoardProvider.TRUCKSTOP,
                provider_carrier_id="TS-C-001",
                carrier_name="Reliable Freight Inc",
                mc_number="MC-345678",
                dot_number="DOT-901234",
                contact_name="Bob Logistics",
                contact_phone="555-345-6789",
                contact_email="bob@reliablefreight.com",
                city=search.origin_city or "Chicago",
                state=search.origin_state or "IL",
                equipment_types=["van", "flatbed"],
                rating=4.8,
                total_loads=2100,
                on_time_percentage=96.8,
                days_to_pay=15,
                truck_count=2,
                deadhead_miles=15,
            ),
        ]

        return mock_results

    # ==================== Market Rates ====================

    async def get_market_rates(
        self,
        origin_city: str,
        origin_state: str,
        destination_city: str,
        destination_state: str,
        equipment_type: str = "van",
        providers: Optional[List[LoadBoardProvider]] = None,
    ) -> List[RateIndex]:
        """
        Get market rate data for a lane from load boards.

        Used for pricing guidance and benchmarking.
        """
        if providers is None:
            providers = [LoadBoardProvider.DAT, LoadBoardProvider.TRUCKSTOP]

        rates: List[RateIndex] = []

        for provider in providers:
            try:
                if provider == LoadBoardProvider.DAT:
                    rate = await self._get_dat_rates(
                        origin_city, origin_state,
                        destination_city, destination_state,
                        equipment_type
                    )
                elif provider == LoadBoardProvider.TRUCKSTOP:
                    rate = await self._get_truckstop_rates(
                        origin_city, origin_state,
                        destination_city, destination_state,
                        equipment_type
                    )
                else:
                    continue

                if rate:
                    rates.append(rate)

                    # Save rate index for historical tracking
                    await self.db.loadboard_rate_indexes.insert_one(
                        rate.model_dump(by_alias=True)
                    )

            except Exception as e:
                print(f"Error fetching rates from {provider}: {e}")

        return rates

    async def _get_dat_rates(
        self,
        origin_city: str, origin_state: str,
        destination_city: str, destination_state: str,
        equipment_type: str
    ) -> Optional[RateIndex]:
        """Get market rates from DAT RateView."""
        creds = await self.get_credentials(LoadBoardProvider.DAT)
        if not creds:
            return None

        # In production, this would call DAT RateView API
        # GET https://freight.dat.com/rateview/v1/rates

        # Mock rate data
        now = datetime.utcnow()
        return RateIndex(
            provider=LoadBoardProvider.DAT,
            origin_city=origin_city,
            origin_state=origin_state,
            destination_city=destination_city,
            destination_state=destination_state,
            equipment_type=equipment_type,
            rate_per_mile_low=2.15,
            rate_per_mile_avg=2.45,
            rate_per_mile_high=2.85,
            flat_rate_low=150000,  # $1500
            flat_rate_avg=175000,  # $1750
            flat_rate_high=205000,  # $2050
            load_count=45,
            truck_count=28,
            date_from=now - timedelta(days=7),
            date_to=now,
            fetched_at=now,
        )

    async def _get_truckstop_rates(
        self,
        origin_city: str, origin_state: str,
        destination_city: str, destination_state: str,
        equipment_type: str
    ) -> Optional[RateIndex]:
        """Get market rates from Truckstop."""
        creds = await self.get_credentials(LoadBoardProvider.TRUCKSTOP)
        if not creds:
            return None

        # In production, this would call Truckstop's rate API

        # Mock rate data
        now = datetime.utcnow()
        return RateIndex(
            provider=LoadBoardProvider.TRUCKSTOP,
            origin_city=origin_city,
            origin_state=origin_state,
            destination_city=destination_city,
            destination_state=destination_state,
            equipment_type=equipment_type,
            rate_per_mile_low=2.10,
            rate_per_mile_avg=2.40,
            rate_per_mile_high=2.80,
            flat_rate_low=145000,
            flat_rate_avg=170000,
            flat_rate_high=200000,
            load_count=38,
            truck_count=22,
            date_from=now - timedelta(days=7),
            date_to=now,
            fetched_at=now,
        )

    # ==================== Helpers ====================

    async def get_active_postings(
        self,
        status: Optional[PostingStatus] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[LoadBoardPosting]:
        """Get active load board postings."""
        query = {}
        if status:
            query["status"] = status.value
        else:
            query["status"] = {"$in": [PostingStatus.DRAFT.value, PostingStatus.POSTED.value]}

        cursor = self.db.loadboard_postings.find(query).skip(skip).limit(limit).sort("created_at", -1)
        postings = []
        async for doc in cursor:
            postings.append(LoadBoardPosting(**doc))
        return postings

    async def get_posting_stats(self) -> dict:
        """Get load board posting statistics."""
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]

        stats = {"draft": 0, "posted": 0, "booked": 0, "expired": 0, "cancelled": 0}
        async for doc in self.db.loadboard_postings.aggregate(pipeline):
            stats[doc["_id"]] = doc["count"]

        # Get provider breakdown
        provider_pipeline = [
            {"$match": {"status": "posted"}},
            {"$unwind": "$providers"},
            {"$group": {
                "_id": "$providers",
                "count": {"$sum": 1}
            }}
        ]
        stats["by_provider"] = {}
        async for doc in self.db.loadboard_postings.aggregate(provider_pipeline):
            stats["by_provider"][doc["_id"]] = doc["count"]

        return stats
