from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.models.invoice import InvoiceStatus, InvoiceLineItem, InvoicePayment


class InvoiceCreate(BaseModel):
    customer_id: str
    shipment_ids: List[str] = []
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    billing_name: str
    billing_email: Optional[str] = None
    billing_address: Optional[str] = None
    line_items: List[InvoiceLineItem] = []
    tax_amount: int = 0
    notes: Optional[str] = None
    internal_notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    due_date: Optional[datetime] = None
    billing_name: Optional[str] = None
    billing_email: Optional[str] = None
    billing_address: Optional[str] = None
    line_items: Optional[List[InvoiceLineItem]] = None
    tax_amount: Optional[int] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None


class InvoicePaymentCreate(BaseModel):
    amount: int
    payment_date: datetime
    payment_method: str = "check"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    customer_id: str
    shipment_ids: List[str]
    status: InvoiceStatus
    invoice_date: datetime
    due_date: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    billing_name: str
    billing_email: Optional[str] = None
    billing_address: Optional[str] = None
    line_items: List[InvoiceLineItem]
    subtotal: int
    tax_amount: int
    total: int
    amount_paid: int
    amount_due: int
    payments: List[InvoicePayment]
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
