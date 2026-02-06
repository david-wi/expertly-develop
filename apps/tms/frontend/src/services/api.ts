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
  Desk,
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
      const response = await fetch('https://identity-api.ai.devintensive.com/api/v1/auth/me', {
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

  // Accounting / QuickBooks
  getAccountingConnection: () =>
    request<import('../types').AccountingConnection>('/api/v1/accounting/connection'),

  getQuickBooksAuthUrl: () =>
    request<{ url: string; state: string }>('/api/v1/accounting/connect/quickbooks'),

  disconnectQuickBooks: () =>
    request<{ status: string }>('/api/v1/accounting/disconnect', { method: 'POST' }),

  updateAccountingSettings: (data: {
    auto_sync_enabled?: boolean
    sync_interval_minutes?: number
    sync_customers?: boolean
    sync_invoices?: boolean
    sync_payments?: boolean
    sync_vendors?: boolean
    sync_bills?: boolean
    revenue_account_id?: string
    revenue_account_name?: string
    expense_account_id?: string
    expense_account_name?: string
  }) =>
    request<import('../types').AccountingConnection>('/api/v1/accounting/connection', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  triggerAccountingSync: (data: { full_sync?: boolean; entity_types?: string[] }) =>
    request<import('../types').SyncJob>('/api/v1/accounting/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  syncSingleEntity: (data: { entity_type: string; entity_id: string }) =>
    request<import('../types').SyncLogEntry>('/api/v1/accounting/sync/entity', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSyncJobs: (params?: { status?: import('../types').SyncStatus; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return request<import('../types').SyncJob[]>(`/api/v1/accounting/sync/jobs${query ? `?${query}` : ''}`)
  },

  getSyncJob: (id: string) =>
    request<import('../types').SyncJob>(`/api/v1/accounting/sync/jobs/${id}`),

  getSyncJobLogs: (id: string) =>
    request<import('../types').SyncLogEntry[]>(`/api/v1/accounting/sync/jobs/${id}/logs`),

  getAccountingMappings: (params?: { entity_type?: import('../types').AccountingEntityType }) => {
    const searchParams = new URLSearchParams()
    if (params?.entity_type) searchParams.set('entity_type', params.entity_type)
    const query = searchParams.toString()
    return request<import('../types').AccountingMapping[]>(`/api/v1/accounting/mappings${query ? `?${query}` : ''}`)
  },

  deleteAccountingMapping: (id: string) =>
    request<{ status: string }>(`/api/v1/accounting/mappings/${id}`, { method: 'DELETE' }),

  getAccountingStats: () =>
    request<import('../types').AccountingStats>('/api/v1/accounting/stats'),

  // ============================================================================
  // Enhanced Tracking
  // ============================================================================

  // GPS Location Updates
  updateGPSLocation: (data: import('../types').GPSUpdate) =>
    request<import('../types').GPSUpdateResponse>('/api/v1/tracking/gps-update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Geofences
  getGeofences: (params?: { shipment_id?: string; facility_id?: string; is_active?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    if (params?.facility_id) searchParams.set('facility_id', params.facility_id)
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
    const query = searchParams.toString()
    return request<import('../types').Geofence[]>(`/api/v1/tracking/geofences${query ? `?${query}` : ''}`)
  },

  createGeofence: (data: {
    name: string
    geofence_type?: import('../types').GeofenceType
    latitude: number
    longitude: number
    radius_meters?: number
    trigger?: import('../types').GeofenceTrigger
    shipment_id?: string
    facility_id?: string
    customer_id?: string
    address?: string
    city?: string
    state?: string
    zip_code?: string
    alert_email?: string
    alert_webhook_url?: string
    alert_push?: boolean
  }) => request<import('../types').Geofence>('/api/v1/tracking/geofences', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  deleteGeofence: (id: string) =>
    request<{ status: string }>(`/api/v1/tracking/geofences/${id}`, { method: 'DELETE' }),

  toggleGeofence: (id: string) =>
    request<{ is_active: boolean }>(`/api/v1/tracking/geofences/${id}/toggle`, { method: 'PATCH' }),

  // Tracking Links (Public Portal)
  createTrackingLink: (data: {
    shipment_id: string
    customer_id?: string
    expires_in_days?: number
    allow_pod_view?: boolean
    allow_document_view?: boolean
    show_carrier_info?: boolean
    show_pricing?: boolean
  }) => request<import('../types').TrackingLink>('/api/v1/tracking/links', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getShipmentTrackingLinks: (shipmentId: string) =>
    request<import('../types').TrackingLink[]>(`/api/v1/tracking/links/shipment/${shipmentId}`),

  getPublicTracking: (token: string) =>
    request<import('../types').PublicTracking>(`/api/v1/tracking/public/${token}`),

  deactivateTrackingLink: (id: string) =>
    request<{ status: string }>(`/api/v1/tracking/links/${id}`, { method: 'DELETE' }),

  // POD Capture
  capturePOD: (data: {
    shipment_id: string
    signature_data?: string
    signer_name?: string
    signer_title?: string
    photo_urls?: string[]
    received_by?: string
    delivery_notes?: string
    latitude?: number
    longitude?: number
  }) => request<import('../types').PODCapture>('/api/v1/tracking/pod', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getShipmentPOD: (shipmentId: string) =>
    request<import('../types').PODCapture | null>(`/api/v1/tracking/pod/shipment/${shipmentId}`),

  verifyPOD: (podId: string, verifiedBy?: string) =>
    request<{ status: string }>(`/api/v1/tracking/pod/${podId}/verify?verified_by=${verifiedBy || 'system'}`, {
      method: 'POST',
    }),

  // Exception Detection
  getShipmentExceptions: (shipmentId: string) =>
    request<import('../types').ShipmentException[]>(`/api/v1/tracking/exceptions/shipment/${shipmentId}`),

  getAllExceptions: () =>
    request<import('../types').ExceptionSummary>('/api/v1/tracking/exceptions/all'),

  // Tracking Timeline
  getTrackingTimeline: (shipmentId: string) =>
    request<import('../types').TrackingTimeline>(`/api/v1/tracking/timeline/${shipmentId}`),

  // ============================================================================
  // Carrier Portal
  // ============================================================================

  carrierPortal: {
    requestAccess: (email: string) =>
      request<{ message: string; email: string }>('/api/v1/carrier-portal/auth/request-access', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    verify: (email: string, code: string) =>
      request<import('../types').CarrierSession>('/api/v1/carrier-portal/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }),

    logout: (token: string) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    getAvailableLoads: (token: string) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/loads/available`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<import('../types').AvailableLoad[]>,

    respondToTender: (token: string, data: { tender_id: string; accept: boolean; counter_rate?: number; decline_reason?: string }) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/tenders/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }).then(r => r.json()),

    getMyLoads: (token: string, status?: string) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/loads/my-loads${status ? `?status=${status}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<import('../types').CarrierLoad[]>,

    getLoadDetail: (token: string, shipmentId: string) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/loads/${shipmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    updateTracking: (token: string, data: { shipment_id: string; event_type: string; location_city?: string; location_state?: string; notes?: string }) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/tracking/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }).then(r => r.json()),

    getNotifications: (token: string, unreadOnly?: boolean) =>
      fetch(`${API_BASE}/api/v1/carrier-portal/notifications${unreadOnly ? '?unread_only=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<import('../types').PortalNotification[]>,

    // Onboarding
    startOnboarding: (data: { company_name: string; contact_name: string; contact_email: string; mc_number?: string; dot_number?: string }) =>
      request<import('../types').CarrierOnboarding>('/api/v1/carrier-portal/onboarding/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getOnboarding: (token: string) =>
      request<import('../types').CarrierOnboarding>(`/api/v1/carrier-portal/onboarding/${token}`),

    updateOnboarding: (token: string, step: number, data: Record<string, unknown>) =>
      request<{ status: string; next_step: number }>(`/api/v1/carrier-portal/onboarding/${token}`, {
        method: 'PATCH',
        body: JSON.stringify({ step, data }),
      }),

    submitOnboarding: (token: string) =>
      request<{ status: string; message: string }>(`/api/v1/carrier-portal/onboarding/${token}/submit`, {
        method: 'POST',
      }),
  },

  // ============================================================================
  // Customer Portal
  // ============================================================================

  customerPortal: {
    requestAccess: (email: string) =>
      request<{ message: string; email: string }>('/api/v1/customer-portal/auth/request-access', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    verify: (email: string, code: string) =>
      request<import('../types').CustomerSession>('/api/v1/customer-portal/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      }),

    logout: (token: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    getDashboard: (token: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<import('../types').CustomerDashboard>,

    getShipments: (token: string, params?: { status?: string; search?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.status) searchParams.set('status', params.status)
      if (params?.search) searchParams.set('search', params.search)
      const query = searchParams.toString()
      return fetch(`${API_BASE}/api/v1/customer-portal/shipments${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<import('../types').CustomerShipment[]>
    },

    getShipmentDetail: (token: string, shipmentId: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/shipments/${shipmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    getShipmentDocuments: (token: string, shipmentId: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/shipments/${shipmentId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    getQuotes: (token: string, status?: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/quotes${status ? `?status=${status}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    getQuoteDetail: (token: string, quoteId: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/quotes/${quoteId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    acceptQuote: (token: string, quoteId: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/quotes/${quoteId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    getInvoices: (token: string, status?: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/invoices${status ? `?status=${status}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    getInvoiceDetail: (token: string, invoiceId: string) =>
      fetch(`${API_BASE}/api/v1/customer-portal/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),

    createQuoteRequest: (token: string, data: {
      origin_city: string
      origin_state: string
      destination_city: string
      destination_state: string
      pickup_date?: string
      equipment_type?: string
      weight_lbs?: number
      commodity?: string
    }) =>
      fetch(`${API_BASE}/api/v1/customer-portal/quote-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }).then(r => r.json()),

    getNotifications: (token: string, unreadOnly?: boolean) =>
      fetch(`${API_BASE}/api/v1/customer-portal/notifications${unreadOnly ? '?unread_only=true' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()) as Promise<import('../types').PortalNotification[]>,
  },

  // ============================================================================
  // Automation
  // ============================================================================

  automation: {
    // Tender Waterfall
    createWaterfall: (data: {
      shipment_id: string
      carrier_ids: string[]
      offered_rate: number
      timeout_minutes?: number
      auto_escalate?: boolean
      rate_increase_percent?: number
      notes?: string
    }) => request<{ waterfall_id: string; status: string; total_carriers: number }>('/api/v1/automation/waterfall', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    getWaterfallStatus: (waterfallId: string) =>
      request<{
        waterfall_id: string
        shipment_id: string
        status: string
        current_step: number
        total_carriers: number
        current_rate: number
        base_rate: number
        history: { step: number; carrier_name: string; rate: number; status: string; sent_at?: string }[]
        started_at: string
        completed_at?: string
        winning_carrier_id?: string
      }>(`/api/v1/automation/waterfall/${waterfallId}`),

    cancelWaterfall: (waterfallId: string, reason?: string) =>
      request<{ status: string }>(`/api/v1/automation/waterfall/${waterfallId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    // Auto Assignment
    createAssignmentRule: (data: {
      name: string
      rule_type: string
      priority?: number
      conditions?: Record<string, unknown>
      actions?: Record<string, unknown>
    }) => request<{ rule_id: string; status: string }>('/api/v1/automation/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    getAssignmentRules: () =>
      request<{ _id: string; name: string; rule_type: string; priority: number; conditions: Record<string, unknown>; actions: Record<string, unknown> }[]>('/api/v1/automation/rules'),

    deleteAssignmentRule: (ruleId: string) =>
      request<{ status: string }>(`/api/v1/automation/rules/${ruleId}`, { method: 'DELETE' }),

    autoAssignShipment: (shipmentId: string, options?: { use_waterfall?: boolean; timeout_minutes?: number; max_carriers?: number }) => {
      const params = new URLSearchParams()
      if (options?.use_waterfall !== undefined) params.set('use_waterfall', String(options.use_waterfall))
      if (options?.timeout_minutes) params.set('timeout_minutes', String(options.timeout_minutes))
      if (options?.max_carriers) params.set('max_carriers', String(options.max_carriers))
      const query = params.toString()
      return request<{ status: string; waterfall_id?: string; tender_id?: string; carrier_id?: string; assignment_method?: string }>(
        `/api/v1/automation/auto-assign/${shipmentId}${query ? `?${query}` : ''}`,
        { method: 'POST' }
      )
    },

    evaluateRulesForShipment: (shipmentId: string) =>
      request<{ carrier_id: string; carrier_name: string; score: number; rules: string[] }[]>(`/api/v1/automation/auto-assign/evaluate/${shipmentId}`),

    // Invoice Automation
    createInvoiceFromShipment: (shipmentId: string, autoSend?: boolean) =>
      request<{ status: string; invoice_id?: string; invoice_number?: string; total?: number }>(
        `/api/v1/automation/invoices/from-shipment/${shipmentId}?auto_send=${autoSend || false}`,
        { method: 'POST' }
      ),

    batchCreateInvoices: (shipmentIds: string[], consolidate?: boolean) =>
      request<{ status: string; count?: number; invoice_id?: string; results?: unknown[] }>('/api/v1/automation/invoices/batch', {
        method: 'POST',
        body: JSON.stringify({ shipment_ids: shipmentIds, consolidate }),
      }),

    // Document Classification
    classifyDocument: (documentId: string) =>
      request<{ status: string; document_id: string }>(`/api/v1/automation/documents/classify/${documentId}`, {
        method: 'POST',
      }),

    // Status
    getAutomationStatus: () =>
      request<{
        pending_document_classification: number
        unassigned_shipments: number
        delivered_without_invoice: number
        active_waterfalls: number
        timestamp: string
      }>('/api/v1/automation/jobs/status'),

    runAllAutomations: () =>
      request<{ status: string; message: string }>('/api/v1/automation/jobs/run-all', { method: 'POST' }),
  },

  // ============================================================================
  // Push Notifications
  // ============================================================================

  savePushSubscription: (subscription: PushSubscriptionJSON) =>
    request<{ status: string }>('/api/v1/notifications/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),

  removePushSubscription: () =>
    request<{ status: string }>('/api/v1/notifications/push/unsubscribe', {
      method: 'DELETE',
    }),

  sendPushNotification: (data: {
    title: string
    body: string
    url?: string
    user_ids?: string[]
    data?: Record<string, unknown>
  }) => request<{ status: string; sent: number }>('/api/v1/notifications/push/send', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // ============================================================================
  // In-App Notifications
  // ============================================================================

  getNotificationsForUser: (userId: string, unreadOnly?: boolean) =>
    request<{
      id: string
      user_id: string
      title: string
      message: string
      notification_type: string
      link_url?: string
      is_read: boolean
      created_at: string
    }[]>(`/api/v1/notifications?user_id=${userId}${unreadOnly ? '&unread_only=true' : ''}`),

  markNotificationRead: (notificationId: string) =>
    request<{ status: string }>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: (userId: string) =>
    request<{ status: string }>(`/api/v1/notifications/mark-all-read?user_id=${userId}`, {
      method: 'POST',
    }),

  getNotificationPreferences: (userId: string) =>
    request<{
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
    }>(`/api/v1/notifications/preferences/${userId}`),

  updateNotificationPreferences: (userId: string, prefs: Record<string, boolean>) =>
    request<Record<string, boolean>>(`/api/v1/notifications/preferences/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),

  // ============================================================================
  // AI Communications
  // ============================================================================

  draftQuoteEmailFromQuote: (quoteId: string, tone: string = 'professional') =>
    request<{
      subject: string
      body: string
      key_points?: string[]
    }>('/api/v1/ai/communications/draft-quote-email', {
      method: 'POST',
      body: JSON.stringify({ quote_id: quoteId, tone }),
    }),

  draftTenderEmail: (tenderId: string, tone: string = 'professional') =>
    request<{
      subject: string
      body: string
    }>('/api/v1/ai/communications/draft-tender-email', {
      method: 'POST',
      body: JSON.stringify({ tender_id: tenderId, tone }),
    }),

  draftCheckCallMessage: (shipmentId: string, channel: 'sms' | 'email' = 'sms') =>
    request<{
      message?: string
      subject?: string
      body?: string
    }>('/api/v1/ai/communications/draft-check-call', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: shipmentId, channel }),
    }),

  draftExceptionNotification: (data: {
    shipment_id: string
    exception_type: string
    exception_details: string
    recipient: 'customer' | 'carrier'
  }) =>
    request<{
      subject: string
      body: string
    }>('/api/v1/ai/communications/draft-exception-notification', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  summarizeEmailThread: (emails: {
    from_email: string
    subject: string
    received_at: string
    body_text: string
  }[]) =>
    request<{
      summary: string
      key_points: string[]
      action_items: string[]
      sentiment: 'positive' | 'neutral' | 'negative'
      urgency: 'high' | 'medium' | 'low'
    }>('/api/v1/ai/communications/summarize-thread', {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),

  // ============================================================================
  // Exception Detection
  // ============================================================================

  detectAllExceptions: () =>
    request<{
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
    }[]>('/api/v1/ai/exceptions/detect-all'),

  getExceptionSummary: () =>
    request<{
      total: number
      by_type: Record<string, number>
      by_severity: {
        high: number
        medium: number
        low: number
      }
      exceptions: {
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
      }[]
    }>('/api/v1/ai/exceptions/summary'),

  createWorkItemsFromExceptions: (autoCreate: boolean = true) =>
    request<{
      work_item_ids: string[]
      total_exceptions: number
      work_items_created: number
    }>('/api/v1/ai/exceptions/create-work-items', {
      method: 'POST',
      body: JSON.stringify({ auto_create: autoCreate }),
    }),

  // ============================================================================
  // Desks
  // ============================================================================

  getDesks: (params?: { is_active?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
    const query = searchParams.toString()
    return request<Desk[]>(`/api/v1/desks${query ? `?${query}` : ''}`)
  },

  getDesk: (id: string) => request<Desk>(`/api/v1/desks/${id}`),

  createDesk: (data: {
    name: string
    description?: string
    desk_type?: import('../types').DeskType
    is_active?: boolean
    routing_rules?: import('../types').RoutingRule[]
    coverage?: import('../types').CoverageSchedule[]
    members?: string[]
    priority?: number
  }) => request<Desk>('/api/v1/desks', { method: 'POST', body: JSON.stringify(data) }),

  updateDesk: (id: string, data: {
    name?: string
    description?: string
    desk_type?: import('../types').DeskType
    is_active?: boolean
    routing_rules?: import('../types').RoutingRule[]
    coverage?: import('../types').CoverageSchedule[]
    members?: string[]
    priority?: number
  }) => request<Desk>(`/api/v1/desks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteDesk: (id: string) =>
    request<{ status: string; id: string }>(`/api/v1/desks/${id}`, { method: 'DELETE' }),

  addDeskMember: (deskId: string, userId: string) =>
    request<Desk>(`/api/v1/desks/${deskId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  removeDeskMember: (deskId: string, userId: string) =>
    request<Desk>(`/api/v1/desks/${deskId}/members/${userId}`, { method: 'DELETE' }),

  getDeskWorkItems: (deskId: string, status?: string) => {
    const searchParams = new URLSearchParams()
    if (status) searchParams.set('status', status)
    const query = searchParams.toString()
    return request<import('../types').WorkItem[]>(`/api/v1/desks/${deskId}/work-items${query ? `?${query}` : ''}`)
  },

  routeWorkItem: (workItemId: string) =>
    request<{ status: string; desk_id: string | null; work_item_id: string }>('/api/v1/desks/route', {
      method: 'POST',
      body: JSON.stringify({ work_item_id: workItemId }),
    }),

  autoRouteWorkItems: () =>
    request<{ status: string; routed_count: number }>('/api/v1/desks/auto-route', { method: 'POST' }),

  // ============================================================================
  // Real-Time Dashboard
  // ============================================================================

  getRealtimeDashboard: () =>
    request<{
      metrics: {
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
      recent_activity: {
        type: string
        timestamp: string
        shipment_id: string
        detail: string
        location?: string
        notes?: string
      }[]
      at_risk_shipments: {
        id: string
        shipment_number: string
        status: string
        risk_reason: string
        pickup_date?: string
        delivery_date?: string
      }[]
      upcoming_deliveries: {
        id: string
        shipment_number: string
        delivery_date?: string
        status: string
        last_location?: string
        eta?: string
      }[]
      exception_summary: {
        total: number
        by_severity: {
          high: number
          medium: number
          low: number
        }
        by_type: Record<string, number>
      }
    }>('/api/v1/analytics/realtime'),

  // Approval Center
  getApprovals: (params?: { status?: string }) => {
    const query = params?.status ? `?status=${params.status}` : ''
    return request<any[]>(`/api/v1/approvals${query}`)
  },
  getApprovalSettings: () =>
    request<any>('/api/v1/approvals/settings'),
  approveApproval: (id: string) =>
    request<any>(`/api/v1/approvals/${id}/approve`, { method: 'POST' }),
  rejectApproval: (id: string, reason?: string) =>
    request<any>(`/api/v1/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  updateApprovalThresholds: (thresholds: any[]) =>
    request<any>('/api/v1/approvals/settings/thresholds', {
      method: 'PATCH',
      body: JSON.stringify({ thresholds }),
    }),

  // Analytics
  getOperationsMetrics: (days: number = 30) =>
    request<any>(`/api/v1/analytics/operations?days=${days}`),
  getLaneIntelligence: (days: number = 90, limit: number = 20) =>
    request<any[]>(`/api/v1/analytics/lanes?days=${days}&limit=${limit}`),

  // Automation Builder
  listAutomations: (params?: { trigger?: string; enabled?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.trigger) searchParams.set('trigger', params.trigger)
    if (params?.enabled !== undefined) searchParams.set('enabled', String(params.enabled))
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<any[]>(`/api/v1/automations${query}`)
  },
  getAutomation: (id: string) =>
    request<any>(`/api/v1/automations/${id}`),
  createAutomation: (data: any) =>
    request<any>('/api/v1/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAutomation: (id: string, data: any) =>
    request<any>(`/api/v1/automations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteAutomation: (id: string) =>
    request<any>(`/api/v1/automations/${id}`, { method: 'DELETE' }),
  toggleAutomation: (id: string) =>
    request<any>(`/api/v1/automations/${id}/toggle`, { method: 'POST' }),
  testAutomation: (data: { entity_type: string; entity_id: string }) =>
    request<any>('/api/v1/automations/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAutomationLog: (id: string) =>
    request<any>(`/api/v1/automations/${id}/log`),

  // ============================================================================
  // Document Inbox
  // ============================================================================

  getDocumentInboxItems: (params?: { status?: string; classification?: string; source?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.classification) searchParams.set('classification', params.classification)
    if (params?.source) searchParams.set('source', params.source)
    const query = searchParams.toString()
    return request<any[]>(`/api/v1/document-inbox${query ? `?${query}` : ''}`)
  },

  createDocumentInboxItem: (data: {
    source?: string
    source_email?: string
    filename: string
    file_type?: string
    file_size?: number
    metadata?: Record<string, unknown>
  }) => request<any>('/api/v1/document-inbox', { method: 'POST', body: JSON.stringify(data) }),

  classifyDocumentInboxItem: (id: string) =>
    request<any>(`/api/v1/document-inbox/${id}/classify`, { method: 'POST' }),

  linkDocumentInboxItem: (id: string, data: { entity_type: string; entity_id: string }) =>
    request<any>(`/api/v1/document-inbox/${id}/link`, { method: 'POST', body: JSON.stringify(data) }),

  archiveDocumentInboxItem: (id: string) =>
    request<any>(`/api/v1/document-inbox/${id}/archive`, { method: 'POST' }),

  getDocumentInboxStats: () =>
    request<any>('/api/v1/document-inbox/stats'),

  // ============================================================================
  // Billing
  // ============================================================================

  getBillingQueue: () =>
    request<any[]>('/api/v1/billing/queue'),

  generateBillingInvoice: (shipmentId: string) =>
    request<any>(`/api/v1/billing/generate-invoice/${shipmentId}`, { method: 'POST' }),

  getCarrierBills: (params?: { status?: string; carrier_id?: string; shipment_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.carrier_id) searchParams.set('carrier_id', params.carrier_id)
    if (params?.shipment_id) searchParams.set('shipment_id', params.shipment_id)
    const query = searchParams.toString()
    return request<any[]>(`/api/v1/billing/carrier-bills${query ? `?${query}` : ''}`)
  },

  createCarrierBill: (data: {
    carrier_id: string
    shipment_id: string
    bill_number: string
    amount: number
    received_date?: string
    due_date?: string
    notes?: string
  }) => request<any>('/api/v1/billing/carrier-bills', { method: 'POST', body: JSON.stringify(data) }),

  matchCarrierBill: (billId: string) =>
    request<any>(`/api/v1/billing/carrier-bills/${billId}/match`, { method: 'POST' }),

  approveCarrierBill: (billId: string) =>
    request<any>(`/api/v1/billing/carrier-bills/${billId}/approve`, { method: 'POST' }),

  getBillingSummary: () =>
    request<any>('/api/v1/billing/summary'),
}
