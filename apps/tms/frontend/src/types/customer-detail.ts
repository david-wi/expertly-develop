// Types for the enhanced customer detail page

export interface CustomerContactRecord {
  id: string
  customer_id: string
  name: string
  title?: string
  email?: string
  phone?: string
  is_primary: boolean
  department?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CustomerFacility {
  id: string
  customer_id?: string
  name: string
  facility_type: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  zip_code: string
  country: string
  full_address: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  hours: { day: string; open_time?: string; close_time?: string; closed: boolean }[]
  dock_hours?: string
  special_instructions?: string
  appointment_required: boolean
  has_dock: boolean
  has_forklift: boolean
  created_at: string
  updated_at: string
}

export interface PricingPlaybook {
  id: string
  customer_id: string
  name: string
  origin_state?: string
  dest_state?: string
  equipment_type?: string
  base_rate: number
  fuel_surcharge_pct: number
  min_rate: number
  max_rate: number
  effective_date?: string
  expiry_date?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
