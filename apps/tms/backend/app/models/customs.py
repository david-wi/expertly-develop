"""
Customs Entry Model - Track customs entries and clearance status.

Manages customs documentation and clearance workflow for
cross-border shipments.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from .base import MongoModel, PyObjectId


class CustomsEntryStatus(str, Enum):
    """Status of a customs entry."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    ADDITIONAL_INFO_REQUIRED = "additional_info_required"
    CLEARED = "cleared"
    HELD = "held"
    REJECTED = "rejected"


class CustomsEntryType(str, Enum):
    """Type of customs entry."""
    IMPORT = "import"
    EXPORT = "export"
    IN_TRANSIT = "in_transit"


class HarmonizedCode(MongoModel):
    """HS/HTS code for a commodity."""
    code: str  # e.g., "8471.30.0100"
    description: str
    duty_rate: Optional[float] = None  # Percentage
    unit_of_measure: Optional[str] = None


class CustomsLineItem(MongoModel):
    """Line item for customs entry."""
    description: str
    quantity: int
    unit_of_measure: str
    unit_value_cents: int
    total_value_cents: int
    country_of_origin: str
    hs_code: Optional[str] = None
    hs_code_description: Optional[str] = None
    weight_kg: Optional[float] = None
    manufacturer: Optional[str] = None
    marks_and_numbers: Optional[str] = None


class CustomsEntry(MongoModel):
    """
    Customs entry for cross-border shipments.

    Tracks the customs clearance process including documentation,
    duties, and status.
    """

    # Reference Numbers
    entry_number: str  # Our internal entry reference
    customs_reference: Optional[str] = None  # Government customs reference
    broker_reference: Optional[str] = None  # Customs broker reference

    # Entry Type and Status
    entry_type: CustomsEntryType = CustomsEntryType.IMPORT
    status: CustomsEntryStatus = CustomsEntryStatus.DRAFT

    # Shipment Link
    shipment_id: Optional[PyObjectId] = None

    # Parties
    importer_of_record: Optional[str] = None
    importer_ein: Optional[str] = None  # Employer ID number / Tax ID
    consignee_name: Optional[str] = None
    consignee_address: Optional[str] = None
    exporter_name: Optional[str] = None
    exporter_address: Optional[str] = None
    exporter_country: Optional[str] = None

    # Transport Details
    port_of_entry: Optional[str] = None
    port_of_exit: Optional[str] = None
    mode_of_transport: Optional[str] = None  # "ocean", "air", "truck", "rail"
    carrier_code: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    bill_of_lading: Optional[str] = None
    master_bill: Optional[str] = None
    house_bill: Optional[str] = None

    # Dates
    estimated_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    entry_date: Optional[datetime] = None
    clearance_date: Optional[datetime] = None

    # Line Items
    line_items: List[CustomsLineItem] = []

    # Values (all in cents)
    total_declared_value_cents: int = 0
    currency: str = "USD"
    estimated_duty_cents: int = 0
    actual_duty_cents: Optional[int] = None
    mpf_cents: Optional[int] = None  # Merchandise Processing Fee
    hmf_cents: Optional[int] = None  # Harbor Maintenance Fee
    other_fees_cents: Optional[int] = None

    # Documents
    document_ids: List[PyObjectId] = []
    commercial_invoice_id: Optional[PyObjectId] = None
    packing_list_id: Optional[PyObjectId] = None

    # Notes and History
    notes: Optional[str] = None
    hold_reason: Optional[str] = None
    rejection_reason: Optional[str] = None

    # Broker
    customs_broker_name: Optional[str] = None
    customs_broker_id: Optional[str] = None

    # Audit
    created_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    submitted_by: Optional[str] = None
    cleared_at: Optional[datetime] = None
    cleared_by: Optional[str] = None

    class Config:
        collection = "customs_entries"


class CommercialInvoice(MongoModel):
    """
    Commercial Invoice for customs purposes.

    Generated from shipment data for customs declarations.
    """
    invoice_number: str
    invoice_date: datetime

    # Shipment Link
    shipment_id: Optional[PyObjectId] = None
    customs_entry_id: Optional[PyObjectId] = None

    # Seller (Exporter)
    seller_name: str
    seller_address: Optional[str] = None
    seller_country: str
    seller_tax_id: Optional[str] = None

    # Buyer (Importer)
    buyer_name: str
    buyer_address: Optional[str] = None
    buyer_country: str
    buyer_tax_id: Optional[str] = None

    # Ship To
    ship_to_name: Optional[str] = None
    ship_to_address: Optional[str] = None
    ship_to_country: Optional[str] = None

    # Transport
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    country_of_origin: str
    country_of_destination: str

    # Line Items
    line_items: List[CustomsLineItem] = []

    # Totals (cents)
    subtotal_cents: int = 0
    freight_cents: int = 0
    insurance_cents: int = 0
    other_charges_cents: int = 0
    total_cents: int = 0
    currency: str = "USD"

    # Terms
    incoterms: Optional[str] = None  # "FOB", "CIF", "EXW", etc.
    payment_terms: Optional[str] = None

    # Certifications
    declaration_statement: Optional[str] = None
    authorized_signature: Optional[str] = None
    signature_date: Optional[datetime] = None

    # PDF
    pdf_document_id: Optional[PyObjectId] = None
    generated_at: Optional[datetime] = None

    class Config:
        collection = "commercial_invoices"
