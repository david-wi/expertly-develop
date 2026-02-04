import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { QuoteRequest } from '../types'
import { Plus, Sparkles, ArrowRight, Mail, Clock, CheckCircle2, XCircle, FileText, Zap } from 'lucide-react'

export default function QuoteRequests() {
  const navigate = useNavigate()
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newRequest, setNewRequest] = useState({
    source_subject: '',
    raw_content: '',
    sender_email: '',
  })
  const [extracting, setExtracting] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'quoted'>('all')

  const fetchQuoteRequests = async () => {
    try {
      const data = await api.getQuoteRequests()
      setQuoteRequests(data)
    } catch (error) {
      console.error('Failed to fetch quote requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuoteRequests()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const created = await api.createQuoteRequest({
        source_type: 'manual',
        source_subject: newRequest.source_subject,
        raw_content: newRequest.raw_content,
        sender_email: newRequest.sender_email,
      })
      setQuoteRequests([created, ...quoteRequests])
      setShowNewForm(false)
      setNewRequest({ source_subject: '', raw_content: '', sender_email: '' })

      // Auto-extract
      handleExtract(created.id)
    } catch (error) {
      console.error('Failed to create quote request:', error)
    }
  }

  const handleExtract = async (id: string) => {
    setExtracting(id)
    try {
      const updated = await api.extractQuoteRequest(id)
      setQuoteRequests(quoteRequests.map(qr => qr.id === id ? updated : qr))
    } catch (error) {
      console.error('Failed to extract:', error)
    } finally {
      setExtracting(null)
    }
  }

  const handleCreateQuote = async (id: string) => {
    try {
      const result = await api.createQuoteFromRequest(id)
      navigate(`/quotes/${result.quote_id}`)
    } catch (error) {
      console.error('Failed to create quote:', error)
    }
  }

  const statusConfig: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    new: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Mail },
    in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Clock },
    quoted: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
    declined: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  }

  const filteredRequests = filter === 'all'
    ? quoteRequests
    : quoteRequests.filter(qr => qr.status === filter)

  const stats = {
    new: quoteRequests.filter(qr => qr.status === 'new').length,
    in_progress: quoteRequests.filter(qr => qr.status === 'in_progress').length,
    quoted: quoteRequests.filter(qr => qr.status === 'quoted').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote Requests</h1>
          <p className="text-gray-500">Paste emails, AI extracts the details</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilter(filter === 'new' ? 'all' : 'new')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'new' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-900">{stats.new}</p>
              <p className="text-sm text-gray-500">New Requests</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setFilter(filter === 'in_progress' ? 'all' : 'in_progress')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'in_progress' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-900">{stats.in_progress}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setFilter(filter === 'quoted' ? 'all' : 'quoted')}
          className={`p-4 rounded-xl border transition-all ${
            filter === 'quoted' ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-900">{stats.quoted}</p>
              <p className="text-sm text-gray-500">Quoted</p>
            </div>
          </div>
        </button>
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Paste Rate Request</h2>
              <p className="text-sm text-gray-500">AI will extract origin, destination, dates, and more</p>
            </div>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject / Reference
                </label>
                <input
                  type="text"
                  value={newRequest.source_subject}
                  onChange={(e) => setNewRequest({ ...newRequest, source_subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Rate request for Chicago to Dallas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={newRequest.sender_email}
                  onChange={(e) => setNewRequest({ ...newRequest, sender_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="customer@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Content
              </label>
              <textarea
                value={newRequest.raw_content}
                onChange={(e) => setNewRequest({ ...newRequest, raw_content: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                placeholder="Paste the email content here...

Example:
Hi, need a rate for:
- Pickup: Chicago, IL on Feb 15
- Delivery: Dallas, TX
- Equipment: Dry van
- Weight: 42,000 lbs
- Commodity: Auto parts"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Create & Extract with AI
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quote Requests List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No quote requests {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Create your first request →
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredRequests.map((qr) => {
              const status = statusConfig[qr.status] || statusConfig.new
              const StatusIcon = status.icon
              return (
                <li key={qr.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {qr.source_subject || 'Untitled Request'}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
                          <StatusIcon className="h-3 w-3" />
                          {qr.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {qr.sender_email || 'Unknown sender'} · {new Date(qr.received_at).toLocaleDateString()}
                      </p>

                      {/* Extracted Data Preview */}
                      {qr.extracted_origin_city && qr.extracted_destination_city && (
                        <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {qr.extracted_origin_city.value}, {qr.extracted_origin_state?.value}
                              </span>
                              <ArrowRight className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium text-gray-900">
                                {qr.extracted_destination_city.value}, {qr.extracted_destination_state?.value}
                              </span>
                            </div>
                            {qr.extracted_equipment_type && (
                              <span className="px-2 py-0.5 bg-white rounded text-xs font-medium text-gray-600 border">
                                {String(qr.extracted_equipment_type.value)}
                              </span>
                            )}
                          </div>
                          {qr.extracted_pickup_date && (
                            <p className="mt-1 text-xs text-gray-600">
                              Pickup: {String(qr.extracted_pickup_date.value)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Confidence & Missing Fields */}
                      <div className="mt-2 flex items-center gap-4">
                        {qr.extraction_confidence > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  qr.extraction_confidence > 0.8 ? 'bg-emerald-500' :
                                  qr.extraction_confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${qr.extraction_confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round(qr.extraction_confidence * 100)}%
                            </span>
                          </div>
                        )}
                        {qr.missing_fields.length > 0 && (
                          <p className="text-xs text-amber-600">
                            Missing: {qr.missing_fields.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {qr.status === 'new' && (
                        <button
                          onClick={() => handleExtract(qr.id)}
                          disabled={extracting === qr.id}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50 transition-colors"
                        >
                          <Sparkles className="h-4 w-4" />
                          {extracting === qr.id ? 'Extracting...' : 'Extract'}
                        </button>
                      )}
                      {(qr.status === 'new' || qr.status === 'in_progress') && qr.extracted_origin_city && (
                        <button
                          onClick={() => handleCreateQuote(qr.id)}
                          className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          Create Quote
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
