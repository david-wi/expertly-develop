# TMS Communication Hub & Document Intelligence Plan

## Vision
Transform TMS into the **single source of truth** for all shipment communication, eliminating the need for separate email clients. Every email, document, and message is captured, classified, and linked to the relevant shipment or opportunity.

---

## Phase 3A: Email Centralization

### 1. Email Inbox Integration

**Backend Components:**
- `EmailMessage` model - Store all inbound/outbound emails
- Email receiving via webhook (SendGrid Inbound Parse or similar)
- AI classification service to categorize and match emails

**Email Matching Logic:**
```
1. Check for shipment number in subject/body → Match to shipment
2. Check for quote number → Match to quote
3. Check sender email against customers → Match to customer
4. Check sender email against carriers → Match to carrier
5. Extract keywords (pickup, delivery, POD, invoice) → Suggest category
6. If no match → Route to "Uncategorized" queue
```

**Email Categories:**
- `quote_request` - New rate request
- `quote_response` - Customer responding to quote
- `shipment_update` - Status update about a load
- `carrier_communication` - From/to carrier
- `customer_communication` - From/to customer
- `invoice_related` - Payment/invoice discussion
- `document_attached` - Has attachments (BOL, POD, etc.)
- `uncategorized` - Needs manual review

### 2. Unified Conversation View

**Per-Shipment Communication Tab:**
- Chronological thread of ALL communications:
  - Emails (in/out)
  - Internal notes
  - Tracking events
  - Document uploads
  - Tender communications
  - Customer portal messages
- Filter by: type, date range, participant
- Reply inline (compose email from TMS)
- Forward to internal team members

### 3. Uncategorized Queue

**Features:**
- Shows all emails that couldn't be auto-matched
- AI suggestions: "This might be related to Shipment #SH-001234"
- One-click categorization: Link to shipment, customer, carrier, or mark as spam
- Bulk actions for efficiency
- Learn from user categorizations to improve matching

---

## Phase 3B: Document Intelligence (OCR & AI)

### 1. Document Processing Pipeline

```
Document Upload/Email Attachment
            ↓
    File Type Detection
            ↓
    OCR (if image/scan)
            ↓
    AI Classification
            ↓
    Field Extraction
            ↓
    Auto-Match to Shipment
            ↓
    Human Review (if needed)
```

### 2. Document Types & Extraction

| Document Type | Key Fields to Extract |
|---------------|----------------------|
| **BOL** | PRO number, shipper, consignee, pieces, weight, commodity, pickup date |
| **POD** | Delivery date/time, receiver name, signature present, condition notes |
| **Rate Confirmation** | Rate, carrier name, MC#, pickup/delivery dates, equipment |
| **Commercial Invoice** | Invoice #, shipper, consignee, value, HTS codes, country of origin |
| **Lumper Receipt** | Amount, facility name, date |
| **Scale Ticket** | Weight, date, location |
| **Carrier Invoice** | Carrier name, amount, reference numbers |
| **Insurance Certificate** | Carrier name, policy #, expiration date, coverage amounts |

### 3. Auto-Matching Logic

**For BOLs/PODs:**
1. Extract PRO number → Match to shipment by reference
2. Extract shipper/consignee names → Match to customer/facility
3. Extract dates → Narrow down candidate shipments
4. If ambiguous → Show top 3 suggestions for user selection

**For Rate Confirmations:**
1. Extract carrier MC# → Match to carrier record
2. Extract pickup/delivery info → Match to shipment
3. Verify rate matches tender → Flag discrepancies

---

## Phase 3C: Customs & International

### 1. Customs Profile per Shipment

**Fields to Add:**
- `is_international` - Flag for cross-border
- `customs_broker_id` - Assigned customs broker
- `entry_number` - Customs entry #
- `entry_status` - Pending, Cleared, Hold, Exam
- `cleared_at` - Clearance timestamp
- `duties_amount` - Duties owed (cents)
- `bond_type` - Single entry or continuous
- `hts_codes` - Array of commodity codes

### 2. Documentation Generation

**Auto-Generate:**
- Commercial Invoice (from shipment data)
- Packing List (from item details)
- USMCA Certificate (from origin data)
- Shipper's Letter of Instruction

### 3. Compliance Checks

**On Shipment Creation:**
- Screen shipper/consignee against denied party lists
- Flag controlled commodities (ITAR/EAR)
- Validate HTS codes
- Check for required licenses

### 4. Customs Workflow

```
International Shipment Created
            ↓
    Generate Required Docs
            ↓
    Assign Customs Broker
            ↓
    File Entry (ISF if ocean)
            ↓
    Track Clearance Status
            ↓
    Log Duties & Fees
            ↓
    Release for Delivery
```

---

## Phase 4A: Load Board Integrations

### 1. DAT Integration

**Features:**
- Post loads to DAT automatically
- Receive carrier bids in TMS
- Rate intelligence (market rates)
- Carrier search by lane

**API Endpoints Needed:**
- `POST /loads` - Post available loads
- `GET /loads/{id}/responses` - Get carrier responses
- `GET /rates` - Market rate lookup
- `GET /carriers/search` - Find carriers

### 2. Truckstop Integration

**Similar features to DAT:**
- Load posting
- Carrier responses
- Rate data
- Carrier search

### 3. Unified Load Board View

**In TMS:**
- Single screen to post to multiple boards
- Aggregate all responses in one view
- One-click tender creation from response
- Track which boards generated which carriers

---

## Phase 4B: Accounting Integrations

### 1. QuickBooks Online Integration

**Sync:**
- Customers → QBO Customers
- Invoices → QBO Invoices
- Carrier Payments → QBO Bills
- Payments Received → QBO Payments

**Automation:**
- Create invoice in TMS → Auto-push to QBO
- Payment recorded in QBO → Auto-update TMS
- Daily reconciliation check

### 2. Sage Integration

**Similar to QuickBooks:**
- Customer sync
- Invoice sync
- Bill sync (carrier payables)
- Payment sync

### 3. General Accounting Features

**In TMS:**
- Chart of accounts mapping
- Revenue recognition rules
- Accrual vs cash basis support
- Financial period closing
- Audit trail for all financial transactions

---

## Data Models to Add

### EmailMessage
```python
class EmailMessage:
    id: ObjectId
    message_id: str  # Email message ID
    thread_id: str  # For conversation threading
    direction: "inbound" | "outbound"
    from_email: str
    from_name: str
    to_emails: List[str]
    cc_emails: List[str]
    subject: str
    body_text: str
    body_html: str
    attachments: List[AttachmentRef]

    # Classification
    category: str
    confidence: float
    matched_shipment_id: ObjectId
    matched_quote_id: ObjectId
    matched_customer_id: ObjectId
    matched_carrier_id: ObjectId

    # Status
    is_read: bool
    is_starred: bool
    is_archived: bool

    received_at: datetime
    created_at: datetime
```

### DocumentExtraction
```python
class DocumentExtraction:
    document_id: ObjectId
    extraction_status: "pending" | "processing" | "complete" | "failed"

    # OCR Results
    raw_text: str
    confidence: float

    # AI Extracted Fields
    extracted_fields: Dict[str, ExtractedField]
    document_classification: str
    classification_confidence: float

    # Matching
    suggested_shipment_ids: List[ObjectId]
    matched_shipment_id: ObjectId
    matched_by: "auto" | "manual"

    processed_at: datetime
```

### CustomsInfo (embedded in Shipment)
```python
class CustomsInfo:
    is_international: bool
    border_crossing: str  # e.g., "Laredo, TX"
    customs_broker_id: ObjectId
    customs_broker_name: str

    entry_number: str
    entry_type: "formal" | "informal"
    entry_status: "pending" | "filed" | "cleared" | "hold" | "exam"
    filed_at: datetime
    cleared_at: datetime

    hts_codes: List[str]
    declared_value: int  # cents
    duties_amount: int  # cents
    fees_amount: int  # cents
    bond_type: "single" | "continuous"
    bond_number: str

    documents: List[str]  # Required doc types
    compliance_flags: List[str]  # Any issues
```

---

## Implementation Priority

### Immediate (This Session)
1. ✅ Margin Dashboard - DONE
2. ✅ Carrier Performance - DONE
3. Document OCR & AI extraction
4. Email message model & basic inbox

### Next Session
5. Email classification & auto-matching
6. Unified conversation view per shipment
7. Uncategorized email queue

### Following Sessions
8. Customs features (international shipments)
9. Load board integrations (DAT, Truckstop)
10. Accounting integrations (QuickBooks)

---

## Success Metrics

- **Email Response Time**: Reduce average response time by 50%
- **Document Processing**: 95% auto-classification accuracy
- **Manual Categorization**: <10% of emails need manual sorting
- **Customs Clearance**: Reduce clearance delays by 30%
- **Load Board Efficiency**: Post to 3 boards in <30 seconds
