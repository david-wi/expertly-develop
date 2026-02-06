// Types for the enhanced carrier detail page

export type InsuranceType = 'cargo' | 'liability' | 'auto' | 'workers_comp'
export type ComplianceType = 'authority' | 'safety_rating' | 'drug_testing' | 'hazmat_cert'
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'pending' | 'expired'

export interface CarrierInsurance {
  id: string
  carrier_id: string
  insurance_type: InsuranceType
  provider?: string
  policy_number?: string
  coverage_amount: number
  effective_date?: string
  expiry_date?: string
  is_current: boolean
  days_until_expiry?: number
  created_at: string
  updated_at: string
}

export interface CarrierComplianceRecord {
  id: string
  carrier_id: string
  compliance_type: ComplianceType
  status: ComplianceStatus
  details?: string
  verified_at?: string
  expires_at?: string
  days_until_expiry?: number
  created_at: string
  updated_at: string
}

export interface ComplianceStatusSummary {
  carrier_id: string
  overall_status: 'compliant' | 'at_risk' | 'non_compliant'
  insurance_count: number
  compliance_count: number
  expiring_soon: number
  expired: number
  non_compliant: number
  issues: string[]
}

export interface ComplianceCheckResult {
  carrier_id: string
  checked_at: string
  issues: string[]
  warnings: string[]
  expiring_insurance: CarrierInsurance[]
  expired_compliance: CarrierComplianceRecord[]
  missing_records: string[]
}

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  cargo: 'Cargo',
  liability: 'General Liability',
  auto: 'Auto',
  workers_comp: "Workers' Comp",
}

export const COMPLIANCE_TYPE_LABELS: Record<ComplianceType, string> = {
  authority: 'Operating Authority',
  safety_rating: 'Safety Rating',
  drug_testing: 'Drug Testing',
  hazmat_cert: 'Hazmat Certification',
}

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  compliant: 'Compliant',
  non_compliant: 'Non-Compliant',
  pending: 'Pending',
  expired: 'Expired',
}
