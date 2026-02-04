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
  CarrierPerformance,
  Document,
  DocumentType,
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
  getShipments: (params?: { status?: string; customer_id?: string; carrier_id?: string; at_risk?: boolean; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.customer_id) searchParams.set('customer_id', params.customer_id)
    if (params?.carrier_id) searchParams.set('carrier_id', params.carrier_id)
    if (params?.at_risk !== undefined) searchParams.set('at_risk', String(params.at_risk))
    if (params?.search) searchParams.set('search', params.search)
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

  getCarrierPerformance: (days: number = 30) =>
    request<CarrierPerformance>(`/api/v1/analytics/carrier-performance?days=${days}`),

  // Documents
  getDocuments: (params?: { shipment_id?: string; carrier_id?: string; customer_id?: string; document_type?: DocumentType; needs_review?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    if (params?.carrier_id) searchParams.set('carrier_id', params.carrier_id)
    if (params?.customer_id) searchParams.set('customer_id', params.customer_id)
    if (params?.document_type) searchParams.set('document_type', params.document_type)
    if (params?.needs_review !== undefined) searchParams.set('needs_review', String(params.needs_review))
    const query = searchParams.toString()
    return request<Document[]>(`/api/v1/documents${query ? `?${query}` : ''}`)
  },

  getDocumentsPendingReview: () =>
    request<Document[]>('/api/v1/documents/pending-review'),

  getDocument: (id: string) =>
    request<Document>(`/api/v1/documents/${id}`),

  uploadDocument: async (file: File, data: {
    document_type: DocumentType
    shipment_id?: string
    carrier_id?: string
    customer_id?: string
    description?: string
    auto_process?: boolean
    source?: string
  }) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', data.document_type)
    if (data.shipment_id) formData.append('shipment_id', data.shipment_id)
    if (data.carrier_id) formData.append('carrier_id', data.carrier_id)
    if (data.customer_id) formData.append('customer_id', data.customer_id)
    if (data.description) formData.append('description', data.description)
    if (data.auto_process !== undefined) formData.append('auto_process', String(data.auto_process))
    if (data.source) formData.append('source', data.source)

    const response = await fetch(`${API_BASE}/api/v1/documents/upload`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`)
    }
    return response.json() as Promise<Document>
  },

  processDocument: (id: string) =>
    request<Document>(`/api/v1/documents/${id}/process`, { method: 'POST' }),

  linkDocumentToShipment: (id: string, shipmentId: string) =>
    request<Document>(`/api/v1/documents/${id}/link-shipment?shipment_id=${shipmentId}`, { method: 'POST' }),

  verifyDocument: (id: string) =>
    request<Document>(`/api/v1/documents/${id}/verify`, { method: 'POST' }),

  deleteDocument: (id: string) =>
    request<{ success: boolean }>(`/api/v1/documents/${id}`, { method: 'DELETE' }),

  getDocumentDownloadUrl: (id: string) =>
    `${API_BASE}/api/v1/documents/${id}/download`,

  // Emails
  getEmails: (params?: {
    direction?: string
    category?: string
    shipment_id?: string
    quote_id?: string
    customer_id?: string
    carrier_id?: string
    is_read?: boolean
    is_starred?: boolean
    is_archived?: boolean
    needs_review?: boolean
    search?: string
    limit?: number
    offset?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.direction) searchParams.set('direction', params.direction)
    if (params?.category) searchParams.set('category', params.category)
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    if (params?.quote_id) searchParams.set('quote_id', params.quote_id)
    if (params?.customer_id) searchParams.set('customer_id', params.customer_id)
    if (params?.carrier_id) searchParams.set('carrier_id', params.carrier_id)
    if (params?.is_read !== undefined) searchParams.set('is_read', String(params.is_read))
    if (params?.is_starred !== undefined) searchParams.set('is_starred', String(params.is_starred))
    if (params?.is_archived !== undefined) searchParams.set('is_archived', String(params.is_archived))
    if (params?.needs_review !== undefined) searchParams.set('needs_review', String(params.needs_review))
    if (params?.search) searchParams.set('search', params.search)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const query = searchParams.toString()
    return request<import('../types').EmailMessage[]>(`/api/v1/emails${query ? `?${query}` : ''}`)
  },

  getEmailInbox: (params?: { category?: string; is_read?: boolean; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.is_read !== undefined) searchParams.set('is_read', String(params.is_read))
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return request<import('../types').EmailMessage[]>(`/api/v1/emails/inbox${query ? `?${query}` : ''}`)
  },

  getEmailsNeedingReview: (limit: number = 50) =>
    request<import('../types').EmailMessage[]>(`/api/v1/emails/needs-review?limit=${limit}`),

  getEmailsByShipment: (shipmentId: string) =>
    request<import('../types').EmailMessage[]>(`/api/v1/emails/by-shipment/${shipmentId}`),

  getEmailStats: () =>
    request<import('../types').EmailStats>('/api/v1/emails/stats'),

  getEmail: (id: string) =>
    request<import('../types').EmailMessage>(`/api/v1/emails/${id}`),

  markEmailRead: (id: string) =>
    request<{ status: string }>(`/api/v1/emails/${id}/mark-read`, { method: 'POST' }),

  markEmailUnread: (id: string) =>
    request<{ status: string }>(`/api/v1/emails/${id}/mark-unread`, { method: 'POST' }),

  starEmail: (id: string) =>
    request<{ status: string; is_starred: boolean }>(`/api/v1/emails/${id}/star`, { method: 'POST' }),

  archiveEmail: (id: string) =>
    request<{ status: string }>(`/api/v1/emails/${id}/archive`, { method: 'POST' }),

  linkEmailToShipment: (id: string, shipmentId: string) =>
    request<import('../types').EmailMessage>(`/api/v1/emails/${id}/link-shipment?shipment_id=${shipmentId}`, { method: 'POST' }),

  reclassifyEmail: (id: string) =>
    request<{ status: string }>(`/api/v1/emails/${id}/reclassify`, { method: 'POST' }),

  // Customs
  getCustomsEntries: (params?: { status?: string; shipment_id?: string; entry_type?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    if (params?.entry_type) searchParams.set('entry_type', params.entry_type)
    const query = searchParams.toString()
    return request<import('../types').CustomsEntry[]>(`/api/v1/customs${query ? `?${query}` : ''}`)
  },

  getCustomsEntry: (id: string) =>
    request<import('../types').CustomsEntry>(`/api/v1/customs/${id}`),

  createCustomsEntry: (data: {
    shipment_id?: string
    entry_type?: string
    importer_of_record?: string
    consignee_name?: string
    exporter_name?: string
    port_of_entry?: string
    line_items?: import('../types').CustomsLineItem[]
  }) => request<import('../types').CustomsEntry>('/api/v1/customs', { method: 'POST', body: JSON.stringify(data) }),

  updateCustomsEntry: (id: string, data: Partial<import('../types').CustomsEntry>) =>
    request<import('../types').CustomsEntry>(`/api/v1/customs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  submitCustomsEntry: (id: string) =>
    request<import('../types').CustomsEntry>(`/api/v1/customs/${id}/submit`, { method: 'POST' }),

  clearCustomsEntry: (id: string) =>
    request<import('../types').CustomsEntry>(`/api/v1/customs/${id}/clear`, { method: 'POST' }),

  getCommercialInvoices: (params?: { shipment_id?: string; customs_entry_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    if (params?.customs_entry_id) searchParams.set('customs_entry_id', params.customs_entry_id)
    const query = searchParams.toString()
    return request<import('../types').CommercialInvoice[]>(`/api/v1/customs/invoices${query ? `?${query}` : ''}`)
  },

  createCommercialInvoice: (data: {
    shipment_id?: string
    seller_name: string
    seller_country: string
    buyer_name: string
    buyer_country: string
    country_of_origin: string
    country_of_destination: string
    line_items: import('../types').CustomsLineItem[]
    freight_cents?: number
    insurance_cents?: number
    incoterms?: string
  }) => request<import('../types').CommercialInvoice>('/api/v1/customs/invoices', { method: 'POST', body: JSON.stringify(data) }),

  generateCommercialInvoiceFromShipment: (shipmentId: string) =>
    request<import('../types').CommercialInvoice>(`/api/v1/customs/invoices/from-shipment/${shipmentId}`, { method: 'POST' }),

  // Load Boards
  getLoadBoardCredentials: () =>
    request<import('../types').LoadBoardCredentials[]>('/api/v1/loadboards/credentials'),

  saveLoadBoardCredentials: (data: {
    provider: import('../types').LoadBoardProvider
    username: string
    password?: string
    api_key?: string
    client_id?: string
    client_secret?: string
    company_name?: string
    mc_number?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
  }) =>
    request<import('../types').LoadBoardCredentials>('/api/v1/loadboards/credentials', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  testLoadBoardConnection: (provider: import('../types').LoadBoardProvider) =>
    request<{ success: boolean; error?: string; message?: string }>(
      `/api/v1/loadboards/credentials/${provider}/test`,
      { method: 'POST' }
    ),

  deleteLoadBoardCredentials: (provider: import('../types').LoadBoardProvider) =>
    request<{ message: string }>(`/api/v1/loadboards/credentials/${provider}`, { method: 'DELETE' }),

  getLoadBoardPostings: (params?: { status?: import('../types').PostingStatus; shipment_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    const query = searchParams.toString()
    return request<import('../types').LoadBoardPosting[]>(`/api/v1/loadboards/postings${query ? `?${query}` : ''}`)
  },

  getLoadBoardPosting: (id: string) =>
    request<import('../types').LoadBoardPosting>(`/api/v1/loadboards/postings/${id}`),

  createLoadBoardPosting: (data: {
    shipment_id: string
    providers: import('../types').LoadBoardProvider[]
    origin_city?: string
    origin_state?: string
    destination_city?: string
    destination_state?: string
    equipment_type?: string
    weight_lbs?: number
    pickup_date_start?: string
    posted_rate?: number
    rate_per_mile?: number
    rate_type?: string
    special_instructions?: string
    notes?: string
  }) =>
    request<import('../types').LoadBoardPosting>('/api/v1/loadboards/postings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLoadBoardPosting: (id: string, data: {
    posted_rate?: number
    rate_per_mile?: number
    pickup_date_start?: string
    special_instructions?: string
    notes?: string
  }) =>
    request<import('../types').LoadBoardPosting>(`/api/v1/loadboards/postings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  cancelLoadBoardPosting: (id: string) =>
    request<{ message: string }>(`/api/v1/loadboards/postings/${id}/cancel`, { method: 'POST' }),

  getLoadBoardPostingStats: () =>
    request<import('../types').LoadBoardStats>('/api/v1/loadboards/postings/stats/summary'),

  searchLoadBoardCarriers: (data: {
    origin_city?: string
    origin_state?: string
    origin_radius_miles?: number
    destination_city?: string
    destination_state?: string
    equipment_type?: string
    pickup_date?: string
    providers?: import('../types').LoadBoardProvider[]
    shipment_id?: string
  }) =>
    request<import('../types').CarrierSearch>('/api/v1/loadboards/search/carriers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMarketRates: (params: {
    origin_city: string
    origin_state: string
    destination_city: string
    destination_state: string
    equipment_type?: string
  }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('origin_city', params.origin_city)
    searchParams.set('origin_state', params.origin_state)
    searchParams.set('destination_city', params.destination_city)
    searchParams.set('destination_state', params.destination_state)
    if (params.equipment_type) searchParams.set('equipment_type', params.equipment_type)
    return request<import('../types').RateIndex[]>(`/api/v1/loadboards/rates?${searchParams}`)
  },

  getRateHistory: (params: {
    origin_city: string
    origin_state: string
    destination_city: string
    destination_state: string
    equipment_type?: string
    days?: number
  }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('origin_city', params.origin_city)
    searchParams.set('origin_state', params.origin_state)
    searchParams.set('destination_city', params.destination_city)
    searchParams.set('destination_state', params.destination_state)
    if (params.equipment_type) searchParams.set('equipment_type', params.equipment_type)
    if (params.days) searchParams.set('days', String(params.days))
    return request<{ provider: string; date: string; rate_per_mile_avg: number; flat_rate_avg: number }[]>(
      `/api/v1/loadboards/rates/history?${searchParams}`
    )
  },
}
