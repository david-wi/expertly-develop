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
  desk_id?: string
  due_at?: string
  is_overdue: boolean
  is_snoozed: boolean
  created_at: string
}

// Desk types
export type DeskType = 'lane' | 'mode' | 'customer' | 'general'

export interface RoutingRule {
  field: string
  operator: string
  value: string | string[]
}

export interface CoverageSchedule {
  day_of_week: number
  start_time: string
  end_time: string
  timezone: string
}

export interface Desk {
  id: string
  name: string
  description: string
  desk_type: DeskType
  is_active: boolean
  routing_rules: RoutingRule[]
  coverage: CoverageSchedule[]
  members: string[]
  priority: number
  member_count: number
  active_work_items_count: number
  is_covered: boolean
  created_at: string
  updated_at: string
}

export const DESK_TYPE_LABELS: Record<DeskType, string> = {
  lane: 'Lane',
  mode: 'Mode',
  customer: 'Customer',
  general: 'General',
}

export const ROUTING_FIELD_LABELS: Record<string, string> = {
  origin_state: 'Origin State',
  destination_state: 'Destination State',
  equipment_type: 'Equipment Type',
  customer_id: 'Customer ID',
  work_type: 'Work Type',
}

export const ROUTING_OPERATOR_LABELS: Record<string, string> = {
  equals: 'Equals',
  in: 'In',
  contains: 'Contains',
  regex: 'Regex',
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

// Customs types
export type CustomsEntryStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'additional_info_required'
  | 'cleared'
  | 'held'
  | 'rejected'

export type CustomsEntryType = 'import' | 'export' | 'in_transit'

export interface CustomsLineItem {
  description: string
  quantity: number
  unit_of_measure: string
  unit_value_cents: number
  total_value_cents: number
  country_of_origin: string
  hs_code?: string
  hs_code_description?: string
  weight_kg?: number
  manufacturer?: string
}

export interface CustomsEntry {
  id: string
  entry_number: string
  customs_reference?: string
  broker_reference?: string
  entry_type: CustomsEntryType
  status: CustomsEntryStatus
  shipment_id?: string
  importer_of_record?: string
  consignee_name?: string
  exporter_name?: string
  port_of_entry?: string
  estimated_arrival?: string
  actual_arrival?: string
  clearance_date?: string
  total_declared_value_cents: number
  estimated_duty_cents: number
  actual_duty_cents?: number
  line_items: CustomsLineItem[]
  notes?: string
  hold_reason?: string
  created_at?: string
}

export interface CommercialInvoice {
  id: string
  invoice_number: string
  invoice_date: string
  shipment_id?: string
  customs_entry_id?: string
  seller_name: string
  seller_country: string
  buyer_name: string
  buyer_country: string
  total_cents: number
  currency: string
  incoterms?: string
  line_items: CustomsLineItem[]
  created_at?: string
}

export const CUSTOMS_STATUS_LABELS: Record<CustomsEntryStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  additional_info_required: 'Info Required',
  cleared: 'Cleared',
  held: 'Held',
  rejected: 'Rejected',
}

// Load Board types
export type LoadBoardProvider = 'dat' | 'truckstop' | 'loadlink' | 'direct_freight'
export type PostingStatus = 'draft' | 'posted' | 'booked' | 'expired' | 'cancelled'

export interface LoadBoardCredentials {
  id: string
  provider: LoadBoardProvider
  username: string
  is_active: boolean
  last_connected_at?: string
  connection_error?: string
  company_name?: string
  mc_number?: string
  contact_name?: string
}

export interface LoadBoardPosting {
  id: string
  posting_number: string
  shipment_id: string
  status: PostingStatus
  providers: LoadBoardProvider[]
  provider_post_ids: Record<string, string>
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  equipment_type: string
  weight_lbs?: number
  pickup_date_start?: string
  pickup_date_end?: string
  delivery_date?: string
  posted_rate?: number
  rate_per_mile?: number
  rate_type: string
  posted_at?: string
  expires_at?: string
  view_count: number
  call_count: number
  bid_count: number
  created_at: string
}

export interface CarrierSearchResult {
  provider: LoadBoardProvider
  provider_carrier_id?: string
  carrier_name: string
  mc_number?: string
  dot_number?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  city?: string
  state?: string
  equipment_types: string[]
  rating?: number
  total_loads?: number
  on_time_percentage?: number
  days_to_pay?: number
  truck_count?: number
  deadhead_miles?: number
}

export interface CarrierSearch {
  id: string
  result_count: number
  results: CarrierSearchResult[]
  searched_at: string
}

export interface RateIndex {
  provider: LoadBoardProvider
  origin: string
  destination: string
  equipment_type: string
  rate_per_mile_low?: number
  rate_per_mile_avg?: number
  rate_per_mile_high?: number
  flat_rate_low?: number
  flat_rate_avg?: number
  flat_rate_high?: number
  load_count?: number
  truck_count?: number
  date_range: string
  fetched_at: string
}

export interface LoadBoardStats {
  draft: number
  posted: number
  booked: number
  expired: number
  cancelled: number
  by_provider: Record<string, number>
}

export const LOADBOARD_PROVIDER_LABELS: Record<LoadBoardProvider, string> = {
  dat: 'DAT Power',
  truckstop: 'Truckstop.com',
  loadlink: 'Loadlink',
  direct_freight: 'Direct Freight',
}

export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  draft: 'Draft',
  posted: 'Posted',
  booked: 'Booked',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

// Accounting/QuickBooks types
export type AccountingProvider = 'quickbooks' | 'xero' | 'sage'
export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial'
export type SyncDirection = 'to_accounting' | 'from_accounting' | 'bidirectional'
export type AccountingEntityType = 'customer' | 'invoice' | 'payment' | 'vendor' | 'bill'

export interface AccountingConnection {
  provider: AccountingProvider
  is_connected: boolean
  company_id?: string
  company_name?: string
  connected_at?: string
  last_sync_at?: string
  connection_error?: string
  auto_sync_enabled: boolean
  sync_interval_minutes: number
  sync_customers: boolean
  sync_invoices: boolean
  sync_payments: boolean
  sync_vendors: boolean
  sync_bills: boolean
  revenue_account_id?: string
  revenue_account_name?: string
  expense_account_id?: string
  expense_account_name?: string
}

export interface AccountingMapping {
  id: string
  entity_type: AccountingEntityType
  tms_entity_id: string
  tms_entity_name?: string
  provider_entity_id: string
  provider_entity_name?: string
  last_synced_at?: string
  sync_error?: string
}

export interface SyncJob {
  id: string
  status: SyncStatus
  direction: SyncDirection
  started_at?: string
  completed_at?: string
  triggered_by: string
  entity_types: AccountingEntityType[]
  full_sync: boolean
  total_records: number
  synced_count: number
  failed_count: number
  skipped_count: number
  error_message?: string
  created_at: string
}

export interface SyncLogEntry {
  entity_type: AccountingEntityType
  tms_entity_id?: string
  provider_entity_id?: string
  operation: string
  status: SyncStatus
  error_message?: string
  timestamp: string
}

export interface AccountingStats {
  mappings: Record<string, number>
  sync_jobs: Record<string, number>
  recent_syncs: {
    id: string
    status: string
    synced_count: number
    failed_count: number
    created_at: string
  }[]
}

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
  partial: 'Partial',
}

export const ACCOUNTING_ENTITY_TYPE_LABELS: Record<AccountingEntityType, string> = {
  customer: 'Customer',
  invoice: 'Invoice',
  payment: 'Payment',
  vendor: 'Vendor',
  bill: 'Bill',
}

// ============================================================================
// Geofence Types
// ============================================================================

export type GeofenceType = 'pickup' | 'delivery' | 'facility' | 'custom'
export type GeofenceTrigger = 'enter' | 'exit' | 'both'

export interface Geofence {
  id: string
  name: string
  geofence_type: GeofenceType
  latitude: number
  longitude: number
  radius_meters: number
  trigger: GeofenceTrigger
  shipment_id?: string
  facility_id?: string
  customer_id?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  is_active: boolean
  created_at: string
}

export interface GeofenceEvent {
  id: string
  geofence_id: string
  shipment_id: string
  event_type: GeofenceTrigger
  event_timestamp: string
  latitude: number
  longitude: number
  alert_sent: boolean
}

// ============================================================================
// Tracking Link Types (Public Portal)
// ============================================================================

export interface TrackingLink {
  id: string
  shipment_id: string
  token: string
  tracking_url: string
  expires_at?: string
  is_active: boolean
  view_count: number
  allow_pod_view: boolean
  allow_document_view: boolean
  show_carrier_info: boolean
  show_pricing: boolean
  created_at: string
}

export interface PublicTracking {
  shipment_number: string
  status: ShipmentStatus
  origin?: string
  destination?: string
  pickup_date?: string
  delivery_date?: string
  eta?: string
  last_location?: string
  last_update?: string
  tracking_events: {
    event_type: string
    timestamp: string
    location?: string
    notes?: string
  }[]
  carrier?: {
    name: string
    mc_number?: string
  }
  customer_price?: number
  pod?: {
    captured_at: string
    received_by?: string
    has_signature: boolean
    photo_count: number
  }
  documents?: {
    id: string
    type: DocumentType
    filename: string
  }[]
}

// ============================================================================
// POD Capture Types
// ============================================================================

export interface PODCapture {
  id: string
  shipment_id: string
  capture_type: 'signature' | 'photo' | 'both'
  signer_name?: string
  signer_title?: string
  received_by?: string
  delivery_notes?: string
  photo_count: number
  captured_at: string
  is_verified: boolean
  has_signature: boolean
}

// ============================================================================
// Exception Types
// ============================================================================

export interface ShipmentException {
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
  details?: Record<string, unknown>
  shipment_id?: string
  shipment_number?: string
}

export interface ExceptionSummary {
  total_exceptions: number
  by_severity: {
    high: number
    medium: number
    low: number
  }
  exceptions: ShipmentException[]
}

// ============================================================================
// Tracking Timeline Types
// ============================================================================

export interface TimelineEvent {
  timestamp?: string
  event_type: string
  title: string
  description?: string
  location?: string
  latitude?: number
  longitude?: number
  is_exception: boolean
  icon: string
}

export interface Milestone {
  status: string
  label: string
  completed: boolean
}

export interface TrackingTimeline {
  shipment_number: string
  status: ShipmentStatus
  milestones: Milestone[]
  timeline: TimelineEvent[]
  current_location?: string
  eta?: string
  pod_captured: boolean
}

// ============================================================================
// GPS Update Types
// ============================================================================

export interface GPSUpdate {
  shipment_id: string
  latitude: number
  longitude: number
  city?: string
  state?: string
  source?: string
}

export interface GPSUpdateResponse {
  tracking_event_id: string
  location?: string
  latitude: number
  longitude: number
  triggered_geofences: {
    geofence_id: string
    geofence_name: string
    geofence_type: GeofenceType
    trigger_type: GeofenceTrigger
    event_id: string
  }[]
  eta?: {
    datetime: string
    distance_miles: number
  }
}

// ============================================================================
// Carrier Portal Types
// ============================================================================

export interface CarrierSession {
  token: string
  carrier_id: string
  carrier_name: string
  expires_at: string
}

export interface AvailableLoad {
  id: string
  shipment_number: string
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  pickup_date?: string
  delivery_date?: string
  equipment_type: string
  weight_lbs?: number
  offered_rate: number
  tender_id: string
  tender_status: string
  posted_at: string
  expires_at?: string
}

export interface CarrierLoad {
  id: string
  shipment_number: string
  status: ShipmentStatus
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  pickup_date?: string
  delivery_date?: string
  equipment_type: string
  weight_lbs?: number
  rate: number
  booked_at: string
}

// ============================================================================
// Customer Portal Types
// ============================================================================

export interface CustomerSession {
  token: string
  customer_id: string
  customer_name: string
  expires_at: string
}

export interface CustomerDashboard {
  customer_name: string
  shipment_counts: {
    total: number
    active: number
    delivered: number
    by_status: Record<string, number>
  }
  recent_shipments: {
    id: string
    shipment_number: string
    status: ShipmentStatus
    created_at: string
  }[]
  invoices: {
    pending_count: number
    total_outstanding: number
  }
}

export interface CustomerShipment {
  id: string
  shipment_number: string
  status: ShipmentStatus
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  pickup_date?: string
  delivery_date?: string
  equipment_type: string
  last_location?: string
  eta?: string
  created_at: string
}

// ============================================================================
// Carrier Onboarding Types
// ============================================================================

export type OnboardingStatus = 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected'

export interface CarrierOnboarding {
  id: string
  access_token: string
  onboarding_url: string
  status: OnboardingStatus
  current_step: number
  progress_percent: number
  company_name: string
  mc_number?: string
  dot_number?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  equipment_types: string[]
  truck_count?: number
  agreement_accepted: boolean
}

// ============================================================================
// Portal Notification Types
// ============================================================================

export interface PortalNotification {
  id: string
  title: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
  shipment_id?: string
  tender_id?: string
  invoice_id?: string
}

// ============================================================================
// AI Communications Types
// ============================================================================

export interface DraftedEmail {
  subject: string
  body: string
  key_points?: string[]
}

export interface CheckCallMessage {
  message?: string
  subject?: string
  body?: string
}

export interface EmailThreadSummary {
  summary: string
  key_points: string[]
  action_items: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  urgency: 'high' | 'medium' | 'low'
}

export interface DetectedExceptionResponse {
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
  shipment_id?: string
  shipment_number?: string
  carrier_id?: string
  carrier_name?: string
  invoice_id?: string
  invoice_number?: string
  tender_id?: string
  data?: Record<string, unknown>
  detected_at?: string
}

export interface ExceptionDetectionSummary {
  total: number
  by_type: Record<string, number>
  by_severity: {
    high: number
    medium: number
    low: number
  }
  exceptions: DetectedExceptionResponse[]
}

export interface CreateWorkItemsResult {
  work_item_ids: string[]
  total_exceptions: number
  work_items_created: number
}

// ============================================================================
// Real-Time Dashboard Types
// ============================================================================

export interface RealtimeMetrics {
  shipments_booked: number
  shipments_pending_pickup: number
  shipments_in_transit: number
  shipments_delivered_today: number
  open_work_items: number
  high_priority_items: number
  overdue_items: number
  pending_quotes: number
  quotes_sent_today: number
  quotes_accepted_today: number
  tenders_pending: number
  tenders_accepted_today: number
  tenders_declined_today: number
  revenue_today: number
  margin_today: number
  margin_percent_today: number
  exception_count: number
  high_severity_exceptions: number
  last_updated: string
}

export interface RecentActivity {
  type: string
  timestamp: string
  shipment_id: string
  detail: string
  location?: string
  notes?: string
}

export interface AtRiskShipment {
  id: string
  shipment_number: string
  status: ShipmentStatus
  risk_reason: string
  pickup_date?: string
  delivery_date?: string
}

export interface UpcomingDelivery {
  id: string
  shipment_number: string
  delivery_date?: string
  status: ShipmentStatus
  last_location?: string
  eta?: string
}

export interface RealtimeDashboard {
  metrics: RealtimeMetrics
  recent_activity: RecentActivity[]
  at_risk_shipments: AtRiskShipment[]
  upcoming_deliveries: UpcomingDelivery[]
  exception_summary: {
    total: number
    by_severity: {
      high: number
      medium: number
      low: number
    }
    by_type: Record<string, number>
  }
}

// ============================================================================
// Approval Types
// ============================================================================

export type ApprovalType = 'rate_override' | 'credit_extension' | 'high_value_shipment' | 'carrier_exception' | 'discount_approval'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved'

export interface Approval {
  id: string
  approval_type: ApprovalType
  status: ApprovalStatus
  title: string
  description?: string
  requested_by?: string
  approved_by?: string
  entity_type: string
  entity_id: string
  amount?: number
  threshold_amount?: number
  metadata?: Record<string, unknown>
  approved_at?: string
  rejected_at?: string
  rejection_reason?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface ApprovalThreshold {
  approval_type: ApprovalType
  max_auto_approve_amount: number
  enabled: boolean
  notify_on_auto_approve: boolean
}

export interface ApprovalSettings {
  thresholds: ApprovalThreshold[]
  created_at: string
  updated_at: string
}

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  rate_override: 'Rate Override',
  credit_extension: 'Credit Extension',
  high_value_shipment: 'High Value Shipment',
  carrier_exception: 'Carrier Exception',
  discount_approval: 'Discount Approval',
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  auto_approved: 'Auto-Approved',
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface OperationsMetrics {
  work_items: { open: number; avg_completion_hours: number; by_type: Record<string, number>; overdue: number }
  quotes: { total: number; win_rate: number; avg_response_hours: number }
  tenders: { acceptance_rate: number; avg_acceptance_hours: number; counter_offer_rate: number }
  period_days: number
}

export interface LaneData {
  origin_state: string
  destination_state: string
  volume: number
  avg_rate: number
  avg_margin: number
  avg_margin_percent: number
  top_carriers: Array<{ carrier_id: string; carrier_name: string; loads: number; on_time_pct: number }>
}

// ============================================================================
// Automation Builder Types
// ============================================================================

export type AutomationTrigger = 'shipment_created' | 'shipment_status_changed' | 'tender_accepted' | 'tender_declined' | 'quote_request_received' | 'work_item_created' | 'invoice_due' | 'check_call_overdue'
export type AutomationAction = 'create_work_item' | 'send_notification' | 'assign_carrier' | 'update_status' | 'create_tender' | 'auto_approve' | 'escalate' | 'send_email'
export type RolloutStage = 'disabled' | 'shadow' | 'partial' | 'full'

export interface AutomationCondition {
  field: string
  operator: string
  value: unknown
}

export interface AutomationRule {
  id: string
  name: string
  description: string
  trigger: AutomationTrigger
  conditions: AutomationCondition[]
  action: AutomationAction
  action_config: Record<string, unknown>
  rollout_stage: RolloutStage
  rollout_percentage: number
  priority: number
  enabled: boolean
  last_triggered_at?: string
  trigger_count: number
  shadow_log: Array<Record<string, unknown>>
  created_at: string
  updated_at: string
}

export interface TestAutomationResult {
  entity_type: string
  entity_id: string
  matched_rules: Array<{
    rule_id: string
    rule_name: string
    trigger: AutomationTrigger
    action: AutomationAction
    action_config: Record<string, unknown>
    conditions_met: boolean
  }>
  actions_that_would_fire: Array<Record<string, unknown>>
  simulation_results: Array<Record<string, unknown>>
}

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  shipment_created: 'Shipment Created',
  shipment_status_changed: 'Shipment Status Changed',
  tender_accepted: 'Tender Accepted',
  tender_declined: 'Tender Declined',
  quote_request_received: 'Quote Request Received',
  work_item_created: 'Work Item Created',
  invoice_due: 'Invoice Due',
  check_call_overdue: 'Check Call Overdue',
}

export const AUTOMATION_ACTION_LABELS: Record<AutomationAction, string> = {
  create_work_item: 'Create Work Item',
  send_notification: 'Send Notification',
  assign_carrier: 'Assign Carrier',
  update_status: 'Update Status',
  create_tender: 'Create Tender',
  auto_approve: 'Auto Approve',
  escalate: 'Escalate',
  send_email: 'Send Email',
}

export const ROLLOUT_STAGE_LABELS: Record<RolloutStage, string> = {
  disabled: 'Disabled',
  shadow: 'Shadow',
  partial: 'Partial',
  full: 'Full',
}

// ============================================================================
// Quote Versioning Types
// ============================================================================

export type QuoteApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected' | 'auto_approved'

export interface QuoteRevisionSnapshot {
  version: number
  revised_at: string
  revised_by?: string
  change_summary?: string
  line_items: QuoteLineItem[]
  total_price: number
  estimated_cost: number
  margin_percent: number
  origin_city?: string
  origin_state?: string
  destination_city?: string
  destination_state?: string
  equipment_type?: string
  weight_lbs?: number
  special_requirements?: string
  internal_notes?: string
}

export interface CustomerPricingApplied {
  rate_table_id?: string
  rate_table_name?: string
  playbook_id?: string
  playbook_name?: string
  discount_percent: number
  contract_rate_per_mile?: number
  contract_flat_rate?: number
  applied_at: string
  auto_applied: boolean
}

export interface QuoteWithVersioning extends Quote {
  version_number: number
  parent_quote_id?: string
  revision_history: QuoteRevisionSnapshot[]
  is_current_version: boolean
  customer_pricing_applied?: CustomerPricingApplied
  approval_status: QuoteApprovalStatus
  approval_required: boolean
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  approval_id?: string
}

// ============================================================================
// Customer Pricing Rule Types
// ============================================================================

export interface CustomerPricingRule {
  rule_name: string
  discount_percent: number
  volume_discount_tiers: { min_shipments: number; discount_pct: number }[]
  contract_rate_per_mile?: number
  contract_flat_rate?: number
  fuel_surcharge_override?: number
  min_margin_percent: number
  auto_apply: boolean
  notes?: string
}

export const QUOTE_APPROVAL_STATUS_LABELS: Record<QuoteApprovalStatus, string> = {
  not_required: 'No Approval Needed',
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  auto_approved: 'Auto-Approved',
}

// ============================================================================
// Billing & Invoicing Types (Batch, Aging, Quick Pay, Factoring, etc.)
// ============================================================================

// Auto-Invoice from POD
export interface AutoInvoiceFromPODResponse {
  id: string
  invoice_number: string
  customer_id: string
  total: number
  accessorial_charges: { type: string; description: string; amount: number }[]
  pod_notes?: string
  due_date?: string
  status: string
  ai_detected_accessorials: string[]
}

// Batch Invoicing
export interface BatchInvoiceResult {
  shipment_id: string
  invoice_id?: string
  invoice_number?: string
  total?: number
  status: string
  message: string
}

export interface BatchInvoiceResponse {
  total_processed: number
  created: number
  skipped: number
  errors: number
  results: BatchInvoiceResult[]
}

// Aging Report
export interface AgingBucket {
  bucket: string
  label: string
  total_amount: number
  count: number
  items: {
    id: string
    invoice_number?: string
    bill_number?: string
    billing_name?: string
    carrier_name?: string
    amount_due?: number
    amount?: number
    due_date?: string
    days_past_due: number
    status: string
  }[]
}

export interface AgingReportResponse {
  report_type: string
  as_of_date: string
  total_outstanding: number
  total_count: number
  buckets: AgingBucket[]
  by_entity: {
    entity_id: string
    entity_name: string
    total_outstanding: number
    invoice_count?: number
    bill_count?: number
    current: number
    [key: string]: unknown
  }[]
}

// Payables Aging
export interface CashFlowProjection {
  week_start: string
  week_end: string
  expected_outflow: number
  bill_count: number
}

export interface PayablesAgingResponse extends AgingReportResponse {
  by_carrier: {
    entity_id: string
    entity_name: string
    total_outstanding: number
    bill_count: number
    current: number
    [key: string]: unknown
  }[]
  cash_flow_projection: CashFlowProjection[]
}

// Quick Pay
export interface QuickPayTier {
  name: string
  days: number
  discount_percent: number
  net_payment: number
}

export interface QuickPayOffer {
  id: string
  carrier_id: string
  carrier_name: string
  bill_id: string
  bill_amount: number
  tiers: QuickPayTier[]
  standard_payment_date?: string
  status: string
  selected_tier?: string
  savings?: number
  created_at?: string
}

// Factoring
export interface FactoringAssignment {
  id: string
  carrier_id: string
  carrier_name: string
  factoring_company_name: string
  factoring_company_id?: string
  noa_reference?: string
  noa_date?: string
  noa_status: string
  payment_email?: string
  fee_percent?: number
  total_factored_amount: number
  factored_invoice_count: number
  created_at?: string
}

// Carrier Invoice Processing
export interface CarrierInvoiceRecord {
  id: string
  carrier_id: string
  carrier_name: string
  shipment_id?: string
  shipment_number?: string
  invoice_number?: string
  extracted_amount?: number
  matched_amount?: number
  variance?: number
  status: string
  match_confidence?: number
  discrepancy_flags: string[]
  created_at?: string
}

// Rate Confirmation Match
export interface RateConfirmationMatchResult {
  shipment_id: string
  shipment_number?: string
  carrier_id?: string
  carrier_name?: string
  rate_con_amount?: number
  carrier_bill_amount?: number
  variance?: number
  variance_percent?: number
  match_status: string
  flags: string[]
  auto_approved: boolean
}

export const AGING_BUCKET_LABELS: Record<string, string> = {
  current: 'Current',
  '1_30': '1-30 Days',
  '31_60': '31-60 Days',
  '61_90': '61-90 Days',
  '91_120': '91-120 Days',
  '120_plus': '120+ Days',
  '90_plus': '90+ Days',
}

export const QUICK_PAY_STATUS_LABELS: Record<string, string> = {
  offered: 'Offered',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
}

export const FACTORING_NOA_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
}

export const CARRIER_INVOICE_STATUS_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  extracted: 'Extracted',
  matched: 'Matched',
  discrepancy: 'Discrepancy',
  approved: 'Approved',
}

export const RATE_MATCH_STATUS_LABELS: Record<string, string> = {
  exact_match: 'Exact Match',
  within_tolerance: 'Within Tolerance',
  over_billed: 'Over-Billed',
  under_billed: 'Under-Billed',
  no_bill: 'No Bill Found',
  no_rate_con: 'No Rate Con',
}

// ============================================================================
// Carrier Capacity Types
// ============================================================================

export interface CapacityPosting {
  id: string
  carrier_id: string
  carrier_name: string
  equipment_type: string
  truck_count: number
  available_date?: string
  origin_city?: string
  origin_state?: string
  origin_radius_miles: number
  destination_city?: string
  destination_state?: string
  destination_radius_miles: number
  notes?: string
  rate_per_mile_target?: number
  expires_at?: string
  is_active: boolean
  ai_matched_loads: number
  created_at: string
}

export interface CapacityHeatmapItem {
  state: string
  total_trucks: number
  posting_count: number
  equipment_types: string[]
}

// ============================================================================
// Counter-Offer & Negotiation Types
// ============================================================================

export interface CounterOffer {
  id: string
  tender_id: string
  round_number: number
  offered_by: 'carrier' | 'broker'
  original_rate: number
  counter_rate: number
  notes?: string
  status: 'pending' | 'accepted' | 'rejected'
  auto_accepted: boolean
  created_at: string
}

export interface NegotiationRecord {
  tender_id: string
  shipment_id: string
  carrier_id: string
  carrier_name: string
  status: TenderStatus
  offered_rate: number
  counter_offer_rate?: number
  final_rate?: number
  origin: string
  destination: string
  lane: string
  counter_offers: CounterOffer[]
  negotiation_rounds: number
  created_at: string
  responded_at?: string
}

export interface NegotiationHistory {
  total_negotiations: number
  accepted_count: number
  average_rounds: number
  total_savings_cents: number
  negotiations: NegotiationRecord[]
}

// ============================================================================
// Waterfall Types
// ============================================================================

export interface WaterfallStep {
  step: number
  carrier_id?: string
  carrier_name: string
  rate: number
  status: 'pending' | 'waiting' | 'accepted' | 'declined' | 'timed_out'
  sent_at?: string
  responded_at?: string
}

export interface WaterfallStatus {
  waterfall_id: string
  shipment_id: string
  status: 'active' | 'completed' | 'cancelled' | 'all_declined'
  current_step: number
  total_carriers: number
  current_rate: number
  base_rate: number
  countdown_seconds: number
  winning_carrier_id?: string
  started_at?: string
  completed_at?: string
  steps: WaterfallStep[]
}

export interface WaterfallConfig {
  timeout_minutes: number
  max_rounds: number
  auto_accept_counter_range_percent: number
  auto_post_to_loadboard: boolean
  carrier_ranking_method: 'ai' | 'performance' | 'rate' | 'manual'
}

// ============================================================================
// Spot Market Types
// ============================================================================

export interface SpotRateData {
  provider: string
  origin: string
  destination: string
  equipment_type: string
  rate_per_mile_low?: number
  rate_per_mile_avg?: number
  rate_per_mile_high?: number
  flat_rate_low?: number
  flat_rate_avg?: number
  flat_rate_high?: number
  load_count?: number
  truck_count?: number
  fetched_at: string
}

export interface ContractRateData {
  rate_table_name: string
  customer_id: string
  rate_per_mile?: number
  flat_rate?: number
  effective_date?: string
  expiration_date?: string
}

export interface SpotRateComparison {
  lane: string
  equipment_type: string
  spot_rates: SpotRateData[]
  contract_rates: ContractRateData[]
  market_average: {
    rate_per_mile: number
    flat_rate: number
  }
  recommendation: 'spot' | 'contract'
}

export interface RateTrendPoint {
  date: string
  provider: string
  rate_per_mile_avg?: number
  rate_per_mile_low?: number
  rate_per_mile_high?: number
  flat_rate_avg?: number
  load_count?: number
  truck_count?: number
}

export interface RateTrends {
  lane: string
  equipment_type: string
  days: number
  data_points: RateTrendPoint[]
  total_points: number
}

// ============================================================================
// Onboarding Dashboard Types
// ============================================================================

export interface OnboardingDashboardItem {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  mc_number?: string
  dot_number?: string
  status: OnboardingStatus
  current_step: number
  total_steps: number
  progress_percent: number
  created_at: string
  updated_at: string
}

export interface OnboardingDashboard {
  total: number
  status_counts: Record<string, number>
  onboardings: OnboardingDashboardItem[]
}

// ============================================================================
// Scheduled Reports Types
// ============================================================================

export interface ScheduledReport {
  id: string
  report_type: string
  report_name: string
  recipients: string[]
  frequency: string
  format: string
  filters?: Record<string, unknown>
  day_of_week?: number
  day_of_month?: number
  time_of_day: string
  timezone: string
  is_active: boolean
  last_sent_at?: string
  next_run_at?: string
  created_at: string
  ai_suggested_defaults?: Record<string, unknown>
}

export interface ReportHistoryEntry {
  id: string
  scheduled_report_id: string
  report_name: string
  generated_at: string
  format: string
  recipients: string[]
  status: string
  download_url?: string
  file_size_bytes?: number
  error_message?: string
}

export const REPORT_TYPE_LABELS: Record<string, string> = {
  margin_report: 'Margin Report',
  shipment_summary: 'Shipment Summary',
  carrier_performance: 'Carrier Performance',
  ar_aging: 'AR Aging',
}

export const REPORT_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export const REPORT_FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  csv: 'CSV',
  excel: 'Excel',
}

// ============================================================================
// Custom Report Builder Types
// ============================================================================

export interface ReportBuildResult {
  columns: string[]
  rows: Record<string, unknown>[]
  total_rows: number
  aggregations?: Record<string, number>
  chart_data?: {
    labels?: string[]
    datasets?: { label: string; data: number[] }[]
    data?: number[]
  }
  generated_at: string
}

export interface SavedReport {
  id: string
  name: string
  description?: string
  config: Record<string, unknown>
  is_shared: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// Customer Profitability Types
// ============================================================================

export interface CustomerProfitabilityDetail {
  customer_id: string
  customer_name: string
  period: string
  total_revenue: number
  cost_breakdown: {
    carrier_cost: number
    accessorial_cost: number
    quick_pay_discount: number
    other_cost: number
    total_cost: number
  }
  total_margin: number
  margin_percent: number
  shipment_count: number
  avg_revenue_per_shipment: number
  avg_margin_per_shipment: number
  trend_direction: 'improving' | 'stable' | 'declining'
  trend_change_percent: number
  monthly_data: {
    month: string
    revenue: number
    cost: number
    margin: number
    margin_percent: number
    shipment_count: number
  }[]
  ai_insights: string[]
}

// ============================================================================
// AI Auto-Assign Types
// ============================================================================

export interface CarrierAssignmentSuggestion {
  carrier_id: string
  carrier_name: string
  confidence_score: number
  reasoning: string[]
  estimated_rate: number
  lane_history_count: number
  on_time_rate: number
  avg_rate_on_lane?: number
  performance_score: number
  meets_insurance_requirements: boolean
  meets_performance_minimum: boolean
}

export interface AutoAssignResult {
  shipment_id: string
  suggestions: CarrierAssignmentSuggestion[]
  auto_assigned: boolean
  assigned_carrier_id?: string
  assigned_carrier_name?: string
  assignment_confidence?: number
  rules_applied: string[]
}

// ============================================================================
// ML Optimization Types
// ============================================================================

export interface PricingOptimization {
  lane: string
  equipment_type: string
  shipment_count: number
  current_avg_carrier_rate: number
  current_avg_customer_rate: number
  suggested_optimal_rate: number
  rate_range: { min: number; max: number }
  current_margin_percent: number
  target_margin_percent: number
  potential_savings_per_shipment: number
  confidence: number
  insights: string[]
  avg_miles: number
}

export interface DelayPrediction {
  shipment_id: string
  shipment_number: string
  origin: string
  destination: string
  status: string
  pickup_date?: string
  delivery_date?: string
  delay_risk_score: number
  risk_level: 'low' | 'medium' | 'high'
  risk_factors: string[]
  recommendations: string[]
  estimated_delay_hours: number
}

// ============================================================================
// Predictive Analytics Types
// ============================================================================

export interface VolumeForecast {
  customer_id?: string
  customer_name: string
  historical_avg_volume: number
  historical_avg_revenue: number
  trend_percent: number
  trend_direction: 'growing' | 'stable' | 'declining'
  historical_data: { year: number; month: number; volume: number; revenue: number }[]
  forecast: { month: string; predicted_volume: number; predicted_revenue: number; confidence: number }[]
}

export interface RateForecast {
  lane: string
  historical_data: { month: string; avg_rate: number; min_rate: number; max_rate: number; volume: number }[]
  current_avg_rate: number
  rate_trend_percent: number
  trend_direction: 'increasing' | 'stable' | 'decreasing'
  forecast: { month: string; predicted_avg_rate: number; confidence: number }[]
  total_volume: number
  insights: string[]
}

// ============================================================================
// DOT Compliance Types
// ============================================================================

export interface DOTCompliance {
  carrier_id: string
  carrier_name: string
  dot_number?: string
  mc_number?: string
  fmcsa_safety_rating?: string
  fmcsa_status?: string
  csa_scores?: Record<string, number>
  authority_status?: string
  insurance_on_file: boolean
  operating_status?: string
  drug_testing_enrolled: boolean
  drug_testing_last_test?: string
  drug_testing_compliant: boolean
  hos_violation_count: number
  inspection_count: number
  out_of_service_rate: number
  crash_count: number
  compliance_alerts: string[]
  last_checked_at?: string
  overall_compliance_score: number
}

// ============================================================================
// Notification Center Types
// ============================================================================

export interface NotificationItem {
  id: string
  user_id: string
  title: string
  message: string
  notification_type: string
  link_url?: string
  is_read: boolean
  created_at: string
}

export interface NotificationCenterData {
  notifications: NotificationItem[]
  unread_count: number
  total_count: number
  categories: Record<string, number>
}

export interface NotificationPreferences {
  email_enabled: boolean
  push_enabled: boolean
  sms_enabled: boolean
  new_quote_request: boolean
  tender_response: boolean
  shipment_status_change: boolean
  exception_alert: boolean
  invoice_due: boolean
  check_call_due: boolean
  document_uploaded: boolean
  approval_needed: boolean
  carrier_update: boolean
  billing_alert: boolean
  edi_transmission: boolean
  load_board_activity: boolean
}

// ============================================================================
// White-Label Branding Types
// ============================================================================

export interface WhiteLabelBranding {
  logo_url?: string
  primary_color: string
  secondary_color: string
  company_name?: string
  favicon_url?: string
  custom_domain?: string
  email_header_logo_url?: string
  portal_title?: string
  hide_powered_by: boolean
}

// ============================================================================
// EDI 210 / 990 Types
// ============================================================================

export interface EDI210Status {
  id: string
  invoice_id: string
  invoice_number?: string
  message_type: string
  status: string
  trading_partner_name?: string
  isa_control_number?: string
  sent_at?: string
  acknowledged_at?: string
  error_messages: string[]
  created_at: string
}

export interface EDI990Status {
  id: string
  tender_id: string
  shipment_number?: string
  message_type: string
  response_type: string
  status: string
  trading_partner_name?: string
  isa_control_number?: string
  sent_at?: string
  acknowledged_at?: string
  error_messages: string[]
  created_at: string
}

// ============================================================================
// QuickBooks Sync Types
// ============================================================================

export interface QuickBooksSyncInvoice {
  status: string
  invoice_id: string
  quickbooks_invoice_id?: string
  quickbooks_invoice_number?: string
  sync_timestamp: string
  amount_synced: number
  customer_name?: string
  message: string
}

export interface QuickBooksSyncStatus {
  connection_status: string
  company_name?: string
  last_sync_at?: string
  sync_summary: {
    customers: { synced: number; pending: number; errors: number }
    invoices: { synced: number; pending: number; errors: number }
    payments: { synced: number; pending: number; errors: number }
    vendors: { synced: number; pending: number; errors: number }
  }
  recent_syncs: {
    id: string
    entity_type: string
    status: string
    synced_at: string
    error?: string
  }[]
  next_scheduled_sync?: string
}

export interface CustomerMapping {
  id: string
  tms_customer_id: string
  tms_customer_name: string
  quickbooks_customer_id: string
  quickbooks_customer_name: string
  last_synced_at?: string
  sync_status: string
  created_at: string
}

// ============================================================================
// Enhanced POD Capture Types
// ============================================================================

export interface EnhancedPODPhoto {
  url: string
  category: string
  annotation?: string
  caption?: string
}

export interface EnhancedPODCaptureRequest {
  signature_data?: string
  signer_name?: string
  signer_title?: string
  photos?: EnhancedPODPhoto[]
  received_by?: string
  recipient_name?: string
  delivery_notes?: string
  latitude?: number
  longitude?: number
  gps_accuracy_meters?: number
  damage_reported?: boolean
  damage_description?: string
  pieces_delivered?: number
  pieces_expected?: number
}

export interface EnhancedPODResponse {
  id: string
  shipment_id: string
  capture_type: string
  signer_name?: string
  signer_title?: string
  received_by?: string
  recipient_name?: string
  delivery_notes?: string
  photo_count: number
  photos?: Record<string, unknown>[]
  captured_at: string
  is_verified: boolean
  has_signature: boolean
  latitude?: number
  longitude?: number
  damage_reported: boolean
  damage_description?: string
  pieces_delivered?: number
  pieces_expected?: number
  pdf_available: boolean
}

export interface PODPdfData {
  status: string
  shipment_id: string
  pod_data: {
    shipment_number: string
    origin: string
    destination: string
    pickup_date: string
    delivery_date: string
    received_by?: string
    signer_name?: string
    delivery_notes?: string
    photo_count: number
    has_signature: boolean
    damage_reported: boolean
    damage_description?: string
    pieces_delivered?: number
    commodity?: string
    weight_lbs?: number
  }
}

// ============================================================================
// Geofence Enhanced Types
// ============================================================================

export interface GeofenceDwellTime {
  geofence_id: string
  geofence_name: string
  shipment_id: string
  arrival_time?: string
  departure_time?: string
  dwell_minutes?: number
  is_currently_inside: boolean
}

export interface GeofenceAnalytics {
  total_events: number
  total_geofences: number
  avg_dwell_minutes?: number
  events_by_type: Record<string, number>
  events_by_geofence: {
    geofence_id: string
    geofence_name: string
    event_count: number
  }[]
  recent_events: {
    event_id: string
    geofence_name: string
    event_type: string
    shipment_id: string
    timestamp: string
  }[]
}

export interface GeofenceAlertConfig {
  alert_dispatcher?: boolean
  alert_customer?: boolean
  alert_carrier?: boolean
  alert_emails?: string[]
  alert_sms_numbers?: string[]
  auto_update_status?: boolean
}

// ============================================================================
// Automated Tracking Types
// ============================================================================

export interface AutoTrackingRequest {
  shipment_id: string
  gps_points: {
    latitude: number
    longitude: number
    timestamp: string
    speed_mph?: number
  }[]
}

export interface AutoTrackingResponse {
  shipment_id: string
  events_generated: number
  detected_states: string[]
  current_state?: string
  next_check_call_at?: string
  eta?: string
  distance_remaining_miles?: number
}

// ============================================================================
// BOL Generation Types
// ============================================================================

export interface BOLGenerationResult {
  status: string
  bol_id: string
  shipment_id: string
  bol_number: string
  bol_data: {
    bol_number: string
    date: string
    shipper: Record<string, unknown>
    consignee: Record<string, unknown>
    carrier: Record<string, unknown>
    shipment_details: Record<string, unknown>
    origin: Record<string, unknown>
    destination: Record<string, unknown>
    special_instructions?: string
    hazmat: boolean
    [key: string]: unknown
  }
  generated_at: string
}

export interface BOLTemplate {
  id: string
  name: string
  customer_id?: string
  template_fields: Record<string, unknown>
  is_default: boolean
  created_at: string
}

// ============================================================================
// Document Classification Types
// ============================================================================

export interface DocumentClassificationResult {
  document_id: string
  original_type?: string
  ai_classified_type: string
  confidence: number
  suggested_workflow?: string
  extracted_fields?: Record<string, unknown>[]
}

// ============================================================================
// Batch Upload Types
// ============================================================================

export interface BatchUploadResult {
  status: string
  total_files: number
  files: {
    id: string
    filename: string
    status: string
    auto_classify: boolean
  }[]
}

// ============================================================================
// Photo/Document Capture Types
// ============================================================================

export type PhotoCategory = 'delivery' | 'damage' | 'bol' | 'loading' | 'unloading' | 'other'

export interface ShipmentPhoto {
  id: string
  category: string
  filename: string
  size_bytes: number
  notes?: string
  annotations: PhotoAnnotation[]
  created_at: string
}

export interface PhotoAnnotation {
  type: string
  x: number
  y: number
  width?: number
  height?: number
  text: string
  color: string
  created_at: string
}

// ============================================================================
// Image Enhancement Types
// ============================================================================

export interface ImageEnhancement {
  rotation_degrees?: number
  crop?: { x: number; y: number; width: number; height: number }
  brightness?: number
  contrast?: number
  auto_deskew?: boolean
}

// ============================================================================
// Customer Tracking Dashboard Types
// ============================================================================

export interface CustomerTrackingShipment {
  id: string
  shipment_number: string
  status: string
  origin_city: string
  origin_state: string
  destination_city: string
  destination_state: string
  pickup_date?: string
  delivery_date?: string
  eta?: string
  eta_confidence?: number
  last_location?: string
  last_update?: string
  latest_event?: {
    event_type: string
    timestamp: string
    location: string
  }
  latitude?: number
  longitude?: number
}

export interface CustomerTrackingDashboard {
  customer_name: string
  active_shipments: CustomerTrackingShipment[]
  active_count: number
  in_transit_count: number
  pending_pickup_count: number
  recent_deliveries: {
    id: string
    shipment_number: string
    delivered_at: string
  }[]
}

export interface CustomerShipmentTrackingDetail {
  shipment_number: string
  status: string
  origin: { city: string; state: string; lat?: number; lng?: number }
  destination: { city: string; state: string; lat?: number; lng?: number }
  eta?: string
  last_location?: string
  route_points: { lat: number; lng: number; timestamp: string }[]
  tracking_events: {
    event_type: string
    timestamp: string
    location: string
    latitude?: number
    longitude?: number
    notes?: string
  }[]
  pod?: {
    captured_at: string
    received_by: string
    has_signature: boolean
    photo_count: number
  }
}

// ============================================================================
// OCR Extraction Types
// ============================================================================

export interface OCRExtractionResult {
  status: string
  document_id: string
  message: string
}

// ============================================================================
// Bulk Load Import Types
// ============================================================================

export interface ColumnMapping {
  csv_column: string
  mapped_field: string
  confidence: number
}

export interface BulkImportPreview {
  filename: string
  total_rows: number
  column_mappings: ColumnMapping[]
  sample_rows: Record<string, string>[]
  unmapped_columns: string[]
  warnings: string[]
}

export interface BulkImportResult {
  total_rows: number
  imported: number
  skipped: number
  errors: { row: number; error: string }[]
  shipment_ids: string[]
}

// ============================================================================
// Split Shipment Types
// ============================================================================

export interface SplitShipmentRequest {
  split_type: 'manual' | 'by_weight' | 'by_stops'
  child_shipments?: {
    stops: Stop[]
    weight_lbs?: number
    commodity?: string
    customer_price?: number
  }[]
  max_weight_per_child?: number
}

export interface SplitShipmentResult {
  parent_shipment_id: string
  child_shipments: {
    id: string
    shipment_number: string
    weight_lbs?: number
    stops: Stop[]
  }[]
}

// ============================================================================
// LTL Consolidation Types
// ============================================================================

export interface ConsolidationSuggestion {
  shipment_ids: string[]
  shipment_numbers: string[]
  shared_origin: string
  shared_destination: string
  total_weight_lbs: number
  combined_price: number
  estimated_savings: number
  confidence: number
}

// ============================================================================
// Recurring Load Template Types
// ============================================================================

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface LoadTemplate {
  id: string
  name: string
  customer_id: string
  customer_name?: string
  stops: Stop[]
  equipment_type: string
  weight_lbs?: number
  commodity?: string
  piece_count?: number
  special_instructions?: string
  customer_price?: number
  carrier_cost?: number
  recurrence_frequency?: RecurrenceFrequency
  recurrence_day?: number
  is_active: boolean
  last_booked_at?: string
  total_bookings: number
  created_at: string
}

// ============================================================================
// Equipment Assignment Types
// ============================================================================

export interface EquipmentItem {
  id: string
  equipment_number: string
  equipment_type: string
  status: 'available' | 'assigned' | 'maintenance' | 'out_of_service'
  carrier_id?: string
  carrier_name?: string
  current_location?: string
  last_inspection_date?: string
  notes?: string
}

export interface EquipmentAssignment {
  shipment_id: string
  trailer_number?: string
  chassis_number?: string
  equipment_type: string
}

// ============================================================================
// Fuel Surcharge Types
// ============================================================================

export interface FuelSurchargeBracket {
  min_price: number
  max_price: number
  surcharge_percent: number
}

export interface FuelSurchargeSchedule {
  id: string
  name: string
  customer_id?: string
  customer_name?: string
  base_fuel_price: number
  brackets: FuelSurchargeBracket[]
  effective_date: string
  is_active: boolean
  created_at: string
}

export interface FuelSurchargeResult {
  current_fuel_price: number
  base_fuel_price: number
  surcharge_percent: number
  surcharge_amount: number
  line_haul: number
  total_with_surcharge: number
  schedule_name?: string
}

// ============================================================================
// Route Optimization Types
// ============================================================================

export interface RouteStop {
  city: string
  state: string
  latitude?: number
  longitude?: number
  stop_type: 'pickup' | 'delivery' | 'stop'
}

export interface OptimizedRoute {
  stops: (RouteStop & {
    sequence: number
    distance_from_previous_miles?: number
    cumulative_distance_miles: number
  })[]
  total_distance_miles: number
  estimated_transit_hours: number
  total_deadhead_miles: number
  optimization_savings_miles: number
}

// ============================================================================
// Driver Location Types
// ============================================================================

export interface DriverLocation {
  driver_id?: string
  driver_name: string
  carrier_id?: string
  carrier_name?: string
  latitude: number
  longitude: number
  city?: string
  state?: string
  heading?: number
  speed_mph?: number
  last_updated: string
  shipment_id?: string
  shipment_number?: string
  shipment_status?: string
  origin?: string
  destination?: string
  eta?: string
  source: string
}

// ============================================================================
// EDI 204 Tender Types
// ============================================================================

export type EDI204TenderStatus = 'received' | 'pending_review' | 'auto_accepted' | 'accepted' | 'rejected' | 'countered'

export interface EDI204Tender {
  id: string
  edi_message_id: string
  trading_partner_id?: string
  trading_partner_name?: string
  status: EDI204TenderStatus
  shipper_name?: string
  origin_city?: string
  origin_state?: string
  destination_city?: string
  destination_state?: string
  pickup_date?: string
  delivery_date?: string
  equipment_type?: string
  weight_lbs?: number
  rate_cents?: number
  reference_numbers: Record<string, string>
  shipment_id?: string
  shipment_number?: string
  rejection_reason?: string
  auto_accept_rule_id?: string
  received_at: string
  responded_at?: string
  created_at: string
}

export interface AutoAcceptRule {
  id: string
  name: string
  trading_partner_id?: string
  origin_states?: string[]
  destination_states?: string[]
  equipment_types?: string[]
  max_weight_lbs?: number
  min_rate_cents?: number
  max_rate_cents?: number
  is_active: boolean
  matches_count: number
  created_at: string
}

export const EDI_204_STATUS_LABELS: Record<EDI204TenderStatus, string> = {
  received: 'Received',
  pending_review: 'Pending Review',
  auto_accepted: 'Auto-Accepted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  countered: 'Countered',
}
