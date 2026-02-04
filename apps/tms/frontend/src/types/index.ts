// Customer types
export interface CustomerContact {
  name: string
  email?: string
  phone?: string
  role?: string
  is_primary: boolean
}

export type CustomerStatus = 'active' | 'paused' | 'credit_hold' | 'inactive'

export interface Customer {
  id: string
  name: string
  code?: string
  status: CustomerStatus
  contacts: CustomerContact[]
  billing_email?: string
  phone?: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  country: string
  payment_terms: number
  credit_limit?: number
  default_margin_percent: number
  total_shipments: number
  total_revenue: number
  created_at: string
}

// Carrier types
export type CarrierStatus = 'active' | 'pending' | 'suspended' | 'do_not_use'
export type EquipmentType = 'van' | 'reefer' | 'flatbed' | 'step_deck' | 'lowboy' | 'power_only' | 'sprinter' | 'box_truck' | 'hotshot' | 'container'

export interface CarrierContact {
  name: string
  email?: string
  phone?: string
  role?: string
  is_primary: boolean
}

export interface Carrier {
  id: string
  name: string
  mc_number?: string
  dot_number?: string
  status: CarrierStatus
  contacts: CarrierContact[]
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  dispatch_email?: string
  dispatch_phone?: string
  equipment_types: EquipmentType[] | string[]
  insurance_expiration?: string
  authority_active: boolean
  safety_rating?: string
  total_loads: number
  on_time_percentage?: number
  claims_count: number
  is_insurance_expiring: boolean
  created_at: string
}

// Quote Request types
export type QuoteRequestStatus = 'new' | 'in_progress' | 'quoted' | 'declined' | 'expired'

export interface ExtractedField {
  value: string | number | string[]
  confidence: number
  evidence_text?: string
  evidence_source: string
}

export interface QuoteRequest {
  id: string
  source_type: string
  source_email?: string
  source_subject?: string
  raw_content?: string
  customer_id?: string
  sender_email?: string
  sender_name?: string
  status: QuoteRequestStatus
  extracted_origin_city?: ExtractedField
  extracted_origin_state?: ExtractedField
  extracted_destination_city?: ExtractedField
  extracted_destination_state?: ExtractedField
  extracted_pickup_date?: ExtractedField
  extracted_equipment_type?: ExtractedField
  missing_fields: string[]
  extraction_confidence: number
  quote_id?: string
  received_at: string
  created_at: string
}

// Quote types
export type QuoteStatus = 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'declined' | 'expired'

export interface QuoteLineItem {
  description: string
  quantity: number
  unit_price: number
  is_accessorial: boolean
}

export interface Quote {
  id: string
  quote_number: string
  customer_id: string
  customer_name?: string
  customer_email?: string
  status: QuoteStatus
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  pickup_date?: string
  delivery_date?: string
  equipment_type: string
  weight_lbs?: number
  commodity?: string
  line_items: QuoteLineItem[]
  total_price: number
  estimated_cost: number
  margin_percent: number
  shipment_id?: string
  created_at: string
}

// Shipment types
export type ShipmentStatus = 'booked' | 'pending_pickup' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
export type StopType = 'pickup' | 'delivery' | 'stop'

export interface Stop {
  stop_number: number
  stop_type: StopType
  name?: string
  address: string
  city: string
  state: string
  zip_code: string
  contact_name?: string
  contact_phone?: string
  scheduled_date?: string
  actual_arrival?: string
  actual_departure?: string
}

export interface Shipment {
  id: string
  shipment_number: string
  pro_number?: string
  customer_id: string
  customer_name?: string
  carrier_id?: string
  carrier_name?: string
  status: ShipmentStatus
  stops: Stop[]
  origin_city?: string
  origin_state?: string
  destination_city?: string
  destination_state?: string
  equipment_type: string
  weight_lbs?: number
  commodity?: string
  customer_price: number
  carrier_cost: number
  margin: number
  margin_percent: number
  pickup_date?: string
  delivery_date?: string
  last_known_location?: string
  last_check_call?: string
  eta?: string
  at_risk: boolean
  is_at_risk: boolean
  created_at: string
}

// Work Item types
export type WorkItemType = 'quote_request' | 'quote_followup' | 'shipment_needs_carrier' | 'tender_pending' | 'check_call_due' | 'document_needed' | 'invoice_ready' | 'exception' | 'custom'
export type WorkItemStatus = 'open' | 'in_progress' | 'waiting' | 'done' | 'dismissed'

export interface WorkItem {
  id: string
  work_type: WorkItemType
  status: WorkItemStatus
  title: string
  description?: string
  priority: number
  quote_request_id?: string
  quote_id?: string
  shipment_id?: string
  customer_id?: string
  carrier_id?: string
  due_at?: string
  is_overdue: boolean
  is_snoozed: boolean
  created_at: string
}

// Invoice types
export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'partial' | 'paid' | 'void'

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  shipment_id?: string
}

export interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  customer_name?: string
  shipment_id?: string
  shipment_number?: string
  status: InvoiceStatus
  invoice_date: string
  due_date?: string
  billing_name: string
  line_items: InvoiceLineItem[]
  total: number
  amount_paid: number
  amount_due: number
  created_at: string
}

// Dashboard types
export interface DashboardStats {
  work_items_by_type: Record<string, number>
  overdue_count: number
  at_risk_shipments: number
  todays_pickups: number
  todays_deliveries: number
}

// Carrier suggestion types
export interface CarrierSuggestion {
  carrier_id: string
  carrier_name: string
  score: number
  reasons: string[]
  on_time_percentage?: number
  on_time_percent?: number
  total_loads_on_lane: number
  lane_count?: number
  insurance_status: string
  estimated_cost?: number
}

// Tender types
export type TenderStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'cancelled'

export interface Tender {
  id: string
  shipment_id: string
  carrier_id: string
  carrier_name?: string
  status: TenderStatus
  offered_rate: number
  notes?: string
  sent_at?: string
  responded_at?: string
  created_at: string
}

// Analytics types
export interface MarginSummary {
  total_revenue: number
  total_cost: number
  total_margin: number
  avg_margin_percent: number
  shipment_count: number
  low_margin_count: number
}

export interface CustomerMargin {
  customer_id: string
  customer_name: string
  total_revenue: number
  total_cost: number
  total_margin: number
  avg_margin_percent: number
  shipment_count: number
}

export interface CarrierMargin {
  carrier_id: string
  carrier_name: string
  total_revenue: number
  total_cost: number
  total_margin: number
  avg_margin_percent: number
  shipment_count: number
}

export interface LaneMargin {
  origin: string
  destination: string
  total_revenue: number
  total_cost: number
  total_margin: number
  avg_margin_percent: number
  shipment_count: number
}

export interface MarginTrend {
  date: string
  total_revenue: number
  total_cost: number
  total_margin: number
  avg_margin_percent: number
  shipment_count: number
}

export interface LowMarginShipment {
  shipment_id: string
  shipment_number: string
  customer_name?: string
  carrier_name?: string
  origin: string
  destination: string
  customer_price: number
  carrier_cost: number
  margin: number
  margin_percent: number
  created_at: string
}

export interface MarginDashboard {
  summary: MarginSummary
  by_customer: CustomerMargin[]
  by_carrier: CarrierMargin[]
  by_lane: LaneMargin[]
  trends: MarginTrend[]
  low_margin_shipments: LowMarginShipment[]
}

// Carrier Performance Analytics
export interface CarrierPerformanceSummary {
  total_carriers: number
  active_carriers: number
  avg_on_time_rate: number
  avg_tender_acceptance: number
  top_performer_id?: string
  top_performer_name?: string
}

export interface CarrierPerformanceDetail {
  carrier_id: string
  carrier_name: string
  mc_number?: string
  shipment_count: number
  on_time_delivery_count: number
  on_time_rate: number
  late_delivery_count: number
  tender_accepted_count: number
  tender_declined_count: number
  tender_acceptance_rate: number
  avg_cost_per_mile: number
  total_miles: number
  total_cost: number
  exception_count: number
  performance_score: number
  trend: 'improving' | 'stable' | 'declining'
}

export interface CarrierPerformanceTrend {
  date: string
  on_time_rate: number
  shipment_count: number
  avg_cost_per_mile: number
}

export interface CarrierPerformance {
  summary: CarrierPerformanceSummary
  carriers: CarrierPerformanceDetail[]
  trends: CarrierPerformanceTrend[]
}

// Tracking Event types
export type TrackingEventType = 'created' | 'dispatched' | 'picked_up' | 'in_transit' | 'check_call' | 'location_update' | 'delay' | 'exception' | 'delivered'

export interface TrackingEvent {
  id: string
  shipment_id: string
  event_type: TrackingEventType | string
  timestamp: string
  location?: string
  location_city?: string
  location_state?: string
  notes?: string
  created_at: string
}

// Document types
export type DocumentType =
  | 'bol'
  | 'pod'
  | 'rate_confirmation'
  | 'lumper_receipt'
  | 'scale_ticket'
  | 'invoice'
  | 'carrier_invoice'
  | 'insurance_certificate'
  | 'commercial_invoice'
  | 'packing_list'
  | 'certificate_of_origin'
  | 'customs_entry'
  | 'other'

export type ExtractionStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'skipped'

export interface DocumentExtractedField {
  field_name: string
  value: string | null
  confidence: number
  evidence_text?: string
}

export interface Document {
  id: string
  document_type: DocumentType
  filename: string
  original_filename: string
  mime_type: string
  size_bytes: number
  shipment_id?: string
  quote_id?: string
  carrier_id?: string
  customer_id?: string
  description?: string
  uploaded_by?: string
  source?: string
  is_verified: boolean
  verified_by?: string
  created_at?: string

  // AI Extraction
  extraction_status?: ExtractionStatus
  ocr_text?: string
  ocr_confidence?: number
  ai_classified_type?: DocumentType
  classification_confidence?: number
  extracted_fields?: DocumentExtractedField[]
  suggested_shipment_ids?: string[]
  auto_matched: boolean
  match_confidence?: number
  needs_review: boolean
}

// Document type labels for display
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bol: 'Bill of Lading',
  pod: 'Proof of Delivery',
  rate_confirmation: 'Rate Confirmation',
  lumper_receipt: 'Lumper Receipt',
  scale_ticket: 'Scale Ticket',
  invoice: 'Invoice',
  carrier_invoice: 'Carrier Invoice',
  insurance_certificate: 'Insurance Certificate',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  certificate_of_origin: 'Certificate of Origin',
  customs_entry: 'Customs Entry',
  other: 'Other',
}

// Email types
export type EmailDirection = 'inbound' | 'outbound'

export type EmailCategory =
  | 'quote_request'
  | 'quote_response'
  | 'shipment_update'
  | 'carrier_communication'
  | 'customer_communication'
  | 'invoice_related'
  | 'document_attached'
  | 'booking_confirmation'
  | 'tracking_update'
  | 'claim_related'
  | 'uncategorized'

export interface EmailAttachment {
  filename: string
  mime_type: string
  size_bytes: number
  document_id?: string
}

export interface EmailMessage {
  id: string
  message_id: string
  thread_id?: string
  direction: EmailDirection
  is_read: boolean
  is_starred: boolean
  is_archived: boolean
  from_email: string
  from_name?: string
  to_emails: string[]
  cc_emails: string[]
  subject: string
  body_text?: string
  body_html?: string
  has_attachments: boolean
  attachments: EmailAttachment[]
  category: EmailCategory
  classification_confidence?: number
  ai_summary?: string
  extracted_action_items?: string[]
  shipment_id?: string
  quote_id?: string
  customer_id?: string
  carrier_id?: string
  auto_matched: boolean
  match_confidence?: number
  needs_review: boolean
  received_at?: string
  sent_at?: string
  created_at?: string
}

export interface EmailStats {
  unread_count: number
  needs_review_count: number
  by_category: Record<string, number>
}

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  quote_request: 'Quote Request',
  quote_response: 'Quote Response',
  shipment_update: 'Shipment Update',
  carrier_communication: 'Carrier',
  customer_communication: 'Customer',
  invoice_related: 'Invoice',
  document_attached: 'Document',
  booking_confirmation: 'Booking',
  tracking_update: 'Tracking',
  claim_related: 'Claim',
  uncategorized: 'Uncategorized',
}
