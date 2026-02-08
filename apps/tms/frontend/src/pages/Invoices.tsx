import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Invoice, AgingReportResponse, AgingBucket, BatchInvoiceResponse, Shipment } from '../types'
import { FileText, Send, Check, DollarSign, Clock, Layers, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import PageHelp from '../components/PageHelp'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  void: 'bg-red-100 text-red-700',
}

type TabId = 'invoices' | 'aging' | 'batch'

export default function Invoices() {
  const [activeTab, setActiveTab] = useState<TabId>('invoices')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <PageHelp pageId="invoices" />
          </div>
          <p className="text-gray-500">Manage invoices, view aging reports, and batch generate</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'invoices' as TabId, label: 'Invoices', icon: FileText },
          { id: 'aging' as TabId, label: 'Aging Report', icon: Clock },
          { id: 'batch' as TabId, label: 'Batch Invoice', icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'invoices' && <InvoicesTab />}
      {activeTab === 'aging' && <AgingReportTab />}
      {activeTab === 'batch' && <BatchInvoiceTab />}
    </div>
  )
}

// =============================================================================
// Invoices Tab (original page content)
// =============================================================================

function InvoicesTab() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter !== 'all') params.status = statusFilter
      const data = await api.getInvoices(params)
      setInvoices(data)
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (invoice: Invoice) => {
    try {
      const updated = await api.sendInvoice(invoice.id)
      setInvoices(invoices.map(i => i.id === updated.id ? updated : i))
    } catch (error) {
      console.error('Failed to send invoice:', error)
    }
  }

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      const updated = await api.markInvoicePaid(invoice.id)
      setInvoices(invoices.map(i => i.id === updated.id ? updated : i))
    } catch (error) {
      console.error('Failed to mark invoice paid:', error)
    }
  }

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent')
    .reduce((sum, i) => sum + (i.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Draft</p>
              <p className="text-xl font-bold">{invoices.filter(i => i.status === 'draft').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="text-xl font-bold">${(totalOutstanding / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid (30d)</p>
              <p className="text-xl font-bold">
                ${(invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0) / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'draft', label: 'Draft' },
          { value: 'sent', label: 'Sent' },
          { value: 'paid', label: 'Paid' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No invoices found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Invoice #</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Amount</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{invoice.invoice_number}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.customer_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.shipment_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {invoice.invoice_date
                      ? new Date(invoice.invoice_date).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    ${((invoice.total || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[invoice.status]}`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleSend(invoice)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Send className="h-4 w-4" />
                          Send
                        </button>
                      )}
                      {invoice.status === 'sent' && (
                        <button
                          onClick={() => handleMarkPaid(invoice)}
                          className="flex items-center gap-1 px-2 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check className="h-4 w-4" />
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Aging Report Tab (Feature: 36c73d09)
// =============================================================================

const bucketColors: Record<string, string> = {
  current: 'bg-green-100 text-green-800 border-green-200',
  '1_30': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '31_60': 'bg-orange-100 text-orange-800 border-orange-200',
  '61_90': 'bg-red-100 text-red-800 border-red-200',
  '91_120': 'bg-red-200 text-red-900 border-red-300',
  '120_plus': 'bg-red-300 text-red-900 border-red-400',
}

function AgingReportTab() {
  const [report, setReport] = useState<AgingReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null)

  useEffect(() => {
    fetchAgingReport()
  }, [])

  const fetchAgingReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getARAgingReport()
      setReport(data)
    } catch (err) {
      console.error('Failed to fetch aging report:', err)
      setError('Failed to load aging report')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading aging report...</div>
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchAgingReport}
          className="mt-2 px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!report) {
    return <div className="p-8 text-center text-gray-500">No data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold">${(report.total_outstanding / 100).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Open Invoices</p>
              <p className="text-2xl font-bold">{report.total_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* As of date */}
      <p className="text-xs text-gray-400">
        As of {new Date(report.as_of_date).toLocaleString()}
      </p>

      {/* Aging Buckets Visualization */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Buckets</h3>

        {/* Bar Chart */}
        <div className="grid grid-cols-6 gap-2 mb-6">
          {report.buckets.map((bucket: AgingBucket) => {
            const maxAmount = Math.max(...report.buckets.map((b: AgingBucket) => b.total_amount), 1)
            const heightPercent = Math.max((bucket.total_amount / maxAmount) * 100, 4)
            const colorClass = bucketColors[bucket.bucket] || 'bg-gray-100 text-gray-800 border-gray-200'

            return (
              <div key={bucket.bucket} className="flex flex-col items-center">
                <div className="w-full h-32 flex items-end justify-center mb-2">
                  <div
                    className={`w-full rounded-t-lg border ${colorClass} transition-all cursor-pointer hover:opacity-80`}
                    style={{ height: `${heightPercent}%` }}
                    onClick={() => setExpandedBucket(expandedBucket === bucket.bucket ? null : bucket.bucket)}
                    title={`$${(bucket.total_amount / 100).toFixed(2)} (${bucket.count} invoices)`}
                  />
                </div>
                <p className="text-xs font-medium text-gray-600 text-center">{bucket.label}</p>
                <p className="text-sm font-bold text-gray-900">${(bucket.total_amount / 100).toFixed(0)}</p>
                <p className="text-xs text-gray-400">{bucket.count} inv</p>
              </div>
            )
          })}
        </div>

        {/* Bucket Details Table */}
        <div className="border-t border-gray-200 pt-4">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Bucket</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">Amount</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">Count</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">% of Total</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.buckets.map((bucket: AgingBucket) => {
                const pctOfTotal = report.total_outstanding > 0
                  ? ((bucket.total_amount / report.total_outstanding) * 100).toFixed(1)
                  : '0.0'
                const isExpanded = expandedBucket === bucket.bucket

                return (
                  <>
                    <tr
                      key={bucket.bucket}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedBucket(isExpanded ? null : bucket.bucket)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${bucketColors[bucket.bucket] || 'bg-gray-100'}`}>
                            {bucket.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        ${(bucket.total_amount / 100).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{bucket.count}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 text-right">{pctOfTotal}%</td>
                      <td className="px-3 py-2 text-right">
                        {bucket.total_amount > 0 && bucket.bucket !== 'current' && (
                          <AlertTriangle className="h-4 w-4 text-amber-500 inline" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && bucket.items.length > 0 && (
                      <tr key={`${bucket.bucket}-detail`}>
                        <td colSpan={5} className="px-3 py-0">
                          <div className="bg-gray-50 rounded-lg p-3 mb-2">
                            <table className="w-full">
                              <thead>
                                <tr className="text-left">
                                  <th className="px-2 py-1 text-xs text-gray-400">Invoice</th>
                                  <th className="px-2 py-1 text-xs text-gray-400">Customer</th>
                                  <th className="px-2 py-1 text-xs text-gray-400">Due Date</th>
                                  <th className="px-2 py-1 text-xs text-gray-400 text-right">Days Past Due</th>
                                  <th className="px-2 py-1 text-xs text-gray-400 text-right">Amount Due</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bucket.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-white">
                                    <td className="px-2 py-1 text-sm font-medium text-gray-900">
                                      {item.invoice_number || '-'}
                                    </td>
                                    <td className="px-2 py-1 text-sm text-gray-600">
                                      {item.billing_name || '-'}
                                    </td>
                                    <td className="px-2 py-1 text-sm text-gray-600">
                                      {item.due_date
                                        ? new Date(item.due_date).toLocaleDateString()
                                        : '-'}
                                    </td>
                                    <td className="px-2 py-1 text-sm text-gray-600 text-right">
                                      {item.days_past_due}
                                    </td>
                                    <td className="px-2 py-1 text-sm font-medium text-gray-900 text-right">
                                      ${((item.amount_due || item.amount || 0) / 100).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Customer */}
      {report.by_entity && report.by_entity.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Customer</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">Total Outstanding</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">Invoices</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">Current</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">1-30</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">31-60</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">61-90</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-right">90+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.by_entity.map((entity) => (
                <tr key={entity.entity_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">{entity.entity_name}</td>
                  <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                    ${((entity.total_outstanding as number) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 text-right">{entity.invoice_count || 0}</td>
                  <td className="px-3 py-2 text-sm text-gray-600 text-right">
                    ${((entity.current as number) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 text-right">
                    ${(((entity.past_due_1_30 as number) || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 text-right">
                    ${(((entity.past_due_31_60 as number) || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 text-right">
                    ${(((entity.past_due_61_90 as number) || 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600 text-right">
                    ${(((entity.past_due_91_120 as number || 0) + (entity.past_due_120_plus as number || 0)) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Batch Invoice Tab (Feature: f6a13915)
// =============================================================================

function BatchInvoiceTab() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [consolidateByCustomer, setConsolidateByCustomer] = useState(false)
  const [autoSend, setAutoSend] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<BatchInvoiceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDeliveredShipments()
  }, [])

  const fetchDeliveredShipments = async () => {
    setLoading(true)
    try {
      const data = await api.getShipments({ status: 'delivered' })
      setShipments(data)
    } catch (err) {
      console.error('Failed to fetch shipments:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === shipments.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(shipments.map(s => s.id)))
    }
  }

  const handleBatchGenerate = async () => {
    if (selectedIds.size === 0) return

    setGenerating(true)
    setResult(null)
    setError(null)

    try {
      const data = await api.batchGenerateInvoices({
        shipment_ids: Array.from(selectedIds),
        consolidate_by_customer: consolidateByCustomer,
        auto_send: autoSend,
      })
      setResult(data)
      setSelectedIds(new Set())
      // Refresh shipments list
      await fetchDeliveredShipments()
    } catch (err) {
      console.error('Batch invoice generation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate invoices')
    } finally {
      setGenerating(false)
    }
  }

  // Group shipments by customer for display
  const customerGroups = shipments.reduce<Record<string, Shipment[]>>((acc, s) => {
    const key = s.customer_name || s.customer_id
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Options */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Batch Invoice Options</h3>
            <p className="text-xs text-gray-500 mt-1">
              Select delivered shipments to generate invoices in bulk
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consolidateByCustomer}
                onChange={(e) => setConsolidateByCustomer(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              Consolidate by customer
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoSend}
                onChange={(e) => setAutoSend(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              Auto-send
            </label>
            <button
              onClick={handleBatchGenerate}
              disabled={selectedIds.size === 0 || generating}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Layers className="h-4 w-4" />
              {generating
                ? 'Generating...'
                : `Generate ${selectedIds.size} Invoice${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`rounded-lg border p-4 ${
          result.errors > 0
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-3">
            <Check className={`h-5 w-5 mt-0.5 ${result.errors > 0 ? 'text-yellow-600' : 'text-green-600'}`} />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Batch generation complete: {result.created} created, {result.skipped} skipped, {result.errors} errors
              </p>
              {result.results.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.results.map((r, i) => (
                    <p key={i} className="text-xs text-gray-600">
                      Shipment {r.shipment_id.slice(-8)}:
                      <span className={`ml-1 font-medium ${
                        r.status === 'created' ? 'text-green-700'
                          : r.status === 'skipped' ? 'text-yellow-700'
                            : 'text-red-700'
                      }`}>
                        {r.status}
                      </span>
                      {r.invoice_number && <span className="ml-1">- {r.invoice_number}</span>}
                      {r.total != null && <span className="ml-1">(${(r.total / 100).toFixed(2)})</span>}
                      {r.message && r.status !== 'created' && (
                        <span className="ml-1 text-gray-400">- {r.message}</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Shipments List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading delivered shipments...</div>
        ) : shipments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No delivered shipments available for invoicing
          </div>
        ) : (
          <>
            {/* Select All Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedIds.size === shipments.length && shipments.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Select all ({shipments.length} shipments)
              </label>
              <span className="text-xs text-gray-400">
                {selectedIds.size} selected
                {selectedIds.size > 0 && (
                  <span className="ml-2">
                    | Total: ${(shipments
                      .filter(s => selectedIds.has(s.id))
                      .reduce((sum, s) => sum + (s.customer_price || 0), 0) / 100
                    ).toFixed(2)}
                  </span>
                )}
              </span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-4 py-3 text-sm font-medium text-gray-500 w-10"></th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Route</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Delivered</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shipments.map((shipment) => (
                  <tr
                    key={shipment.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selectedIds.has(shipment.id) ? 'bg-emerald-50' : ''
                    }`}
                    onClick={() => toggleSelect(shipment.id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(shipment.id)}
                        onChange={() => toggleSelect(shipment.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{shipment.shipment_number}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {shipment.customer_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {shipment.origin_city && shipment.destination_city
                        ? `${shipment.origin_city}, ${shipment.origin_state} -> ${shipment.destination_city}, ${shipment.destination_state}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {shipment.delivery_date
                        ? new Date(shipment.delivery_date).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      ${((shipment.customer_price || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Customer Summary */}
      {Object.keys(customerGroups).length > 1 && selectedIds.size > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Selected by Customer</h3>
          <div className="space-y-2">
            {Object.entries(customerGroups).map(([customer, shipmentGroup]) => {
              const selectedInGroup = shipmentGroup.filter(s => selectedIds.has(s.id))
              if (selectedInGroup.length === 0) return null
              const groupTotal = selectedInGroup.reduce((sum, s) => sum + (s.customer_price || 0), 0)

              return (
                <div key={customer} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{customer}</span>
                  <span className="text-gray-500">
                    {selectedInGroup.length} shipment{selectedInGroup.length !== 1 ? 's' : ''} - ${(groupTotal / 100).toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
          {consolidateByCustomer && (
            <p className="text-xs text-emerald-600 mt-2">
              Shipments will be consolidated into one invoice per customer
            </p>
          )}
        </div>
      )}
    </div>
  )
}
