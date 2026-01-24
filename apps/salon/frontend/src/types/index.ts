// Authentication
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  salon_id: string;
  staff_id?: string;
  is_active: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// Salon
export interface BusinessHours {
  open: string;
  close: string;
  is_closed: boolean;
}

export interface CancellationPolicy {
  free_cancellation_hours: number;
  late_cancellation_fee_percent: number;
  no_show_fee_percent: number;
  no_show_window_minutes: number;
}

export interface SalonSettings {
  slot_duration_minutes: number;
  min_booking_notice_hours: number;
  max_booking_advance_days: number;
  require_deposit: boolean;
  deposit_percent: number;
  business_hours: Record<string, BusinessHours>;
  cancellation_policy: CancellationPolicy;
}

export interface Salon {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  timezone: string;
  stripe_account_id?: string;
  stripe_onboarding_complete: boolean;
  settings: SalonSettings;
  is_active: boolean;
}

// Staff
export interface TimeSlot {
  start: string;
  end: string;
}

export interface DaySchedule {
  is_working: boolean;
  slots: TimeSlot[];
}

export interface WorkingHours {
  schedule: Record<string, DaySchedule>;
}

export interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  display_name?: string;
  color: string;
  avatar_url?: string;
  working_hours: WorkingHours;
  is_active: boolean;
  service_ids: string[];
  sort_order: number;
}

export interface StaffCreate {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  display_name?: string;
  color?: string;
  service_ids?: string[];
}

// Services
export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  name: string;
  category_id?: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes: number;
  price: number;
  price_display: string;
  deposit_override?: number;
  color?: string;
  sort_order: number;
  is_active: boolean;
  eligible_staff_ids: string[];
}

export interface ServiceCreate {
  name: string;
  category_id?: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes?: number;
  price: number;
  deposit_override?: number;
  color?: string;
  eligible_staff_ids?: string[];
}

// Clients
export interface ClientStats {
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  no_shows: number;
  total_spent: number;
  last_visit?: string;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone?: string;
  notes?: string;
  preferences?: string;
  tags: string[];
  stats: ClientStats;
  stripe_customer_id?: string;
  has_payment_method: boolean;
  created_at: string;
  // New fields
  avatar_url?: string;
  language?: string;
  birthday?: string;
  allergies?: string;
  color_formula?: string;
  referral_source?: string;
}

export interface ClientCreate {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  notes?: string;
  preferences?: string;
  tags?: string[];
  language?: string;
  birthday?: string;
  allergies?: string;
  color_formula?: string;
  referral_source?: string;
}

// Appointments
export type AppointmentStatus =
  | 'pending_deposit'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface PaymentSnapshot {
  service_price: number;
  deposit_amount: number;
  deposit_percent: number;
}

export interface Appointment {
  id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  payment: PaymentSnapshot;
  deposit_captured: boolean;
  notes?: string;
  internal_notes?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  version: number;
  created_at: string;
  updated_at: string;
  // Expanded fields
  client_name?: string;
  staff_name?: string;
  service_name?: string;
}

export interface AppointmentCreate {
  client_id: string;
  staff_id: string;
  service_id: string;
  start_time: string;
  notes?: string;
  payment_method_id?: string;
}

export interface SlotLock {
  lock_id: string;
  expires_at: string;
}

// Calendar
export interface StaffCalendarDay {
  staff_id: string;
  date: string;
  working_hours: TimeSlot[];
  appointments: Appointment[];
  is_working: boolean;
}

export interface CalendarResponse {
  start_date: string;
  end_date: string;
  staff: Staff[];
  days: Record<string, StaffCalendarDay[]>;
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  staff_id: string;
  staff_name: string;
}

export interface AvailabilityResponse {
  date: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  slots: AvailableSlot[];
}

// Waitlist
export type WaitlistStatus = 'active' | 'notified' | 'booked' | 'expired' | 'cancelled';

export interface AvailabilityPreference {
  preferred_staff_ids: string[];
  any_staff_ok: boolean;
  preferred_days: number[];
  preferred_time_ranges: { start: string; end: string }[];
  morning_ok: boolean;
  afternoon_ok: boolean;
  evening_ok: boolean;
  is_urgent: boolean;
  flexible: boolean;
  earliest_date?: string;
  latest_date?: string;
}

export interface WaitlistEntry {
  id: string;
  client_id: string;
  client_name: string;
  service_id: string;
  service_name: string;
  availability_description: string;
  preferences: AvailabilityPreference;
  status: WaitlistStatus;
  notification_count: number;
  last_notified_at?: string;
  offered_slots: {
    staff_id: string;
    staff_name: string;
    start_time: string;
    offered_at: string;
  }[];
  created_at: string;
  expires_at?: string;
}

export interface WaitlistCreate {
  client_id: string;
  service_id: string;
  availability_description: string;
  preferred_staff_id?: string;
  expires_in_days?: number;
}

export interface AvailabilityMatch {
  waitlist_entry_id: string;
  client_id: string;
  client_name: string;
  client_phone?: string;
  client_language: string;
  service_id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  start_time: string;
  end_time: string;
  match_reason: string;
}

// Promotions
export type PromotionType = 'birthday' | 'referral' | 'new_client' | 'loyalty' | 'seasonal' | 'custom';
export type DiscountType = 'percentage' | 'fixed' | 'free_service';

export interface Promotion {
  id: string;
  salon_id: string;
  name: string;
  description?: string;
  promotion_type: PromotionType;
  discount_type: DiscountType;
  discount_value: number;
  free_service_id?: string;
  applicable_service_ids: string[];
  applicable_staff_ids: string[];
  min_purchase_amount: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  max_uses?: number;
  max_uses_per_client: number;
  current_uses: number;
  code?: string;
  requires_code: boolean;
  birthday_days_before: number;
  birthday_days_after: number;
  created_at: string;
  updated_at: string;
}

export interface PromotionCreate {
  name: string;
  description?: string;
  promotion_type: PromotionType;
  discount_type: DiscountType;
  discount_value: number;
  free_service_id?: string;
  applicable_service_ids?: string[];
  applicable_staff_ids?: string[];
  min_purchase_amount?: number;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  max_uses?: number;
  max_uses_per_client?: number;
  code?: string;
  requires_code?: boolean;
  birthday_days_before?: number;
  birthday_days_after?: number;
}

export interface PromotionCheckResult {
  promotion_id: string;
  promotion_name: string;
  promotion_type: PromotionType;
  discount_type: DiscountType;
  discount_value: number;
  discount_display: string;
  reason: string;
  auto_apply: boolean;
}

// Schedule Override
export interface ScheduleOverride {
  id: string;
  date: string;
  override_type: 'day_off' | 'custom_hours' | 'vacation';
  reason?: string;
  custom_hours?: TimeSlot[];
  created_at: string;
}
