import { useEffect, useState } from 'react'
import { api } from '../services/api'
import PageHelp from '../components/PageHelp'
import {
  Radio,
  Plus,
  Settings,
  Send,
  Inbox,
  FileText,
  Check,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Eye,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react'

// ============================================================================
// Types (local to this page)
// ============================================================================

interface TradingPartner {
  id: string
  partner_name: string
  partner_code?: string
  isa_id: string
  isa_qualifier: string
  gs_id: string
  supported_message_types: string[]
  connection_type: string
  connection_config: Record<string, unknown>
  is_active: boolean
  element_separator: string
  segment_terminator: string
  sub_element_separator: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
  created_at: string
  updated_at: string
}

interface EDIMessageItem {
  id: string
  message_type: string
  direction: string
  status: string
  raw_content: string
  parsed_data?: Record<string, unknown>
  trading_partner_id?: string
  shipment_id?: string
  isa_control_number?: string
  gs_control_number?: string
  st_control_number?: string
  error_messages: string[]
  acknowledged_at?: string
  functional_ack_status?: string
  processed_at?: string
  processing_notes?: string
  created_at: string
  updated_at: string
  trading_partner_name?: string
}

// ============================================================================
// Constants
// ============================================================================

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  '204': '204 - Load Tender',
  '214': '214 - Status Update',
  '210': '210 - Freight Invoice',
  '990': '990 - Tender Response',
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-yellow-100 text-yellow-700',
  parsing: 'bg-blue-100 text-blue-700',
  parsed: 'bg-blue-100 text-blue-700',
  validated: 'bg-cyan-100 text-cyan-700',
  processing: 'bg-purple-100 text-purple-700',
  processed: 'bg-green-100 text-green-700',
  sent: 'bg-emerald-100 text-emerald-700',
  acknowledged: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
}

const CONNECTION_TYPE_LABELS: Record<string, string> = {
  sftp: 'SFTP',
  as2: 'AS2',
  api: 'API',
}

type TabId = 'partners' | 'messages' | 'send' | 'edi210' | 'edi990' | 'edi204'

// ============================================================================
// Component
// ============================================================================

export default function EDIManager() {
  const [activeTab, setActiveTab] = useState<TabId>('partners')
  const [loading, setLoading] = useState(true)

  // Trading Partners state
  const [partners, setPartners] = useState<TradingPartner[]>([])
  const [showPartnerForm, setShowPartnerForm] = useState(false)
  const [editingPartner, setEditingPartner] = useState<TradingPartner | null>(null)

  // Message Log state
  const [messages, setMessages] = useState<EDIMessageItem[]>([])
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null)

  // Send Message / Parse Preview state
  const [sendRawContent, setSendRawContent] = useState('')
  const [sendPartner, setSendPartner] = useState<string>('')
  const [parsePreview, setParsePreview] = useState<Record<string, unknown> | null>(null)
  const [sending, setSending] = useState(false)
  const [parsing, setParsing] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)

  // EDI 210 state
  const [edi210Messages, setEdi210Messages] = useState<any[]>([])
  const [edi210InvoiceId, setEdi210InvoiceId] = useState('')
  const [generating210, setGenerating210] = useState(false)

  // EDI 990 state
  const [edi990Messages, setEdi990Messages] = useState<any[]>([])
  const [edi990TenderId, setEdi990TenderId] = useState('')
  const [edi990ResponseType, setEdi990ResponseType] = useState('accept')
  const [generating990, setGenerating990] = useState(false)

  // EDI 204 Tender Acceptance state
  const [edi204Tenders, setEdi204Tenders] = useState<any[]>([])
  const [edi204StatusFilter, setEdi204StatusFilter] = useState('all')
  const [edi204ActionLoading, setEdi204ActionLoading] = useState<string | null>(null)
  const [edi204RejectReason, setEdi204RejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [activeTab, messageTypeFilter, directionFilter, statusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'partners') {
        const data = await api.getEDITradingPartners()
        setPartners(data)
      } else if (activeTab === 'messages') {
        const params: Record<string, string> = {}
        if (messageTypeFilter !== 'all') params.message_type = messageTypeFilter
        if (directionFilter !== 'all') params.direction = directionFilter
        if (statusFilter !== 'all') params.status = statusFilter
        const data = await api.getEDIMessages(params)
        setMessages(data)
      } else if (activeTab === 'send') {
        // Load partners for the send form dropdown
        const data = await api.getEDITradingPartners()
        setPartners(data)
      } else if (activeTab === 'edi210') {
        const data = await api.getEDI210Status()
        setEdi210Messages(data)
      } else if (activeTab === 'edi990') {
        const data = await api.getEDI990Status()
        setEdi990Messages(data)
      } else if (activeTab === 'edi204') {
        const params: Record<string, string> = {}
        if (edi204StatusFilter !== 'all') params.status = edi204StatusFilter
        const data = await api.getEDI204Tenders(params)
        setEdi204Tenders(data)
      }
      const statsData = await api.getEDIStats()
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch EDI data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // Partner Actions
  // ============================================================================

  const handleSavePartner = async (formData: Record<string, unknown>) => {
    try {
      if (editingPartner) {
        await api.updateEDITradingPartner(editingPartner.id, formData)
      } else {
        await api.createEDITradingPartner(formData)
      }
      setShowPartnerForm(false)
      setEditingPartner(null)
      await fetchData()
    } catch (error) {
      console.error('Failed to save partner:', error)
    }
  }

  const handleDeletePartner = async (partnerId: string) => {
    if (!confirm('Delete this trading partner?')) return
    try {
      await api.deleteEDITradingPartner(partnerId)
      await fetchData()
    } catch (error) {
      console.error('Failed to delete partner:', error)
    }
  }

  // ============================================================================
  // Message Actions
  // ============================================================================

  const handleParsePreview = async () => {
    setParsing(true)
    setParsePreview(null)
    try {
      const result = await api.ediParsePreview({ raw_content: sendRawContent })
      setParsePreview(result)
    } catch (error) {
      console.error('Parse preview failed:', error)
    } finally {
      setParsing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!sendRawContent.trim()) return
    setSending(true)
    try {
      await api.sendEDIMessage({
        raw_content: sendRawContent,
        direction: 'inbound',
        trading_partner_id: sendPartner || undefined,
      })
      setSendRawContent('')
      setSendPartner('')
      setParsePreview(null)
      setActiveTab('messages')
      await fetchData()
    } catch (error) {
      console.error('Failed to send EDI message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleReparse = async (messageId: string) => {
    setActionLoading(messageId)
    try {
      await api.reparseEDIMessage(messageId)
      await fetchData()
    } catch (error) {
      console.error('Failed to reparse message:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcknowledge = async (messageId: string, accept: boolean) => {
    setActionLoading(messageId)
    try {
      await api.acknowledgeEDIMessage(messageId, accept)
      await fetchData()
    } catch (error) {
      console.error('Failed to acknowledge message:', error)
    } finally {
      setActionLoading(null)
    }
  }

  // ============================================================================
  // EDI 210 Actions
  // ============================================================================

  const handleGenerate210 = async () => {
    if (!edi210InvoiceId.trim()) return
    setGenerating210(true)
    try {
      await api.generateEDI210(edi210InvoiceId.trim())
      setEdi210InvoiceId('')
      setActiveTab('edi210')
      await fetchData()
    } catch (error) {
      console.error('Failed to generate EDI 210:', error)
    } finally {
      setGenerating210(false)
    }
  }

  // ============================================================================
  // EDI 990 Actions
  // ============================================================================

  const handleGenerate990 = async () => {
    if (!edi990TenderId.trim()) return
    setGenerating990(true)
    try {
      await api.generateEDI990(edi990TenderId.trim(), { response_type: edi990ResponseType })
      setEdi990TenderId('')
      setActiveTab('edi990')
      await fetchData()
    } catch (error) {
      console.error('Failed to generate EDI 990:', error)
    } finally {
      setGenerating990(false)
    }
  }

  // ============================================================================
  // EDI 204 Tender Actions
  // ============================================================================

  const handleAccept204 = async (tenderId: string) => {
    setEdi204ActionLoading(tenderId)
    try {
      await api.acceptEDI204Tender(tenderId)
      await fetchData()
    } catch (error) {
      console.error('Failed to accept 204 tender:', error)
    } finally {
      setEdi204ActionLoading(null)
    }
  }

  const handleReject204 = async (tenderId: string) => {
    setEdi204ActionLoading(tenderId)
    try {
      await api.rejectEDI204Tender(tenderId, { reason: edi204RejectReason || undefined })
      setShowRejectModal(null)
      setEdi204RejectReason('')
      await fetchData()
    } catch (error) {
      console.error('Failed to reject 204 tender:', error)
    } finally {
      setEdi204ActionLoading(null)
    }
  }

  // ============================================================================
  // Formatters
  // ============================================================================

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="h-7 w-7 text-indigo-600" />
            EDI Manager
            <PageHelp pageId="edi-manager" />
          </h1>
          <p className="text-gray-500">
            Manage EDI trading partners, message log, and send/receive EDI messages
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Settings className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Trading Partners</p>
                <p className="text-xl font-bold text-indigo-600">{(stats as Record<string, number>).active_trading_partners ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Messages</p>
                <p className="text-xl font-bold text-blue-600">{(stats as Record<string, number>).total_messages ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowDownLeft className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inbound</p>
                <p className="text-xl font-bold text-green-600">{((stats as Record<string, Record<string, number>>).by_direction ?? {}).inbound ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outbound</p>
                <p className="text-xl font-bold text-amber-600">{((stats as Record<string, Record<string, number>>).by_direction ?? {}).outbound ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'partners' as const, label: 'Trading Partners', icon: Settings },
          { id: 'messages' as const, label: 'Message Log', icon: FileText },
          { id: 'send' as const, label: 'Send Message', icon: Send },
          { id: 'edi204' as const, label: '204 Tenders', icon: Inbox },
          { id: 'edi210' as const, label: '210 Invoice', icon: FileText },
          { id: 'edi990' as const, label: '990 Response', icon: FileText },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading EDI data...</p>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* Trading Partners Tab */}
          {/* ============================================================ */}
          {activeTab === 'partners' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => { setEditingPartner(null); setShowPartnerForm(true) }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Trading Partner
                </button>
              </div>

              {partners.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No trading partners configured</p>
                  <p className="text-gray-500 mt-1">Add a trading partner to start exchanging EDI messages</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {partners.map((partner) => (
                    <div key={partner.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${partner.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Radio className={`h-5 w-5 ${partner.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{partner.partner_name}</h3>
                            {partner.partner_code && (
                              <span className="text-xs text-gray-400 font-mono">{partner.partner_code}</span>
                            )}
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                              <span>ISA: <span className="font-mono">{partner.isa_id}</span></span>
                              <span>GS: <span className="font-mono">{partner.gs_id}</span></span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                                {CONNECTION_TYPE_LABELS[partner.connection_type] || partner.connection_type}
                              </span>
                            </div>
                            <div className="flex gap-1 mt-2">
                              {partner.supported_message_types.map((mt) => (
                                <span key={mt} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                                  {mt}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${partner.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {partner.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => { setEditingPartner(partner); setShowPartnerForm(true) }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePartner(partner.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {partner.contact_name && (
                        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
                          Contact: {partner.contact_name}
                          {partner.contact_email && ` | ${partner.contact_email}`}
                          {partner.contact_phone && ` | ${partner.contact_phone}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Partner Form Modal */}
              {showPartnerForm && (
                <PartnerFormModal
                  partner={editingPartner}
                  onSave={handleSavePartner}
                  onClose={() => { setShowPartnerForm(false); setEditingPartner(null) }}
                />
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Message Log Tab */}
          {/* ============================================================ */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Type:</label>
                  <select
                    value={messageTypeFilter}
                    onChange={(e) => setMessageTypeFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="204">204 - Load Tender</option>
                    <option value="214">214 - Status</option>
                    <option value="210">210 - Invoice</option>
                    <option value="990">990 - Response</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Direction:</label>
                  <select
                    value={directionFilter}
                    onChange={(e) => setDirectionFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="received">Received</option>
                    <option value="parsed">Parsed</option>
                    <option value="processed">Processed</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="error">Error</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Messages List */}
              <div className="bg-white rounded-xl border border-gray-200">
                {messages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    No EDI messages found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {messages.map((msg) => (
                      <div key={msg.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {msg.direction === 'inbound' ? (
                              <ArrowDownLeft className="h-5 w-5 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-5 w-5 text-amber-500" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {MESSAGE_TYPE_LABELS[msg.message_type] || msg.message_type}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[msg.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {msg.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                <span>{msg.direction}</span>
                                {msg.trading_partner_name && <span>Partner: {msg.trading_partner_name}</span>}
                                {msg.isa_control_number && <span>ISA: {msg.isa_control_number}</span>}
                                <span>{formatDate(msg.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.error_messages.length > 0 && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            {msg.status === 'parsed' && msg.direction === 'inbound' && (
                              <>
                                <button
                                  onClick={() => handleAcknowledge(msg.id, true)}
                                  disabled={actionLoading === msg.id}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                >
                                  <Check className="h-3 w-3" />
                                  Ack
                                </button>
                                <button
                                  onClick={() => handleAcknowledge(msg.id, false)}
                                  disabled={actionLoading === msg.id}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                >
                                  <X className="h-3 w-3" />
                                  Reject
                                </button>
                              </>
                            )}
                            {msg.status === 'error' && (
                              <button
                                onClick={() => handleReparse(msg.id)}
                                disabled={actionLoading === msg.id}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                              >
                                {actionLoading === msg.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                Reparse
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedMessage(expandedMessage === msg.id ? null : msg.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                            >
                              {expandedMessage === msg.id ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedMessage === msg.id && (
                          <div className="mt-4 space-y-3">
                            {msg.error_messages.length > 0 && (
                              <div className="p-3 bg-red-50 rounded-lg">
                                <p className="text-sm font-medium text-red-700 mb-1">Errors:</p>
                                {msg.error_messages.map((err, idx) => (
                                  <p key={idx} className="text-xs text-red-600">{err}</p>
                                ))}
                              </div>
                            )}
                            {msg.parsed_data && (
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Parsed Data:</p>
                                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-64 text-gray-700 font-mono">
                                  {JSON.stringify(msg.parsed_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">Raw Content:</p>
                              <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-40 text-gray-500 font-mono whitespace-pre-wrap">
                                {msg.raw_content}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* Send Message Tab */}
          {/* ============================================================ */}
          {activeTab === 'send' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Submit EDI Message</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trading Partner (optional)</label>
                  <select
                    value={sendPartner}
                    onChange={(e) => setSendPartner(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">-- Select Partner --</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>{p.partner_name} ({p.isa_id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Raw EDI Content</label>
                  <textarea
                    value={sendRawContent}
                    onChange={(e) => setSendRawContent(e.target.value)}
                    placeholder="Paste EDI message content here (ISA*00*...) ..."
                    rows={10}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleParsePreview}
                    disabled={!sendRawContent.trim() || parsing}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    {parsing ? 'Parsing...' : 'Preview Parse'}
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!sendRawContent.trim() || sending}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? 'Submitting...' : 'Submit Message'}
                  </button>
                </div>
              </div>

              {/* Parse Preview */}
              {parsePreview && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Search className="h-5 w-5 text-indigo-600" />
                    Parse Preview
                  </h3>
                  {parsePreview.error ? (
                    <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                      {String(parsePreview.error)}
                    </div>
                  ) : (
                    <pre className="text-sm bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-gray-700 font-mono">
                      {JSON.stringify(parsePreview, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* EDI 204 - Load Tender Acceptance Tab */}
          {/* ============================================================ */}
          {activeTab === 'edi204' && (
            <div className="space-y-4">
              {/* Status Filter */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Status:</label>
                  <select
                    value={edi204StatusFilter}
                    onChange={(e) => { setEdi204StatusFilter(e.target.value); fetchData() }}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="received">Received</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="accepted">Accepted</option>
                    <option value="auto_accepted">Auto-Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <button
                  onClick={fetchData}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              {/* 204 Tenders List */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Inbound EDI 204 Load Tenders</h3>
                  <p className="text-sm text-gray-500 mt-1">Accept or reject inbound load tenders from trading partners</p>
                </div>
                {edi204Tenders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    No 204 load tenders found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {edi204Tenders.map((tender: any) => (
                      <div key={tender.id} className="p-5 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <ArrowDownLeft className="h-5 w-5 text-green-500" />
                              <span className="font-semibold text-gray-900">204 Load Tender</span>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                tender.status === 'accepted' || tender.status === 'auto_accepted' ? 'bg-green-100 text-green-700' :
                                tender.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                tender.status === 'received' || tender.status === 'pending_review' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {tender.status?.replace(/_/g, ' ')}
                              </span>
                              {tender.auto_accept_rule_id && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-Rule Applied</span>
                              )}
                            </div>
                            <div className="ml-7 space-y-1">
                              {tender.shipper_name && (
                                <p className="text-sm text-gray-600">
                                  <span className="text-gray-400">Shipper:</span> {tender.shipper_name}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                {tender.origin_city && tender.origin_state && (
                                  <span>{tender.origin_city}, {tender.origin_state}</span>
                                )}
                                {tender.origin_city && tender.destination_city && (
                                  <span className="text-gray-300">-&gt;</span>
                                )}
                                {tender.destination_city && tender.destination_state && (
                                  <span>{tender.destination_city}, {tender.destination_state}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-400">
                                {tender.equipment_type && <span>Equipment: {tender.equipment_type}</span>}
                                {tender.weight_lbs && <span>Weight: {Number(tender.weight_lbs).toLocaleString()} lbs</span>}
                                {tender.rate_cents && <span>Rate: ${(tender.rate_cents / 100).toFixed(2)}</span>}
                                {tender.pickup_date && <span>Pickup: {formatDate(tender.pickup_date)}</span>}
                              </div>
                              {tender.trading_partner_name && (
                                <p className="text-xs text-gray-400">Partner: {tender.trading_partner_name} | Received: {formatDate(tender.received_at || tender.created_at)}</p>
                              )}
                              {tender.shipment_number && (
                                <p className="text-xs text-emerald-600 font-medium">Shipment: {tender.shipment_number}</p>
                              )}
                              {tender.rejection_reason && (
                                <p className="text-xs text-red-600">Reason: {tender.rejection_reason}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {(tender.status === 'received' || tender.status === 'pending_review') && (
                              <>
                                <button
                                  onClick={() => handleAccept204(tender.id)}
                                  disabled={edi204ActionLoading === tender.id}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                  {edi204ActionLoading === tender.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Accept
                                </button>
                                <button
                                  onClick={() => setShowRejectModal(tender.id)}
                                  disabled={edi204ActionLoading === tender.id}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reject Reason Modal */}
              {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Load Tender</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason (optional)</label>
                        <textarea
                          value={edi204RejectReason}
                          onChange={(e) => setEdi204RejectReason(e.target.value)}
                          rows={3}
                          placeholder="Enter reason for rejection..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setShowRejectModal(null); setEdi204RejectReason('') }}
                          className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReject204(showRejectModal)}
                          disabled={edi204ActionLoading === showRejectModal}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {edi204ActionLoading === showRejectModal ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Reject Tender
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* EDI 210 - Freight Invoice Tab */}
          {/* ============================================================ */}
          {activeTab === 'edi210' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Generate EDI 210 Freight Invoice</h3>
                <p className="text-sm text-gray-500">Generate an EDI 210 message from a TMS invoice to transmit to trading partners.</p>

                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID</label>
                    <input
                      type="text"
                      value={edi210InvoiceId}
                      onChange={(e) => setEdi210InvoiceId(e.target.value)}
                      placeholder="Enter Invoice ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleGenerate210}
                    disabled={!edi210InvoiceId.trim() || generating210}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {generating210 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {generating210 ? 'Generating...' : 'Generate 210'}
                  </button>
                </div>
              </div>

              {/* 210 Status List */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">EDI 210 Transmission Status</h3>
                </div>
                {edi210Messages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    No EDI 210 messages generated yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {edi210Messages.map((msg: any) => (
                      <div key={msg.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ArrowUpRight className="h-5 w-5 text-amber-500" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">210 - Freight Invoice</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[msg.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {msg.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                <span>Invoice: {msg.invoice_number || msg.invoice_id}</span>
                                {msg.trading_partner_name && <span>Partner: {msg.trading_partner_name}</span>}
                                {msg.isa_control_number && <span>ISA: {msg.isa_control_number}</span>}
                                <span>{formatDate(msg.sent_at || msg.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.acknowledged_at && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                Acknowledged
                              </span>
                            )}
                            {msg.error_messages?.length > 0 && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* EDI 990 - Tender Response Tab */}
          {/* ============================================================ */}
          {activeTab === 'edi990' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Generate EDI 990 Tender Response</h3>
                <p className="text-sm text-gray-500">Generate an EDI 990 message to accept, decline, or counter a load tender.</p>

                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tender ID</label>
                    <input
                      type="text"
                      value={edi990TenderId}
                      onChange={(e) => setEdi990TenderId(e.target.value)}
                      placeholder="Enter Tender ID"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Response</label>
                    <select
                      value={edi990ResponseType}
                      onChange={(e) => setEdi990ResponseType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="accept">Accept</option>
                      <option value="decline">Decline</option>
                      <option value="counter">Counter</option>
                    </select>
                  </div>
                  <button
                    onClick={handleGenerate990}
                    disabled={!edi990TenderId.trim() || generating990}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {generating990 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {generating990 ? 'Generating...' : 'Generate 990'}
                  </button>
                </div>
              </div>

              {/* 990 Status List */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">EDI 990 Transmission Status</h3>
                </div>
                {edi990Messages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    No EDI 990 messages generated yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {edi990Messages.map((msg: any) => (
                      <div key={msg.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ArrowUpRight className="h-5 w-5 text-amber-500" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">990 - Tender Response</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  msg.response_type === 'accept' ? 'bg-green-100 text-green-700' :
                                  msg.response_type === 'decline' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {msg.response_type}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[msg.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {msg.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                                <span>Tender: {msg.tender_id}</span>
                                {msg.shipment_number && <span>Shipment: {msg.shipment_number}</span>}
                                {msg.trading_partner_name && <span>Partner: {msg.trading_partner_name}</span>}
                                <span>{formatDate(msg.sent_at || msg.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {msg.acknowledged_at && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                Acknowledged
                              </span>
                            )}
                            {msg.error_messages?.length > 0 && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ============================================================================
// Partner Form Modal
// ============================================================================

function PartnerFormModal({
  partner,
  onSave,
  onClose,
}: {
  partner: TradingPartner | null
  onSave: (data: Record<string, unknown>) => void
  onClose: () => void
}) {
  const [partnerName, setPartnerName] = useState(partner?.partner_name || '')
  const [partnerCode, setPartnerCode] = useState(partner?.partner_code || '')
  const [isaId, setIsaId] = useState(partner?.isa_id || '')
  const [isaQualifier, setIsaQualifier] = useState(partner?.isa_qualifier || 'ZZ')
  const [gsId, setGsId] = useState(partner?.gs_id || '')
  const [connectionType, setConnectionType] = useState(partner?.connection_type || 'sftp')
  const [isActive, setIsActive] = useState(partner?.is_active ?? true)
  const [supportedTypes, setSupportedTypes] = useState<string[]>(partner?.supported_message_types || [])
  const [contactName, setContactName] = useState(partner?.contact_name || '')
  const [contactEmail, setContactEmail] = useState(partner?.contact_email || '')
  const [contactPhone, setContactPhone] = useState(partner?.contact_phone || '')
  const [notes, setNotes] = useState(partner?.notes || '')

  const toggleMessageType = (mt: string) => {
    setSupportedTypes((prev) =>
      prev.includes(mt) ? prev.filter((t) => t !== mt) : [...prev, mt]
    )
  }

  const handleSubmit = () => {
    if (!partnerName.trim() || !isaId.trim() || !gsId.trim()) return
    onSave({
      partner_name: partnerName,
      partner_code: partnerCode || undefined,
      isa_id: isaId,
      isa_qualifier: isaQualifier,
      gs_id: gsId,
      supported_message_types: supportedTypes,
      connection_type: connectionType,
      is_active: isActive,
      contact_name: contactName || undefined,
      contact_email: contactEmail || undefined,
      contact_phone: contactPhone || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {partner ? 'Edit Trading Partner' : 'Add Trading Partner'}
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name *</label>
              <input type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input type="text" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISA ID *</label>
              <input type="text" value={isaId} onChange={(e) => setIsaId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISA Qualifier</label>
              <input type="text" value={isaQualifier} onChange={(e) => setIsaQualifier(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GS ID *</label>
              <input type="text" value={gsId} onChange={(e) => setGsId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connection Type</label>
              <select value={connectionType} onChange={(e) => setConnectionType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="sftp">SFTP</option>
                <option value="as2">AS2</option>
                <option value="api">API</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supported Message Types</label>
            <div className="flex gap-2">
              {['204', '214', '210', '990'].map((mt) => (
                <button
                  key={mt}
                  onClick={() => toggleMessageType(mt)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    supportedTypes.includes(mt)
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mt}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input type="text" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSubmit}
              disabled={!partnerName.trim() || !isaId.trim() || !gsId.trim()}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {partner ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
