"""
Tenant middleware for multi-tenant data isolation.

Extracts org_id from:
1. Authenticated user's session (via identity API cookie)
2. X-Organization-Id header
3. org_id query parameter

Provides FastAPI dependencies for tenant-aware database access.
"""

from typing import Optional

from fastapi import Request, Query, Header
import httpx
import logging

from app.database import get_database

logger = logging.getLogger(__name__)

# Identity API endpoint for resolving user session
IDENTITY_API_URL = "https://identity-api.ai.devintensive.com/api/v1/auth/me"


async def _resolve_org_from_session(request: Request) -> Optional[str]:
    """Attempt to resolve org_id from the user's identity API session cookie."""
    cookies = request.cookies
    if not cookies:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                IDENTITY_API_URL,
                cookies=dict(cookies),
            )
            if response.status_code == 200:
                data = response.json()
                # The identity API may return org_id or organization_id
                return data.get("org_id") or data.get("organization_id")
    except Exception as e:
        logger.debug(f"Failed to resolve org from session: {e}")

    return None


async def get_current_org_id(
    request: Request,
    org_id: Optional[str] = Query(None, alias="org_id"),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
) -> Optional[str]:
    """
    FastAPI dependency that extracts the current organization ID.

    Resolution order:
    1. Identity API session cookie
    2. X-Organization-Id header
    3. org_id query parameter

    Returns None if no org_id can be determined (backward compatible).
    """
    # 1. Try session-based resolution
    session_org = await _resolve_org_from_session(request)
    if session_org:
        return session_org

    # 2. Try header
    if x_organization_id:
        return x_organization_id

    # 3. Try query param
    if org_id:
        return org_id

    return None


class TenantDatabase:
    """
    Wrapper around the MongoDB database that automatically applies
    org_id filters to queries for multi-tenant data isolation.

    Usage:
        tenant_db = TenantDatabase(db, org_id)
        results = await tenant_db.find("shipments", {"status": "active"})
        await tenant_db.insert_one("shipments", document)
    """

    def __init__(self, db, org_id: Optional[str]):
        self._db = db
        self._org_id = org_id

    @property
    def org_id(self) -> Optional[str]:
        return self._org_id

    @property
    def db(self):
        """Access the underlying database directly when needed."""
        return self._db

    def _add_org_filter(self, query: dict) -> dict:
        """Add org_id filter to a query if org_id is set."""
        if self._org_id is None:
            return query
        return {**query, "org_id": self._org_id}

    def _set_org_on_document(self, document: dict) -> dict:
        """Set org_id on a document before insertion."""
        if self._org_id is None:
            return document
        return {**document, "org_id": self._org_id}

    async def find(self, collection: str, query: dict = None, **kwargs):
        """Find documents with automatic org_id filtering."""
        query = self._add_org_filter(query or {})
        cursor = self._db[collection].find(query, **kwargs)
        return await cursor.to_list(length=None)

    async def find_one(self, collection: str, query: dict = None, **kwargs):
        """Find a single document with automatic org_id filtering."""
        query = self._add_org_filter(query or {})
        return await self._db[collection].find_one(query, **kwargs)

    async def insert_one(self, collection: str, document: dict, **kwargs):
        """Insert a document with automatic org_id stamping."""
        document = self._set_org_on_document(document)
        return await self._db[collection].insert_one(document, **kwargs)

    async def insert_many(self, collection: str, documents: list, **kwargs):
        """Insert multiple documents with automatic org_id stamping."""
        documents = [self._set_org_on_document(doc) for doc in documents]
        return await self._db[collection].insert_many(documents, **kwargs)

    async def update_one(self, collection: str, query: dict, update: dict, **kwargs):
        """Update a document with automatic org_id filtering."""
        query = self._add_org_filter(query)
        return await self._db[collection].update_one(query, update, **kwargs)

    async def update_many(self, collection: str, query: dict, update: dict, **kwargs):
        """Update multiple documents with automatic org_id filtering."""
        query = self._add_org_filter(query)
        return await self._db[collection].update_many(query, update, **kwargs)

    async def delete_one(self, collection: str, query: dict, **kwargs):
        """Delete a document with automatic org_id filtering."""
        query = self._add_org_filter(query)
        return await self._db[collection].delete_one(query, **kwargs)

    async def delete_many(self, collection: str, query: dict, **kwargs):
        """Delete multiple documents with automatic org_id filtering."""
        query = self._add_org_filter(query)
        return await self._db[collection].delete_many(query, **kwargs)

    async def count_documents(self, collection: str, query: dict = None, **kwargs):
        """Count documents with automatic org_id filtering."""
        query = self._add_org_filter(query or {})
        return await self._db[collection].count_documents(query, **kwargs)

    async def aggregate(self, collection: str, pipeline: list, **kwargs):
        """Run an aggregation pipeline with org_id match stage prepended."""
        if self._org_id is not None:
            pipeline = [{"$match": {"org_id": self._org_id}}, *pipeline]
        cursor = self._db[collection].aggregate(pipeline, **kwargs)
        return await cursor.to_list(length=None)


async def get_tenant_db(
    request: Request,
    org_id: Optional[str] = Query(None, alias="org_id"),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
) -> TenantDatabase:
    """
    FastAPI dependency that returns a TenantDatabase instance.

    The TenantDatabase wraps the standard MongoDB database and automatically
    applies org_id filters to all queries and stamps org_id on new documents.

    If no org_id is resolved, queries proceed without org filtering
    (backward compatible).
    """
    resolved_org_id = await get_current_org_id(
        request=request,
        org_id=org_id,
        x_organization_id=x_organization_id,
    )
    db = get_database()
    return TenantDatabase(db, resolved_org_id)
