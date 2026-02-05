"""Portal models for carrier and customer self-service."""
from datetime import datetime
from enum import Enum
from typing import Optional, List

from .base import MongoModel, PyObjectId, utc_now


class OnboardingStatus(str, Enum):
    """Status of carrier onboarding."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class OnboardingDocumentType(str, Enum):
    """Types of documents required for onboarding."""
    W9 = "w9"
    INSURANCE_CERTIFICATE = "insurance_certificate"
    AUTHORITY_LETTER = "authority_letter"
    CARRIER_PACKET = "carrier_packet"
    OPERATING_AUTHORITY = "operating_authority"
    CARGO_INSURANCE = "cargo_insurance"
    LIABILITY_INSURANCE = "liability_insurance"
    SIGNED_AGREEMENT = "signed_agreement"
    VOID_CHECK = "void_check"
    OTHER = "other"


class OnboardingDocument(MongoModel):
    """A document submitted during onboarding."""

    onboarding_id: PyObjectId
    carrier_id: Optional[PyObjectId] = None

    document_type: OnboardingDocumentType
    filename: str
    file_url: str
    mime_type: str
    file_size_bytes: int

    # Verification
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None

    # Expiration tracking
    expiration_date: Optional[datetime] = None
    is_expired: bool = False


class CarrierOnboarding(MongoModel):
    """Carrier onboarding workflow."""

    # Basic info (step 1)
    company_name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None

    # Contact (step 2)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    dispatch_email: Optional[str] = None
    dispatch_phone: Optional[str] = None

    # Address (step 2)
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

    # Equipment (step 3)
    equipment_types: List[str] = []
    truck_count: Optional[int] = None
    operating_states: List[str] = []

    # Insurance info (step 4)
    cargo_insurance_amount: Optional[int] = None  # in cents
    liability_insurance_amount: Optional[int] = None  # in cents
    insurance_company: Optional[str] = None
    insurance_expiration: Optional[datetime] = None

    # Payment (step 5)
    payment_method: Optional[str] = None  # "ach", "check", "factoring"
    factoring_company: Optional[str] = None
    bank_name: Optional[str] = None
    bank_routing: Optional[str] = None  # Should be encrypted in production
    bank_account: Optional[str] = None  # Should be encrypted in production

    # Status
    status: OnboardingStatus = OnboardingStatus.NOT_STARTED
    current_step: int = 1
    total_steps: int = 6

    # Documents required/uploaded
    required_documents: List[OnboardingDocumentType] = [
        OnboardingDocumentType.W9,
        OnboardingDocumentType.INSURANCE_CERTIFICATE,
        OnboardingDocumentType.SIGNED_AGREEMENT,
    ]
    uploaded_document_ids: List[PyObjectId] = []

    # Agreement
    agreement_accepted: bool = False
    agreement_accepted_at: Optional[datetime] = None
    agreement_ip_address: Optional[str] = None

    # Links
    carrier_id: Optional[PyObjectId] = None  # Set when onboarding creates carrier
    invited_by: Optional[str] = None

    # Access
    access_token: str  # Unique token for onboarding URL
    token_expires_at: Optional[datetime] = None

    # Review
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    @property
    def progress_percent(self) -> int:
        """Calculate onboarding progress percentage."""
        return int((self.current_step / self.total_steps) * 100)


class CarrierPortalSession(MongoModel):
    """Session for carrier portal access."""

    carrier_id: PyObjectId

    # Auth
    email: str
    token: str
    token_expires_at: datetime

    # Session info
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    last_active_at: datetime = None

    is_active: bool = True

    def __init__(self, **data):
        super().__init__(**data)
        if self.last_active_at is None:
            self.last_active_at = utc_now()


class CustomerPortalSession(MongoModel):
    """Session for customer portal access."""

    customer_id: PyObjectId

    # Auth
    email: str
    token: str
    token_expires_at: datetime

    # Session info
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    last_active_at: datetime = None

    is_active: bool = True

    def __init__(self, **data):
        super().__init__(**data)
        if self.last_active_at is None:
            self.last_active_at = utc_now()


class PortalNotification(MongoModel):
    """Notification for portal users."""

    portal_type: str  # "carrier" or "customer"
    entity_id: PyObjectId  # carrier_id or customer_id

    title: str
    message: str
    notification_type: str  # "tender", "shipment", "document", "payment", "alert"

    # Links
    shipment_id: Optional[PyObjectId] = None
    tender_id: Optional[PyObjectId] = None
    document_id: Optional[PyObjectId] = None
    invoice_id: Optional[PyObjectId] = None

    # Status
    is_read: bool = False
    read_at: Optional[datetime] = None
