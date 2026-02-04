"""
Email Message Model - Centralized email storage and tracking.

All inbound and outbound emails are stored here, linked to their
relevant entities (shipments, quotes, customers, carriers).
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from .base import MongoModel, PyObjectId


class EmailDirection(str, Enum):
    """Direction of email."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class EmailCategory(str, Enum):
    """Categories for email classification."""
    QUOTE_REQUEST = "quote_request"  # New rate request
    QUOTE_RESPONSE = "quote_response"  # Customer responding to quote
    SHIPMENT_UPDATE = "shipment_update"  # Status update about a load
    CARRIER_COMMUNICATION = "carrier_communication"  # From/to carrier
    CUSTOMER_COMMUNICATION = "customer_communication"  # From/to customer
    INVOICE_RELATED = "invoice_related"  # Payment/invoice discussion
    DOCUMENT_ATTACHED = "document_attached"  # Has relevant attachments
    BOOKING_CONFIRMATION = "booking_confirmation"  # Load booking confirmation
    TRACKING_UPDATE = "tracking_update"  # Tracking/check call info
    CLAIM_RELATED = "claim_related"  # Damage or claim related
    UNCATEGORIZED = "uncategorized"  # Needs manual review


class EmailAttachment(MongoModel):
    """Reference to an attachment on an email."""
    filename: str
    mime_type: str
    size_bytes: int
    document_id: Optional[PyObjectId] = None  # Link to Document if processed
    storage_path: Optional[str] = None


class EmailMessage(MongoModel):
    """
    Stores all email communication in the TMS.

    This centralizes all correspondence so users don't need
    to use a separate email client. Emails are automatically
    classified and linked to relevant entities.
    """

    # Email Identity
    message_id: str  # Email Message-ID header
    thread_id: Optional[str] = None  # For conversation threading
    in_reply_to: Optional[str] = None  # Message-ID this replies to

    # Direction and Status
    direction: EmailDirection
    is_read: bool = False
    is_starred: bool = False
    is_archived: bool = False
    is_spam: bool = False

    # Addresses
    from_email: str
    from_name: Optional[str] = None
    to_emails: List[str] = []
    cc_emails: List[str] = []
    bcc_emails: List[str] = []
    reply_to: Optional[str] = None

    # Content
    subject: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None

    # Attachments
    attachments: List[EmailAttachment] = []
    has_attachments: bool = False

    # AI Classification
    category: EmailCategory = EmailCategory.UNCATEGORIZED
    classification_confidence: Optional[float] = None
    ai_summary: Optional[str] = None  # Short AI-generated summary
    extracted_action_items: Optional[List[str]] = None  # Key actions needed

    # Entity Links (can have multiple)
    shipment_id: Optional[PyObjectId] = None
    shipment_ids: List[PyObjectId] = []  # If email relates to multiple
    quote_id: Optional[PyObjectId] = None
    quote_request_id: Optional[PyObjectId] = None
    customer_id: Optional[PyObjectId] = None
    carrier_id: Optional[PyObjectId] = None
    invoice_id: Optional[PyObjectId] = None

    # Matching
    auto_matched: bool = False
    match_confidence: Optional[float] = None
    suggested_shipment_ids: List[PyObjectId] = []
    needs_review: bool = False

    # Work Item Link
    work_item_id: Optional[PyObjectId] = None  # Created work item if any

    # Outbound specific
    sent_at: Optional[datetime] = None
    sent_by: Optional[str] = None
    send_status: Optional[str] = None  # "pending", "sent", "failed", "bounced"
    send_error: Optional[str] = None

    # Timestamps
    received_at: Optional[datetime] = None  # When we received it
    email_date: Optional[datetime] = None  # Date header from email

    # Source tracking
    source: str = "manual"  # "gmail", "outlook", "sendgrid_webhook", "manual"

    class Config:
        collection = "email_messages"


class EmailThread(MongoModel):
    """
    Represents a conversation thread grouping related emails.
    """
    thread_id: str
    subject: str  # Original subject (without Re:/Fwd:)

    # Participants
    participants: List[str] = []  # All email addresses involved

    # Links
    shipment_id: Optional[PyObjectId] = None
    customer_id: Optional[PyObjectId] = None
    carrier_id: Optional[PyObjectId] = None

    # Stats
    message_count: int = 0
    unread_count: int = 0
    last_message_at: Optional[datetime] = None

    # Status
    is_archived: bool = False

    class Config:
        collection = "email_threads"
