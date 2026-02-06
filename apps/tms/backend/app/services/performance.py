"""
Performance utilities for Expertly TMS.

Provides MongoDB index definitions for all collections and a function
to ensure indexes are created on startup.
"""

import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Index definitions per collection
# ---------------------------------------------------------------------------

INDEXES: dict[str, list[IndexModel]] = {
    # ── Shipments ──────────────────────────────────────────────────────────
    "shipments": [
        # Status queries (most common filter)
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        # Customer lookup
        IndexModel([("customer_id", ASCENDING), ("status", ASCENDING)], name="customer_status"),
        # Carrier lookup
        IndexModel([("carrier_id", ASCENDING), ("status", ASCENDING)], name="carrier_status"),
        # At-risk shipments
        IndexModel([("at_risk", ASCENDING), ("status", ASCENDING)], name="at_risk_status"),
        # Date range queries (dispatch board, deliveries)
        IndexModel([("pickup_date", ASCENDING)], name="pickup_date"),
        IndexModel([("delivery_date", ASCENDING)], name="delivery_date"),
        # Shipment number (unique lookups)
        IndexModel([("shipment_number", ASCENDING)], name="shipment_number", unique=True, sparse=True),
        # Text search
        IndexModel(
            [
                ("shipment_number", TEXT),
                ("origin_city", TEXT),
                ("origin_state", TEXT),
                ("destination_city", TEXT),
                ("destination_state", TEXT),
                ("commodity", TEXT),
            ],
            name="shipments_text",
            weights={
                "shipment_number": 10,
                "origin_city": 5,
                "destination_city": 5,
                "origin_state": 3,
                "destination_state": 3,
                "commodity": 2,
            },
        ),
        # Updated timestamp for sync/change detection
        IndexModel([("updated_at", DESCENDING)], name="updated_at"),
    ],

    # ── Customers ──────────────────────────────────────────────────────────
    "customers": [
        IndexModel([("status", ASCENDING)], name="status"),
        IndexModel([("code", ASCENDING)], name="code", unique=True, sparse=True),
        IndexModel(
            [("name", TEXT), ("code", TEXT), ("billing_email", TEXT)],
            name="customers_text",
            weights={"name": 10, "code": 5, "billing_email": 3},
        ),
        IndexModel([("created_at", DESCENDING)], name="created_at"),
    ],

    # ── Carriers ───────────────────────────────────────────────────────────
    "carriers": [
        IndexModel([("status", ASCENDING)], name="status"),
        IndexModel([("mc_number", ASCENDING)], name="mc_number", sparse=True),
        IndexModel([("dot_number", ASCENDING)], name="dot_number", sparse=True),
        IndexModel([("equipment_types", ASCENDING)], name="equipment_types"),
        IndexModel([("insurance_expiration", ASCENDING)], name="insurance_expiration"),
        IndexModel(
            [
                ("name", TEXT),
                ("mc_number", TEXT),
                ("dot_number", TEXT),
                ("contact_name", TEXT),
                ("contact_email", TEXT),
            ],
            name="carriers_text",
            weights={
                "name": 10,
                "mc_number": 8,
                "dot_number": 8,
                "contact_name": 3,
                "contact_email": 3,
            },
        ),
        IndexModel([("created_at", DESCENDING)], name="created_at"),
    ],

    # ── Quotes ─────────────────────────────────────────────────────────────
    "quotes": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("customer_id", ASCENDING), ("status", ASCENDING)], name="customer_status"),
        IndexModel([("quote_number", ASCENDING)], name="quote_number", unique=True, sparse=True),
        IndexModel([("valid_until", ASCENDING)], name="valid_until"),
        IndexModel(
            [("quote_number", TEXT), ("origin_city", TEXT), ("destination_city", TEXT)],
            name="quotes_text",
            weights={"quote_number": 10, "origin_city": 5, "destination_city": 5},
        ),
    ],

    # ── Quote Requests ─────────────────────────────────────────────────────
    "quote_requests": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("customer_id", ASCENDING)], name="customer_id", sparse=True),
        IndexModel([("source_email", ASCENDING)], name="source_email", sparse=True),
        IndexModel([("received_at", DESCENDING)], name="received_at"),
    ],

    # ── Invoices ───────────────────────────────────────────────────────────
    "invoices": [
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
        IndexModel([("customer_id", ASCENDING), ("status", ASCENDING)], name="customer_status"),
        IndexModel([("shipment_id", ASCENDING)], name="shipment_id", sparse=True),
        IndexModel([("invoice_number", ASCENDING)], name="invoice_number", unique=True, sparse=True),
        IndexModel([("due_date", ASCENDING)], name="due_date"),
        IndexModel(
            [("invoice_number", TEXT)],
            name="invoices_text",
        ),
    ],

    # ── Tenders ────────────────────────────────────────────────────────────
    "tenders": [
        IndexModel([("shipment_id", ASCENDING), ("status", ASCENDING)], name="shipment_status"),
        IndexModel([("carrier_id", ASCENDING), ("status", ASCENDING)], name="carrier_status"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
    ],

    # ── Tracking Events ────────────────────────────────────────────────────
    "tracking_events": [
        IndexModel([("shipment_id", ASCENDING), ("timestamp", DESCENDING)], name="shipment_time"),
        IndexModel([("event_type", ASCENDING)], name="event_type"),
    ],

    # ── Documents ──────────────────────────────────────────────────────────
    "documents": [
        IndexModel([("shipment_id", ASCENDING)], name="shipment_id", sparse=True),
        IndexModel([("carrier_id", ASCENDING)], name="carrier_id", sparse=True),
        IndexModel([("customer_id", ASCENDING)], name="customer_id", sparse=True),
        IndexModel([("document_type", ASCENDING)], name="document_type"),
        IndexModel([("needs_review", ASCENDING)], name="needs_review"),
    ],

    # ── Work Items ─────────────────────────────────────────────────────────
    "work_items": [
        IndexModel([("status", ASCENDING), ("priority", DESCENDING), ("created_at", ASCENDING)], name="status_priority_created"),
        IndexModel([("work_type", ASCENDING), ("status", ASCENDING)], name="type_status"),
        IndexModel([("assigned_to", ASCENDING), ("status", ASCENDING)], name="assigned_status"),
        IndexModel([("desk_id", ASCENDING), ("status", ASCENDING)], name="desk_status"),
        IndexModel([("due_date", ASCENDING)], name="due_date"),
    ],

    # ── Facilities ─────────────────────────────────────────────────────────
    "facilities": [
        IndexModel([("customer_id", ASCENDING)], name="customer_id", sparse=True),
        IndexModel(
            [("name", TEXT), ("city", TEXT), ("state", TEXT)],
            name="facilities_text",
            weights={"name": 10, "city": 5, "state": 3},
        ),
    ],

    # ── Geofences ──────────────────────────────────────────────────────────
    "geofences": [
        IndexModel([("shipment_id", ASCENDING)], name="shipment_id", sparse=True),
        IndexModel([("facility_id", ASCENDING)], name="facility_id", sparse=True),
        IndexModel([("is_active", ASCENDING)], name="is_active"),
    ],

    # ── Emails ─────────────────────────────────────────────────────────────
    "emails": [
        IndexModel([("direction", ASCENDING), ("received_at", DESCENDING)], name="direction_received"),
        IndexModel([("category", ASCENDING)], name="category"),
        IndexModel([("shipment_id", ASCENDING)], name="shipment_id", sparse=True),
        IndexModel([("is_read", ASCENDING)], name="is_read"),
        IndexModel([("needs_review", ASCENDING)], name="needs_review"),
        IndexModel(
            [("subject", TEXT), ("body_text", TEXT), ("from_email", TEXT)],
            name="emails_text",
            weights={"subject": 10, "from_email": 5, "body_text": 1},
        ),
    ],

    # ── Carrier Onboarding ─────────────────────────────────────────────────
    "carrier_onboarding": [
        IndexModel([("status", ASCENDING)], name="status"),
        IndexModel([("carrier_id", ASCENDING)], name="carrier_id", sparse=True),
        IndexModel([("token", ASCENDING)], name="token", unique=True),
    ],

    # ── Accounting Mappings ────────────────────────────────────────────────
    "accounting_mappings": [
        IndexModel([("entity_type", ASCENDING), ("entity_id", ASCENDING)], name="entity_lookup"),
    ],

    # ── EDI Messages ───────────────────────────────────────────────────────
    "edi_messages": [
        IndexModel([("message_type", ASCENDING), ("status", ASCENDING)], name="type_status"),
        IndexModel([("trading_partner_id", ASCENDING)], name="trading_partner"),
        IndexModel([("direction", ASCENDING), ("created_at", DESCENDING)], name="direction_created"),
    ],

    # ── Rate Tables ────────────────────────────────────────────────────────
    "rate_tables": [
        IndexModel([("customer_id", ASCENDING)], name="customer_id", sparse=True),
        IndexModel([("effective_date", ASCENDING), ("expiration_date", ASCENDING)], name="date_range"),
    ],

    # ── Notifications ──────────────────────────────────────────────────────
    "notifications": [
        IndexModel([("user_id", ASCENDING), ("is_read", ASCENDING), ("created_at", DESCENDING)], name="user_read_created"),
    ],

    # ── Desks ──────────────────────────────────────────────────────────────
    "desks": [
        IndexModel([("is_active", ASCENDING)], name="is_active"),
    ],

    # ── Automations ────────────────────────────────────────────────────────
    "automations": [
        IndexModel([("trigger", ASCENDING), ("enabled", ASCENDING)], name="trigger_enabled"),
    ],

    # ── Carrier Bills ──────────────────────────────────────────────────────
    "carrier_bills": [
        IndexModel([("carrier_id", ASCENDING), ("status", ASCENDING)], name="carrier_status"),
        IndexModel([("shipment_id", ASCENDING)], name="shipment_id", sparse=True),
    ],
}


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """
    Create or update all MongoDB indexes for every collection.

    This is idempotent: existing identical indexes are skipped by MongoDB.
    Should be called once during application startup.
    """
    total_created = 0
    for collection_name, index_models in INDEXES.items():
        try:
            collection = db[collection_name]
            result = await collection.create_indexes(index_models)
            total_created += len(result)
            logger.info(
                "Ensured %d indexes on '%s': %s",
                len(result),
                collection_name,
                result,
            )
        except Exception as exc:
            # Log but don't crash the app -- indexes are a performance
            # optimisation, not a correctness requirement.
            logger.warning(
                "Failed to create indexes on '%s': %s",
                collection_name,
                exc,
            )

    logger.info("Index setup complete. %d indexes ensured across %d collections.", total_created, len(INDEXES))
