import type {
  Customer,
  Carrier,
  QuoteRequest,
  Quote,
  Shipment,
  WorkItem,
  Invoice,
  DashboardStats,
  CarrierSuggestion,
  Tender,
  TrackingEvent,
  MarginDashboard,
} from '../types'

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

export const api = {
  // Health
  getHealth: () => request<{ status: string; database: string }>('/health'),

  // Current User (from identity API)
  getCurrentUser: async () => {
    try {
      const response = await fetch('https://identity-api.ai.devintensive.com/api/v1/me', {
        credentials: 'include',
      })
      if (!response.ok) return null
      return response.json()
    } catch {
      return null
    }
  },

  // Customers
  getCustomers: (params?: { status?: string; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return request<Customer[]>(`/api/v1/customers${query ? `?${query}` : ''}`)
  },
  getCustomer: (id: string) => request<Customer>(`/api/v1/customers/${id}`),
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>('/api/v1/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    request<Customer>(`/api/v1/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Carriers
  getCarriers: (params?: { status?: string; equipment_type?: string; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.equipment_type) searchParams.set('equipment_type', params.equipment_type)
    if (params?.search) searchParams.set('search', params.search)
    const query = searchParams.toString()
    return request<Carrier[]>(`/api/v1/carriers${query ? `?${query}` : ''}`)
  },
  getCarrier: (id: string) => request<Carrier>(`/api/v1/carriers/${id}`),
  createCarrier: (data: Partial<Carrier>) =>
    request<Carrier>('/api/v1/carriers', { method: 'POST', body: JSON.stringify(data) }),
  updateCarrier: (id: string, data: Partial<Carrier>) =>
    request<Carrier>(`/api/v1/carriers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Quote Requests
  getQuoteRequests: (params?: { status?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return request<QuoteRequest[]>(`/api/v1/quote-requests${query ? `?${query}` : ''}`)
  },
  getQuoteRequest: (id: string) => request<QuoteRequest>(`/api/v1/quote-requests/${id}`),
  createQuoteRequest: (data: Partial<QuoteRequest>) =>
    request<QuoteRequest>('/api/v1/quote-requests', { method: 'POST', body: JSON.stringify(data) }),
  extractQuoteRequest: (id: string) =>
    request<QuoteRequest>(`/api/v1/quote-requests/${id}/extract`, { method: 'POST' }),
  createQuoteFromRequest: (id: string) =>
    request<{ quote_id: string; quote_number: string }>(`/api/v1/quote-requests/${id}/create-quote`, { method: 'POST' }),

  // Quotes
  getQuotes: (params?: { status?: string; customer_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.customer_id) searchParams.set('customer_id', params.customer_id)
    const query = searchParams.toString()
    return request<Quote[]>(`/api/v1/quotes${query ? `?${query}` : ''}`)
  },
  getQuote: (id: string) => request<Quote>(`/api/v1/quotes/${id}`),
  createQuote: (data: Partial<Quote>) =>
    request<Quote>('/api/v1/quotes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuote: (id: string, data: Partial<Quote>) =>
    request<Quote>(`/api/v1/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  sendQuote: (id: string, email: string) =>
    request<Quote>(`/api/v1/quotes/${id}/send`, { method: 'POST', body: JSON.stringify({ email }) }),
  bookQuote: (id: string) =>
    request<{ shipment_id: string; shipment_number: string }>(`/api/v1/quotes/${id}/book`, { method: 'POST' }),
  draftQuoteEmail: (id: string) =>
    request<{ email_body: string }>(`/api/v1/quotes/${id}/draft-email`, { method: 'POST' }),

  // Shipments
  getShipments: (params?: { status?: string; customer_id?: string; carrier_id?: string; at_risk?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.customer_id) searchParams.set('customer_id', params.customer_id)
    if (params?.carrier_id) searchParams.set('carrier_id', params.carrier_id)
    if (params?.at_risk !== undefined) searchParams.set('at_risk', String(params.at_risk))
    const query = searchParams.toString()
    return request<Shipment[]>(`/api/v1/shipments${query ? `?${query}` : ''}`)
  },
  getShipment: (id: string) => request<Shipment>(`/api/v1/shipments/${id}`),
  createShipment: (data: Partial<Shipment>) =>
    request<Shipment>('/api/v1/shipments', { method: 'POST', body: JSON.stringify(data) }),
  updateShipment: (id: string, data: Partial<Shipment>) =>
    request<Shipment>(`/api/v1/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  transitionShipment: (id: string, status: string, notes?: string) =>
    request<Shipment>(`/api/v1/shipments/${id}/transition`, { method: 'POST', body: JSON.stringify({ status, notes }) }),
  suggestCarriers: (id: string) =>
    request<CarrierSuggestion[]>(`/api/v1/shipments/${id}/suggest-carriers`, { method: 'POST' }),
  addTrackingEvent: (id: string, data: { event_type?: string; location?: string; location_city?: string; location_state?: string; notes?: string; eta?: string }) =>
    request<TrackingEvent>(`/api/v1/shipments/${id}/tracking`, { method: 'POST', body: JSON.stringify(data) }),
  getShipmentTracking: (id: string) =>
    request<TrackingEvent[]>(`/api/v1/shipments/${id}/tracking`),
  getShipmentTenders: (id: string) =>
    request<Tender[]>(`/api/v1/shipments/${id}/tenders`),

  // Tenders
  createTender: (data: { shipment_id: string; carrier_id: string; offered_rate: number; notes?: string }) =>
    request<Tender>('/api/v1/tenders', { method: 'POST', body: JSON.stringify(data) }),
  sendTender: (id: string) =>
    request<Tender>(`/api/v1/tenders/${id}/send`, { method: 'POST' }),
  acceptTender: (id: string) =>
    request<Tender>(`/api/v1/tenders/${id}/accept`, { method: 'POST' }),
  declineTender: (id: string) =>
    request<Tender>(`/api/v1/tenders/${id}/decline`, { method: 'POST' }),

  // Work Items
  getWorkItems: (params?: { status?: string; work_type?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.work_type) searchParams.set('work_type', params.work_type)
    const query = searchParams.toString()
    return request<WorkItem[]>(`/api/v1/work-items${query ? `?${query}` : ''}`)
  },
  getDashboardStats: () => request<DashboardStats>('/api/v1/work-items/dashboard'),
  completeWorkItem: (id: string, notes?: string) =>
    request<WorkItem>(`/api/v1/work-items/${id}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
  snoozeWorkItem: (id: string, until: string) =>
    request<WorkItem>(`/api/v1/work-items/${id}/snooze`, { method: 'POST', body: JSON.stringify({ until }) }),

  // Invoices
  getInvoices: (params?: { status?: string; customer_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.customer_id) searchParams.set('customer_id', params.customer_id)
    const query = searchParams.toString()
    return request<Invoice[]>(`/api/v1/invoices${query ? `?${query}` : ''}`)
  },
  getInvoice: (id: string) => request<Invoice>(`/api/v1/invoices/${id}`),
  createInvoice: (data: { shipment_id?: string; customer_id?: string }) =>
    request<Invoice>('/api/v1/invoices', { method: 'POST', body: JSON.stringify(data) }),
  createInvoiceFromShipment: (shipmentId: string) =>
    request<Invoice>(`/api/v1/invoices/from-shipment/${shipmentId}`, { method: 'POST' }),
  sendInvoice: (id: string) =>
    request<Invoice>(`/api/v1/invoices/${id}/send`, { method: 'POST' }),
  markInvoicePaid: (id: string) =>
    request<Invoice>(`/api/v1/invoices/${id}/mark-paid`, { method: 'POST' }),
  recordPayment: (id: string, data: { amount: number; payment_date: string; payment_method: string }) =>
    request<Invoice>(`/api/v1/invoices/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),

  // AI
  extractEmail: (data: { subject?: string; body: string; sender_email?: string }) =>
    request<Record<string, { value?: string; confidence: number; evidence_text?: string }>>('/api/v1/ai/extract-email', { method: 'POST', body: JSON.stringify(data) }),

  // Analytics
  getMarginDashboard: (days: number = 30) =>
    request<MarginDashboard>(`/api/v1/analytics/margins?days=${days}`),
}
