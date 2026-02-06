"""
Tenant-aware base model for multi-tenant data isolation.

Extends MongoModel with org_id field and provides helper functions
for adding tenant filters to queries and stamping tenant on new documents.
"""

from typing import Optional

from pydantic import Field

from app.models.base import MongoModel


class TenantModel(MongoModel):
    """
    Base model for tenant-scoped MongoDB documents.

    All models that should be isolated per-organization should extend
    TenantModel instead of MongoModel. The org_id field links the
    document to a specific organization.

    When org_id is None, the document is considered global/unscoped
    (backward compatible with pre-multi-tenant data).
    """

    org_id: Optional[str] = Field(
        default=None,
        description="Organization ID for multi-tenant isolation",
    )


def add_tenant_filter(query: dict, org_id: Optional[str]) -> dict:
    """
    Add org_id to a MongoDB query dict for tenant filtering.

    If org_id is None, the query is returned unchanged (no filtering).
    This maintains backward compatibility with existing single-tenant data.

    Args:
        query: The original MongoDB query dict.
        org_id: The organization ID to filter by, or None for no filtering.

    Returns:
        A new dict with the org_id filter added (if applicable).

    Example:
        >>> add_tenant_filter({"status": "active"}, "org123")
        {"status": "active", "org_id": "org123"}

        >>> add_tenant_filter({"status": "active"}, None)
        {"status": "active"}
    """
    if org_id is None:
        return query
    return {**query, "org_id": org_id}


def set_tenant_on_create(data: dict, org_id: Optional[str]) -> dict:
    """
    Set org_id on a document dict before insertion.

    If org_id is None, the data is returned unchanged.

    Args:
        data: The document dict to be inserted.
        org_id: The organization ID to stamp, or None.

    Returns:
        A new dict with org_id set (if applicable).

    Example:
        >>> set_tenant_on_create({"name": "Shipment 1"}, "org123")
        {"name": "Shipment 1", "org_id": "org123"}

        >>> set_tenant_on_create({"name": "Shipment 1"}, None)
        {"name": "Shipment 1"}
    """
    if org_id is None:
        return data
    return {**data, "org_id": org_id}
