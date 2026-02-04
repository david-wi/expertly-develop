import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { QuoteRequest } from '../types'
import { Plus, Sparkles, ArrowRight } from 'lucide-react'

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

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    quoted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote Requests</h1>
          <p className="text-gray-500">Incoming rate requests</p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Enter Rate Request</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject / Reference
              </label>
              <input
                type="text"
                value={newRequest.source_subject}
                onChange={(e) => setNewRequest({ ...newRequest, source_subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Request Details
              </label>
              <textarea
                value={newRequest.raw_content}
                onChange={(e) => setNewRequest({ ...newRequest, raw_content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Paste the email content or enter shipment details..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create & Extract
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quote Requests List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : quoteRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No quote requests yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {quoteRequests.map((qr) => (
              <li key={qr.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {qr.source_subject || 'Untitled Request'}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[qr.status]}`}>
                        {qr.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {qr.sender_email || 'Unknown sender'} · {new Date(qr.received_at).toLocaleDateString()}
                    </p>

                    {/* Extracted Data Preview */}
                    {qr.extracted_origin_city && qr.extracted_destination_city && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-gray-700">
                          {qr.extracted_origin_city.value}, {qr.extracted_origin_state?.value}
                        </span>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">
                          {qr.extracted_destination_city.value}, {qr.extracted_destination_state?.value}
                        </span>
                        {qr.extracted_equipment_type && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {String(qr.extracted_equipment_type.value)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Confidence Indicator */}
                    {qr.extraction_confidence > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-32">
                          <div
                            className={`h-full rounded-full ${
                              qr.extraction_confidence > 0.8 ? 'bg-green-500' :
                              qr.extraction_confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${qr.extraction_confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(qr.extraction_confidence * 100)}% confidence
                        </span>
                      </div>
                    )}

                    {/* Missing Fields */}
                    {qr.missing_fields.length > 0 && (
                      <p className="mt-2 text-xs text-orange-600">
                        Missing: {qr.missing_fields.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {qr.status === 'new' && (
                      <button
                        onClick={() => handleExtract(qr.id)}
                        disabled={extracting === qr.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        {extracting === qr.id ? 'Extracting...' : 'Extract'}
                      </button>
                    )}
                    {(qr.status === 'new' || qr.status === 'in_progress') && qr.extracted_origin_city && (
                      <button
                        onClick={() => handleCreateQuote(qr.id)}
                        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        Create Quote
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
