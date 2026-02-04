"""
Accounting Integration Model - Track QuickBooks Online integration and sync status.

Manages OAuth tokens, entity mappings, and sync history.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId


class AccountingProvider(str, Enum):
    """Supported accounting providers."""
    QUICKBOOKS = "quickbooks"
    XERO = "xero"  # Future support
    SAGE = "sage"  # Future support


class SyncStatus(str, Enum):
    """Status of a sync operation."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class SyncDirection(str, Enum):
    """Direction of sync."""
    TO_ACCOUNTING = "to_accounting"  # TMS -> QuickBooks
    FROM_ACCOUNTING = "from_accounting"  # QuickBooks -> TMS
    BIDIRECTIONAL = "bidirectional"


class EntityType(str, Enum):
    """Types of entities that can be synced."""
    CUSTOMER = "customer"
    INVOICE = "invoice"
    PAYMENT = "payment"
    VENDOR = "vendor"  # Carriers mapped to vendors
    BILL = "bill"  # Carrier invoices


class AccountingConnection(MongoModel):
    """
    OAuth connection to an accounting provider.

    Stores tokens and connection status.
    """
    provider: AccountingProvider = AccountingProvider.QUICKBOOKS

    # OAuth tokens
    access_token: Optional[str] = None  # Encrypted in production
    refresh_token: Optional[str] = None  # Encrypted in production
    token_expires_at: Optional[datetime] = None

    # Company info from provider
    company_id: Optional[str] = None  # QuickBooks realm ID
    company_name: Optional[str] = None

    # Connection status
    is_connected: bool = False
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

    # Chart of accounts mappings
    revenue_account_id: Optional[str] = None
    revenue_account_name: Optional[str] = None
    expense_account_id: Optional[str] = None
    expense_account_name: Optional[str] = None
    ar_account_id: Optional[str] = None  # Accounts Receivable
    ap_account_id: Optional[str] = None  # Accounts Payable

    # Default tax settings
    tax_code_id: Optional[str] = None
    tax_rate_percent: Optional[float] = None

    class Config:
        collection = "accounting_connections"


class EntityMapping(MongoModel):
    """
    Mapping between TMS entity and accounting provider entity.

    Links customers, invoices, etc. between systems.
    """
    provider: AccountingProvider = AccountingProvider.QUICKBOOKS
    entity_type: EntityType

    # TMS reference
    tms_entity_id: PyObjectId
    tms_entity_name: Optional[str] = None  # For display

    # Accounting provider reference
    provider_entity_id: str
    provider_entity_name: Optional[str] = None

    # Sync metadata
    last_synced_at: Optional[datetime] = None
    sync_error: Optional[str] = None

    class Config:
        collection = "accounting_mappings"


class SyncLogEntry(BaseModel):
    """A single sync operation entry."""
    entity_type: EntityType
    tms_entity_id: Optional[str] = None
    provider_entity_id: Optional[str] = None
    operation: str  # "create", "update", "delete"
    status: SyncStatus
    error_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SyncJob(MongoModel):
    """
    Record of a sync job execution.

    Tracks overall sync operations and their results.
    """
    provider: AccountingProvider = AccountingProvider.QUICKBOOKS
    direction: SyncDirection = SyncDirection.TO_ACCOUNTING

    # Job info
    status: SyncStatus = SyncStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    triggered_by: str = "manual"  # "manual", "scheduled", "webhook"

    # Scope
    entity_types: List[EntityType] = Field(default_factory=list)
    full_sync: bool = False  # If true, sync all records; otherwise incremental

    # Results
    total_records: int = 0
    synced_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0

    # Detailed log
    log_entries: List[SyncLogEntry] = Field(default_factory=list)

    # Error handling
    error_message: Optional[str] = None
    retry_count: int = 0

    class Config:
        collection = "accounting_sync_jobs"


class QuickBooksCustomer(BaseModel):
    """QuickBooks customer representation for sync."""
    id: Optional[str] = None
    display_name: str
    company_name: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    billing_address_line1: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_postal_code: Optional[str] = None
    billing_country: str = "US"
    notes: Optional[str] = None
    active: bool = True
    balance: Optional[float] = None
    sync_token: Optional[str] = None  # QBO version token


class QuickBooksInvoice(BaseModel):
    """QuickBooks invoice representation for sync."""
    id: Optional[str] = None
    doc_number: str  # Invoice number
    customer_ref_id: str  # QBO customer ID
    customer_ref_name: Optional[str] = None
    txn_date: str  # Invoice date YYYY-MM-DD
    due_date: Optional[str] = None
    line_items: List[dict] = Field(default_factory=list)
    total_amount: float
    balance: Optional[float] = None
    email_status: Optional[str] = None
    private_note: Optional[str] = None
    sync_token: Optional[str] = None


class QuickBooksPayment(BaseModel):
    """QuickBooks payment representation for sync."""
    id: Optional[str] = None
    customer_ref_id: str
    total_amount: float
    txn_date: str  # Payment date
    payment_method: Optional[str] = None
    payment_ref_num: Optional[str] = None  # Check number, etc.
    linked_txns: List[dict] = Field(default_factory=list)  # Linked invoices
    sync_token: Optional[str] = None


class QuickBooksVendor(BaseModel):
    """QuickBooks vendor representation for carriers."""
    id: Optional[str] = None
    display_name: str
    company_name: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    billing_address_line1: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_postal_code: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True
    balance: Optional[float] = None
    sync_token: Optional[str] = None


class QuickBooksBill(BaseModel):
    """QuickBooks bill representation for carrier invoices."""
    id: Optional[str] = None
    vendor_ref_id: str
    doc_number: Optional[str] = None
    txn_date: str
    due_date: Optional[str] = None
    line_items: List[dict] = Field(default_factory=list)
    total_amount: float
    balance: Optional[float] = None
    private_note: Optional[str] = None
    sync_token: Optional[str] = None
