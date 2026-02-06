"""Role-Based Access Control models."""

from datetime import datetime
from typing import Optional, List

from pydantic import Field

from .base import MongoModel, PyObjectId, utc_now


# All available permissions in the system, grouped by resource
SYSTEM_PERMISSIONS = {
    "shipments": [
        "shipments.view",
        "shipments.create",
        "shipments.edit",
        "shipments.delete",
        "shipments.transition",
        "shipments.assign_carrier",
    ],
    "quotes": [
        "quotes.view",
        "quotes.create",
        "quotes.edit",
        "quotes.send",
        "quotes.approve",
        "quotes.decline",
    ],
    "carriers": [
        "carriers.view",
        "carriers.create",
        "carriers.edit",
        "carriers.delete",
        "carriers.manage_compliance",
    ],
    "customers": [
        "customers.view",
        "customers.create",
        "customers.edit",
        "customers.delete",
        "customers.manage_contacts",
    ],
    "invoices": [
        "invoices.view",
        "invoices.create",
        "invoices.edit",
        "invoices.send",
        "invoices.mark_paid",
        "invoices.void",
    ],
    "billing": [
        "billing.view",
        "billing.create_bills",
        "billing.match_bills",
        "billing.approve_bills",
        "billing.generate_invoices",
    ],
    "communications": [
        "communications.view",
        "communications.send_sms",
        "communications.send_voice",
        "communications.manage_templates",
        "communications.bulk_send",
    ],
    "documents": [
        "documents.view",
        "documents.upload",
        "documents.delete",
        "documents.verify",
    ],
    "analytics": [
        "analytics.view_margins",
        "analytics.view_performance",
        "analytics.view_operations",
        "analytics.view_lanes",
    ],
    "admin": [
        "admin.manage_roles",
        "admin.manage_users",
        "admin.manage_desks",
        "admin.manage_automations",
        "admin.manage_settings",
        "admin.view_audit_log",
    ],
}

# Flatten all permissions for validation
ALL_PERMISSIONS = []
for perms in SYSTEM_PERMISSIONS.values():
    ALL_PERMISSIONS.extend(perms)


class Role(MongoModel):
    """A role that groups permissions together."""

    name: str
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    is_system_role: bool = False  # System roles cannot be deleted
    is_active: bool = True


# Default system roles
DEFAULT_ROLES = [
    {
        "name": "Admin",
        "description": "Full system access. Can manage roles, users, and all settings.",
        "permissions": ALL_PERMISSIONS,
        "is_system_role": True,
    },
    {
        "name": "Dispatcher",
        "description": "Manage shipments, carriers, and dispatching operations.",
        "permissions": [
            "shipments.view", "shipments.create", "shipments.edit", "shipments.transition", "shipments.assign_carrier",
            "carriers.view", "carriers.edit",
            "quotes.view",
            "communications.view", "communications.send_sms", "communications.send_voice",
            "documents.view", "documents.upload",
            "analytics.view_operations",
        ],
        "is_system_role": True,
    },
    {
        "name": "Sales",
        "description": "Manage quotes, customers, and sales activities.",
        "permissions": [
            "quotes.view", "quotes.create", "quotes.edit", "quotes.send",
            "customers.view", "customers.create", "customers.edit", "customers.manage_contacts",
            "shipments.view",
            "invoices.view",
            "communications.view", "communications.send_sms",
            "analytics.view_margins", "analytics.view_lanes",
        ],
        "is_system_role": True,
    },
    {
        "name": "Billing Clerk",
        "description": "Manage invoices, carrier bills, and billing operations.",
        "permissions": [
            "invoices.view", "invoices.create", "invoices.edit", "invoices.send", "invoices.mark_paid",
            "billing.view", "billing.create_bills", "billing.match_bills", "billing.approve_bills", "billing.generate_invoices",
            "shipments.view",
            "customers.view",
            "carriers.view",
            "analytics.view_margins",
        ],
        "is_system_role": True,
    },
    {
        "name": "Viewer",
        "description": "Read-only access to all data.",
        "permissions": [
            "shipments.view",
            "quotes.view",
            "carriers.view",
            "customers.view",
            "invoices.view",
            "billing.view",
            "communications.view",
            "documents.view",
            "analytics.view_margins", "analytics.view_performance", "analytics.view_operations", "analytics.view_lanes",
        ],
        "is_system_role": True,
    },
]


class UserRole(MongoModel):
    """Assignment of a role to a user."""

    user_id: str  # Identity service user ID
    role_id: PyObjectId
    assigned_by: Optional[str] = None
    assigned_at: datetime = Field(default_factory=utc_now)

    # Enriched fields (not stored, populated on read)
    role_name: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
