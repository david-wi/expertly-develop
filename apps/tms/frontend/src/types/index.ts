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
