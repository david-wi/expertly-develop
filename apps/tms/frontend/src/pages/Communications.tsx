import { useEffect, useState } from 'react'
import {
  MessageSquare,
  Phone,
  Send,
  Plus,
  Eye,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileText,
  PhoneCall,
  ArrowUpRight,
  ArrowDownRight,
  Variable,
  Trash2,
  Edit3,
  Search,
} from 'lucide-react'

// ============================================================================
// Local API helpers (to be merged into services/api.ts)
// ============================================================================

import { httpErrorMessage } from '../utils/httpErrors'

const API_BASE = import.meta.env.VITE_API_URL || ''

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || httpErrorMessage(response.status))
  }
  return response.json()
}

const commApi = {
  getCommunicationLog: (params?: Record<string, string>) => {
    const searchParams = new URLSearchParams()
    if (params?.channel) searchParams.set('channel', params.channel)
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return apiRequest<CommunicationLog[]>(`/api/v1/communications/log${query ? `?${query}` : ''}`)
  },
  getCommunicationTemplates: (params?: Record<string, string>) => {
    const searchParams = new URLSearchParams()
    if (params?.channel) searchParams.set('channel', params.channel)
    if (params?.category) searchParams.set('category', params.category)
    const query = searchParams.toString()
    return apiRequest<CommunicationTemplate[]>(`/api/v1/communications/templates${query ? `?${query}` : ''}`)
  },
  createCommunicationTemplate: (data: Record<string, unknown>) =>
    apiRequest<CommunicationTemplate>('/api/v1/communications/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateCommunicationTemplate: (id: string, data: Record<string, unknown>) =>
    apiRequest<CommunicationTemplate>(`/api/v1/communications/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCommunicationTemplate: (id: string) =>
    apiRequest<{ status: string }>(`/api/v1/communications/templates/${id}`, { method: 'DELETE' }),
  sendSMS: (data: { to_number: string; message_body: string; shipment_id?: string; carrier_id?: string; customer_id?: string; template_id?: string }) =>
    apiRequest<CommunicationLog>('/api/v1/communications/send-sms', { method: 'POST', body: JSON.stringify(data) }),
  makeVoiceCall: (data: { to_number: string; message_body?: string; shipment_id?: string; carrier_id?: string; customer_id?: string }) =>
    apiRequest<CommunicationLog>('/api/v1/communications/make-call', { method: 'POST', body: JSON.stringify(data) }),
  previewCommunicationTemplate: (data: { template_body: string; shipment_id?: string; carrier_id?: string; customer_id?: string }) =>
    apiRequest<{ preview: string }>('/api/v1/communications/preview-template', { method: 'POST', body: JSON.stringify(data) }),
  getCheckCallSchedule: () =>
    apiRequest<CheckCallItem[]>('/api/v1/communications/check-call-schedule'),
  sendCheckCallReminder: (data: { shipment_id: string; template_id?: string }) =>
    apiRequest<CommunicationLog>('/api/v1/communications/send-check-call', { method: 'POST', body: JSON.stringify(data) }),
}

// ============================================================================
// Types (local to this page)
// ============================================================================

interface CommunicationLog {
  id: string
  channel: string
  direction: string
  phone_number?: string
  to_number?: string
  from_number?: string
  message_body?: string
  subject?: string
  call_duration_seconds?: number
  recording_url?: string
  status: string
  shipment_id?: string
  carrier_id?: string
  customer_id?: string
  template_id?: string
  provider_message_id?: string
  error_message?: string
  sent_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
  shipment_number?: string
  carrier_name?: string
  customer_name?: string
  template_name?: string
}

interface CommunicationTemplate {
  id: string
  name: string
  channel: string
  category: string
  template_body: string
  subject?: string
  description?: string
  is_active: boolean
  available_variables: string[]
  created_at: string
  updated_at: string
}

interface CheckCallItem {
  shipment_id: string
  shipment_number: string
  status: string
  carrier_id?: string
  carrier_name?: string
  carrier_phone?: string
  last_contact?: string
  hours_since_contact?: number
  next_check_call?: string
  is_overdue: boolean
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700',
  no_answer: 'bg-orange-100 text-orange-700',
}

const CHANNEL_ICONS: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  voice: Phone,
  email: FileText,
}

const CATEGORY_LABELS: Record<string, string> = {
  check_call: 'Check Call',
  delivery_notification: 'Delivery Notification',
  pickup_reminder: 'Pickup Reminder',
  rate_confirmation: 'Rate Confirmation',
  status_update: 'Status Update',
  custom: 'Custom',
}

type TabId = 'log' | 'templates' | 'send' | 'check-calls'

// ============================================================================
// Component
// ============================================================================

export default function Communications() {
  const [activeTab, setActiveTab] = useState<TabId>('log')
  const [loading, setLoading] = useState(true)

  // Message Log
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [logChannel, setLogChannel] = useState<string>('all')
  const [logStatus, setLogStatus] = useState<string>('all')
  const [logSearch, setLogSearch] = useState('')

  // Templates
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    channel: 'sms',
    category: 'custom',
    template_body: '',
    subject: '',
    description: '',
  })

  // Send Message
  const [sendForm, setSendForm] = useState({
    to_number: '',
    message_body: '',
    channel: 'sms',
    shipment_id: '',
    carrier_id: '',
    customer_id: '',
    template_id: '',
  })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState<string | null>(null)

  // Check Calls
  const [checkCalls, setCheckCalls] = useState<CheckCallItem[]>([])
  const [checkCallLoading, setCheckCallLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [activeTab, logChannel, logStatus])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'log') {
        const params: Record<string, string> = {}
        if (logChannel !== 'all') params.channel = logChannel
        if (logStatus !== 'all') params.status = logStatus
        const data = await commApi.getCommunicationLog(params)
        setLogs(data)
      } else if (activeTab === 'templates') {
        const data = await commApi.getCommunicationTemplates()
        setTemplates(data)
      } else if (activeTab === 'check-calls') {
        const data = await commApi.getCheckCallSchedule()
        setCheckCalls(data)
      }
    } catch (error) {
      console.error('Failed to fetch communication data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ---- Template CRUD ----

  const openTemplateModal = (template?: CommunicationTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setTemplateForm({
        name: template.name,
        channel: template.channel,
        category: template.category,
        template_body: template.template_body,
        subject: template.subject || '',
        description: template.description || '',
      })
    } else {
      setEditingTemplate(null)
      setTemplateForm({
        name: '',
        channel: 'sms',
        category: 'custom',
        template_body: '',
        subject: '',
        description: '',
      })
    }
    setShowTemplateModal(true)
  }

  const saveTemplate = async () => {
    try {
      if (editingTemplate) {
        await commApi.updateCommunicationTemplate(editingTemplate.id, templateForm)
      } else {
        await commApi.createCommunicationTemplate(templateForm)
      }
      setShowTemplateModal(false)
      await fetchData()
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await commApi.deleteCommunicationTemplate(id)
      await fetchData()
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  // ---- Send Message ----

  const handleSend = async () => {
    setSending(true)
    setSendResult(null)
    try {
      if (sendForm.channel === 'sms') {
        await commApi.sendSMS({
          to_number: sendForm.to_number,
          message_body: sendForm.message_body,
          shipment_id: sendForm.shipment_id || undefined,
          carrier_id: sendForm.carrier_id || undefined,
          customer_id: sendForm.customer_id || undefined,
          template_id: sendForm.template_id || undefined,
        })
        setSendResult('SMS sent successfully!')
      } else {
        await commApi.makeVoiceCall({
          to_number: sendForm.to_number,
          message_body: sendForm.message_body || undefined,
          shipment_id: sendForm.shipment_id || undefined,
          carrier_id: sendForm.carrier_id || undefined,
          customer_id: sendForm.customer_id || undefined,
        })
        setSendResult('Voice call initiated successfully!')
      }
      setSendForm({ ...sendForm, to_number: '', message_body: '' })
    } catch (error: any) {
      setSendResult(`Error: ${error.message}`)
    } finally {
      setSending(false)
    }
  }

  const handlePreview = async () => {
    if (!sendForm.message_body) return
    try {
      const result = await commApi.previewCommunicationTemplate({
        template_body: sendForm.message_body,
        shipment_id: sendForm.shipment_id || undefined,
        carrier_id: sendForm.carrier_id || undefined,
        customer_id: sendForm.customer_id || undefined,
      })
      setPreviewText(result.preview)
    } catch (error) {
      console.error('Failed to preview:', error)
    }
  }

  const applyTemplate = (template: CommunicationTemplate) => {
    setSendForm({
      ...sendForm,
      message_body: template.template_body,
      channel: template.channel,
      template_id: template.id,
    })
    setPreviewText(null)
    setActiveTab('send')
  }

  // ---- Check Calls ----

  const handleSendCheckCall = async (shipmentId: string) => {
    setCheckCallLoading(shipmentId)
    try {
      await commApi.sendCheckCallReminder({ shipment_id: shipmentId })
      await fetchData()
    } catch (error) {
      console.error('Failed to send check call:', error)
    } finally {
      setCheckCallLoading(null)
    }
  }

  // ---- Formatters ----

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatHours = (hours?: number) => {
    if (hours == null) return 'Never'
    if (hours < 1) return `${Math.round(hours * 60)}m ago`
    return `${Math.round(hours)}h ago`
  }

  const insertVariable = (variable: string) => {
    if (showTemplateModal) {
      setTemplateForm({
        ...templateForm,
        template_body: templateForm.template_body + `{{${variable}}}`,
      })
    } else {
      setSendForm({
        ...sendForm,
        message_body: sendForm.message_body + `{{${variable}}}`,
      })
    }
  }

  // Filter logs by search
  const filteredLogs = logSearch
    ? logs.filter(
        (l) =>
          l.message_body?.toLowerCase().includes(logSearch.toLowerCase()) ||
          l.to_number?.includes(logSearch) ||
          l.shipment_number?.toLowerCase().includes(logSearch.toLowerCase()) ||
          l.carrier_name?.toLowerCase().includes(logSearch.toLowerCase()) ||
          l.customer_name?.toLowerCase().includes(logSearch.toLowerCase())
      )
    : logs

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-indigo-600" />
            Communications
          </h1>
          <p className="text-gray-500">
            Send SMS/voice messages, manage templates, and track check calls
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(
          [
            { id: 'log' as TabId, label: 'Message Log', icon: FileText },
            { id: 'templates' as TabId, label: 'Templates', icon: Variable },
            { id: 'send' as TabId, label: 'Send Message', icon: Send },
            { id: 'check-calls' as TabId, label: 'Check-Call Schedule', icon: PhoneCall },
          ] as const
        ).map((tab) => (
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

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500 mt-2">Loading...</p>
        </div>
      ) : (
        <>
          {/* ======== Message Log Tab ======== */}
          {activeTab === 'log' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {['all', 'sms', 'voice', 'email'].map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setLogChannel(ch)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        logChannel === ch
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {ch === 'all' ? 'All' : ch.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {['all', 'sent', 'delivered', 'failed', 'completed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setLogStatus(st)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        logStatus === st
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {st === 'all' ? 'All Status' : st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search messages..."
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64"
                  />
                </div>
              </div>

              {/* Log Table */}
              <div className="bg-white rounded-xl border border-gray-200">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No communication records found
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Channel</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Direction</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">To/From</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Message</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Entity</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredLogs.map((log) => {
                        const ChannelIcon = CHANNEL_ICONS[log.channel] || MessageSquare
                        return (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ChannelIcon className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium uppercase">{log.channel}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                {log.direction === 'outbound' ? (
                                  <ArrowUpRight className="h-3 w-3 text-blue-500" />
                                ) : (
                                  <ArrowDownRight className="h-3 w-3 text-green-500" />
                                )}
                                <span className="text-sm capitalize">{log.direction}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {log.to_number || log.from_number || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900 max-w-xs truncate">
                                {log.message_body || (log.channel === 'voice' ? 'Voice call' : '-')}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {log.shipment_number && (
                                <span className="text-indigo-600">
                                  {log.shipment_number}
                                </span>
                              )}
                              {log.carrier_name && (
                                <span className="block text-xs text-gray-400">
                                  {log.carrier_name}
                                </span>
                              )}
                              {log.customer_name && (
                                <span className="block text-xs text-gray-400">
                                  {log.customer_name}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  STATUS_COLORS[log.status] || 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {formatDate(log.sent_at || log.created_at)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ======== Templates Tab ======== */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => openTemplateModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  New Template
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.length === 0 ? (
                  <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-900 font-medium">No templates yet</p>
                    <p className="text-gray-500 mt-1">
                      Create templates for common messages like check calls and status updates
                    </p>
                  </div>
                ) : (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-white rounded-xl border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase font-medium">
                              {template.channel}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                              {CATEGORY_LABELS[template.category] || template.category}
                            </span>
                            {!template.is_active && (
                              <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-600">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => applyTemplate(template)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                            title="Use this template"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openTemplateModal(template)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-500 mt-2">{template.description}</p>
                      )}
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {template.template_body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ======== Send Message Tab ======== */}
          {activeTab === 'send' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <h3 className="text-lg font-semibold text-gray-900">Compose Message</h3>

                {/* Channel */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                  <div className="flex gap-3">
                    {[
                      { value: 'sms', label: 'SMS', icon: MessageSquare },
                      { value: 'voice', label: 'Voice Call', icon: Phone },
                    ].map((ch) => (
                      <button
                        key={ch.value}
                        onClick={() => setSendForm({ ...sendForm, channel: ch.value })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          sendForm.channel === ch.value
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <ch.icon className="h-4 w-4" />
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* To Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={sendForm.to_number}
                    onChange={(e) => setSendForm({ ...sendForm, to_number: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {sendForm.channel === 'voice' ? 'Call Script (optional)' : 'Message'}
                  </label>
                  <textarea
                    value={sendForm.message_body}
                    onChange={(e) => {
                      setSendForm({ ...sendForm, message_body: e.target.value })
                      setPreviewText(null)
                    }}
                    rows={4}
                    placeholder={
                      sendForm.channel === 'voice'
                        ? 'Enter a script for the call...'
                        : 'Type your message or use {{variables}} from templates...'
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-gray-400 mr-1">Insert:</span>
                    {[
                      'shipment_number',
                      'carrier_name',
                      'customer_name',
                      'origin_city',
                      'destination_city',
                    ].map((v) => (
                      <button
                        key={v}
                        onClick={() => insertVariable(v)}
                        className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Entity Links */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Shipment ID</label>
                    <input
                      type="text"
                      value={sendForm.shipment_id}
                      onChange={(e) => setSendForm({ ...sendForm, shipment_id: e.target.value })}
                      placeholder="Optional"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Carrier ID</label>
                    <input
                      type="text"
                      value={sendForm.carrier_id}
                      onChange={(e) => setSendForm({ ...sendForm, carrier_id: e.target.value })}
                      placeholder="Optional"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Customer ID</label>
                    <input
                      type="text"
                      value={sendForm.customer_id}
                      onChange={(e) => setSendForm({ ...sendForm, customer_id: e.target.value })}
                      placeholder="Optional"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Preview */}
                {previewText && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs font-medium text-indigo-600 mb-1">Preview:</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{previewText}</p>
                  </div>
                )}

                {/* Result */}
                {sendResult && (
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      sendResult.startsWith('Error')
                        ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {sendResult}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handlePreview}
                    disabled={!sendForm.message_body}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!sendForm.to_number || sending}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : sendForm.channel === 'sms' ? (
                      <Send className="h-4 w-4" />
                    ) : (
                      <PhoneCall className="h-4 w-4" />
                    )}
                    {sending
                      ? 'Sending...'
                      : sendForm.channel === 'sms'
                      ? 'Send SMS'
                      : 'Make Call'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======== Check-Call Schedule Tab ======== */}
          {activeTab === 'check-calls' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200">
                {checkCalls.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                    <p className="text-gray-900 font-medium">No check calls needed</p>
                    <p className="text-gray-500 mt-1">No in-transit shipments requiring check calls</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Carrier</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Phone</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Last Contact</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Next Call</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {checkCalls.map((item) => (
                        <tr
                          key={item.shipment_id}
                          className={`hover:bg-gray-50 ${item.is_overdue ? 'bg-red-50' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {item.shipment_number}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium capitalize">
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.carrier_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.carrier_phone || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {item.last_contact ? (
                              <span className="text-gray-600">
                                {formatHours(item.hours_since_contact)}
                              </span>
                            ) : (
                              <span className="text-red-500 font-medium">Never</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.is_overdue ? (
                              <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                Overdue
                              </span>
                            ) : (
                              <span className="text-sm text-gray-600">
                                {formatDate(item.next_check_call)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleSendCheckCall(item.shipment_id)}
                              disabled={checkCallLoading === item.shipment_id || !item.carrier_phone}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {checkCallLoading === item.shipment_id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              Send
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======== Template Modal ======== */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g. Check Call - Standard"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                  <select
                    value={templateForm.channel}
                    onChange={(e) => setTemplateForm({ ...templateForm, channel: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="sms">SMS</option>
                    <option value="voice">Voice</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="check_call">Check Call</option>
                    <option value="delivery_notification">Delivery Notification</option>
                    <option value="pickup_reminder">Pickup Reminder</option>
                    <option value="rate_confirmation">Rate Confirmation</option>
                    <option value="status_update">Status Update</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder="What this template is for..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {templateForm.channel === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    placeholder="Email subject line..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Body
                </label>
                <textarea
                  value={templateForm.template_body}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, template_body: e.target.value })
                  }
                  rows={5}
                  placeholder="Type your template. Use {{variable}} for dynamic content..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-gray-400 mr-1">Insert:</span>
                  {[
                    'shipment_number',
                    'carrier_name',
                    'customer_name',
                    'origin_city',
                    'origin_state',
                    'destination_city',
                    'destination_state',
                    'pickup_date',
                    'delivery_date',
                    'driver_name',
                    'driver_phone',
                  ].map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  disabled={!templateForm.name || !templateForm.template_body}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editingTemplate ? 'Save Changes' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
