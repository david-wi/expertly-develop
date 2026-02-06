import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { OperationsMetrics as OperationsMetricsData } from '../types'
import {
  Activity,
  Clock,
  AlertTriangle,
  FileText,
  Handshake,
  BarChart3,
  Timer,
} from 'lucide-react'

export default function OperationsMetrics() {
  const [data, setData] = useState<OperationsMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await api.getOperationsMetrics(days)
      setData(result)
    } catch (error) {
      console.error('Failed to fetch operations metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${hours.toFixed(1)}h`
    return `${(hours / 24).toFixed(1)}d`
  }

  const getWorkTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      quote_request: 'Quote Requests',
      quote_followup: 'Quote Follow-ups',
      shipment_needs_carrier: 'Needs Carrier',
      tender_pending: 'Tender Pending',
      check_call_due: 'Check Calls',
      document_needed: 'Documents Needed',
      invoice_ready: 'Invoice Ready',
      exception: 'Exceptions',
      custom: 'Custom',
    }
    return labels[type] || type.replace(/_/g, ' ')
  }

  const getWorkTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      quote_request: 'bg-emerald-500',
      quote_followup: 'bg-teal-500',
      shipment_needs_carrier: 'bg-blue-500',
      tender_pending: 'bg-indigo-500',
      check_call_due: 'bg-amber-500',
      document_needed: 'bg-purple-500',
      invoice_ready: 'bg-orange-500',
      exception: 'bg-red-500',
      custom: 'bg-gray-500',
    }
    return colors[type] || 'bg-gray-500'
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading operations metrics...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-7 w-7 text-indigo-600" />
            Operations Metrics
          </h1>
          <p className="text-gray-500">Work items, quote performance, and tender analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Time period:</span>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {[
              { label: '7d', value: 7 },
              { label: '30d', value: 30 },
              { label: '90d', value: 90 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Work Items Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Open Items</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data?.work_items.open || 0}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Overdue</span>
            </div>
            <p className={`text-3xl font-bold ${(data?.work_items.overdue || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {data?.work_items.overdue || 0}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Timer className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Avg Completion</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {data ? formatHours(data.work_items.avg_completion_hours) : '--'}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Types</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {data ? Object.keys(data.work_items.by_type).length : 0}
            </p>
          </div>
        </div>

        {/* Work Items by Type */}
        {data && Object.keys(data.work_items.by_type).length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Breakdown by Type</h3>
            <div className="space-y-3">
              {Object.entries(data.work_items.by_type)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([type, count]) => {
                  const total = data.work_items.open || 1
                  const pct = ((count as number) / total * 100)
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-36 truncate">{getWorkTypeLabel(type)}</span>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getWorkTypeColor(type)} transition-all`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-10 text-right">{count as number}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Quote & Tender Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quote Performance */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Quote Performance
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Quotes</p>
                <p className="text-3xl font-bold text-gray-900">{data?.quotes.total || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Win Rate</p>
                <p className={`text-3xl font-bold ${
                  (data?.quotes.win_rate || 0) >= 30 ? 'text-emerald-600' :
                  (data?.quotes.win_rate || 0) >= 15 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {data?.quotes.win_rate || 0}%
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Win Rate</span>
                <span className="text-sm font-semibold text-gray-700">{data?.quotes.win_rate || 0}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (data?.quotes.win_rate || 0) >= 30 ? 'bg-emerald-500' :
                    (data?.quotes.win_rate || 0) >= 15 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(data?.quotes.win_rate || 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Avg Response Time</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data ? formatHours(data.quotes.avg_response_hours) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tender Performance */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-gray-400" />
              Tender Performance
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Acceptance Rate</p>
                <p className={`text-3xl font-bold ${
                  (data?.tenders.acceptance_rate || 0) >= 60 ? 'text-emerald-600' :
                  (data?.tenders.acceptance_rate || 0) >= 40 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {data?.tenders.acceptance_rate || 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Counter-Offer Rate</p>
                <p className="text-3xl font-bold text-gray-900">{data?.tenders.counter_offer_rate || 0}%</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Acceptance Rate</span>
                <span className="text-sm font-semibold text-gray-700">{data?.tenders.acceptance_rate || 0}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (data?.tenders.acceptance_rate || 0) >= 60 ? 'bg-emerald-500' :
                    (data?.tenders.acceptance_rate || 0) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(data?.tenders.acceptance_rate || 0, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Avg Time to Accept</p>
                <p className="text-lg font-semibold text-gray-900">
                  {data ? formatHours(data.tenders.avg_acceptance_hours) : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
