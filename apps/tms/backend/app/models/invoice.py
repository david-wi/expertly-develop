from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

from .base import MongoModel, PyObjectId, utc_now


class InvoiceStatus(str, Enum):
    """Invoice status state machine."""
    DRAFT = "draft"
    PENDING = "pending"
    SENT = "sent"
    PARTIAL = "partial"
    PAID = "paid"
    VOID = "void"


INVOICE_STATUS_TRANSITIONS: dict[InvoiceStatus, list[InvoiceStatus]] = {
    InvoiceStatus.DRAFT: [InvoiceStatus.PENDING, InvoiceStatus.VOID],
    InvoiceStatus.PENDING: [InvoiceStatus.SENT, InvoiceStatus.DRAFT, InvoiceStatus.VOID],
    InvoiceStatus.SENT: [InvoiceStatus.PARTIAL, InvoiceStatus.PAID, InvoiceStatus.VOID],
    InvoiceStatus.PARTIAL: [InvoiceStatus.PAID, InvoiceStatus.VOID],
    InvoiceStatus.PAID: [],
    InvoiceStatus.VOID: [],
}


class InvoiceLineItem(BaseModel):
    """Line item on an invoice."""
    description: str
    quantity: int = 1
    unit_price: int  # In cents
    shipment_id: Optional[str] = None  # Link to shipment if applicable

    @property
    def total(self) -> int:
        """Calculate line item total."""
        return self.quantity * self.unit_price


class InvoicePayment(BaseModel):
    """Payment record for an invoice."""
    amount: int  # In cents
    payment_date: datetime
    payment_method: str = "check"  # "check", "ach", "wire", "credit_card"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class Invoice(MongoModel):
    """Customer invoice."""

    # Reference
    invoice_number: str  # e.g., "INV-2024-00001"

    # Links
    customer_id: PyObjectId
    shipment_ids: List[PyObjectId] = Field(default_factory=list)  # Can invoice multiple shipments

    # Status
    status: InvoiceStatus = InvoiceStatus.DRAFT

    # Dates
    invoice_date: datetime = Field(default_factory=utc_now)
    due_date: Optional[datetime] = None
    sent_at: Optional[datetime] = None

    # Billing info (snapshot from customer at invoice time)
    billing_name: str
    billing_email: Optional[str] = None
    billing_address: Optional[str] = None

    # Line items
    line_items: List[InvoiceLineItem] = Field(default_factory=list)

    # Totals
    subtotal: int = 0  # In cents
    tax_amount: int = 0
    total: int = 0
    amount_paid: int = 0

    @property
    def amount_due(self) -> int:
        """Calculate remaining amount due."""
        return self.total - self.amount_paid

    # Payments
    payments: List[InvoicePayment] = Field(default_factory=list)

    # Notes
    notes: Optional[str] = None
    internal_notes: Optional[str] = None

    # Internal
    created_by: Optional[str] = None

    def calculate_totals(self) -> None:
        """Recalculate invoice totals."""
        self.subtotal = sum(item.total for item in self.line_items)
        self.total = self.subtotal + self.tax_amount
        self.mark_updated()

    def add_payment(self, payment: InvoicePayment) -> None:
        """Add a payment and update status."""
        self.payments.append(payment)
        self.amount_paid = sum(p.amount for p in self.payments)
        if self.amount_paid >= self.total:
            self.status = InvoiceStatus.PAID
        elif self.amount_paid > 0:
            self.status = InvoiceStatus.PARTIAL
        self.mark_updated()

    def can_transition_to(self, new_status: InvoiceStatus) -> bool:
        """Check if status transition is valid."""
        return new_status in INVOICE_STATUS_TRANSITIONS.get(self.status, [])

    def transition_to(self, new_status: InvoiceStatus) -> None:
        """Transition to new status if valid."""
        if not self.can_transition_to(new_status):
            raise ValueError(f"Cannot transition from {self.status} to {new_status}")
        self.status = new_status
        if new_status == InvoiceStatus.SENT:
            self.sent_at = utc_now()
        self.mark_updated()
