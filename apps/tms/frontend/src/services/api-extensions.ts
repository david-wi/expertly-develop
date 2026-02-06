/**
 * API extension methods for customer detail and carrier detail pages.
 * These are temporary until integrated into the main api.ts file.
 */
import type {
  CustomerContactRecord,
  CustomerFacility,
  PricingPlaybook,
} from '../types/customer-detail'
import type {
  CarrierInsurance,
  CarrierComplianceRecord,
  ComplianceStatusSummary,
  ComplianceCheckResult,
} from '../types/carrier-detail'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

export const apiExtensions = {
  // Customer Contacts
  getCustomerContacts: (customerId: string) =>
    request<CustomerContactRecord[]>(`/api/v1/customers/${customerId}/contacts`),

  createCustomerContact: (customerId: string, data: Partial<CustomerContactRecord>) =>
    request<CustomerContactRecord>(`/api/v1/customers/${customerId}/contacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomerContact: (customerId: string, contactId: string, data: Partial<CustomerContactRecord>) =>
    request<CustomerContactRecord>(`/api/v1/customers/${customerId}/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCustomerContact: (customerId: string, contactId: string) =>
    request<{ success: boolean }>(`/api/v1/customers/${customerId}/contacts/${contactId}`, {
      method: 'DELETE',
    }),

  // Customer Facilities
  getCustomerFacilities: (customerId: string) =>
    request<CustomerFacility[]>(`/api/v1/customers/${customerId}/facilities`),

  createCustomerFacility: (customerId: string, data: Partial<CustomerFacility>) =>
    request<CustomerFacility>(`/api/v1/customers/${customerId}/facilities`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomerFacility: (customerId: string, facilityId: string, data: Partial<CustomerFacility>) =>
    request<CustomerFacility>(`/api/v1/customers/${customerId}/facilities/${facilityId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCustomerFacility: (customerId: string, facilityId: string) =>
    request<{ success: boolean }>(`/api/v1/customers/${customerId}/facilities/${facilityId}`, {
      method: 'DELETE',
    }),

  // Pricing Playbooks
  getCustomerPlaybooks: (customerId: string) =>
    request<PricingPlaybook[]>(`/api/v1/customers/${customerId}/playbooks`),

  createCustomerPlaybook: (customerId: string, data: Partial<PricingPlaybook>) =>
    request<PricingPlaybook>(`/api/v1/customers/${customerId}/playbooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomerPlaybook: (customerId: string, playbookId: string, data: Partial<PricingPlaybook>) =>
    request<PricingPlaybook>(`/api/v1/customers/${customerId}/playbooks/${playbookId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCustomerPlaybook: (customerId: string, playbookId: string) =>
    request<{ success: boolean }>(`/api/v1/customers/${customerId}/playbooks/${playbookId}`, {
      method: 'DELETE',
    }),

  matchCustomerPlaybook: (customerId: string, params: { origin_state?: string; dest_state?: string; equipment_type?: string }) => {
    const searchParams = new URLSearchParams()
    if (params.origin_state) searchParams.set('origin_state', params.origin_state)
    if (params.dest_state) searchParams.set('dest_state', params.dest_state)
    if (params.equipment_type) searchParams.set('equipment_type', params.equipment_type)
    const query = searchParams.toString()
    return request<PricingPlaybook | null>(`/api/v1/customers/${customerId}/playbooks/match${query ? `?${query}` : ''}`)
  },

  // Carrier Insurance
  getCarrierInsurance: (carrierId: string) =>
    request<CarrierInsurance[]>(`/api/v1/carriers/${carrierId}/insurance`),

  createCarrierInsurance: (carrierId: string, data: Partial<CarrierInsurance>) =>
    request<CarrierInsurance>(`/api/v1/carriers/${carrierId}/insurance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Carrier Compliance
  getCarrierCompliance: (carrierId: string) =>
    request<CarrierComplianceRecord[]>(`/api/v1/carriers/${carrierId}/compliance`),

  createCarrierCompliance: (carrierId: string, data: Partial<CarrierComplianceRecord>) =>
    request<CarrierComplianceRecord>(`/api/v1/carriers/${carrierId}/compliance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCarrierComplianceStatus: (carrierId: string) =>
    request<ComplianceStatusSummary>(`/api/v1/carriers/${carrierId}/compliance/status`),

  runCarrierComplianceCheck: (carrierId: string) =>
    request<ComplianceCheckResult>(`/api/v1/carriers/${carrierId}/compliance/check`, {
      method: 'POST',
    }),
}
