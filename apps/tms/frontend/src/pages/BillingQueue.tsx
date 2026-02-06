import { useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  DollarSign,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Check,
  Loader2,
  Link2,
  Clock,
  Ban,
  Receipt,
  Truck,
} from 'lucide-react'

// ============================================================================
// Types (local to this page, to be moved to types/index.ts)
// ============================================================================

interface BillingQueueItem {
  item_type: string
  id: string
  reference: string
  amount: number
  status: string
  due_date?: string
  details?: string
  created_at: string
}

interface CarrierBill {
  id: string
  carrier_id: string
  shipment_id: string
  bill_number: string
  amount: number
  received_date: string
  due_date?: string
  status: string
  matched_tender_id?: string
  variance_amount?: number
  variance_reason?: string
  approved_by?: string
  paid_at?: string
  notes?: string
  created_at: string
  updated_at: string
  carrier_name?: string
  shipment_number?: string
}

interface BillingSummary {
  outstanding_ar: number
  outstanding_ar_count: number
  outstanding_ap: number
  outstanding_ap_count: number
  revenue: number
  revenue_invoice_count: number
  cost: number
  cost_bill_count: number
  margin: number
  margin_percent: number
}

interface MatchResult {
  matched: boolean
  tender_id?: string
  tender_rate?: number
  variance_amount?: number
  variance_reason?: string
  message: string
}

// ============================================================================
// Constants
// ============================================================================

const BILL_STATUS_COLORS: Record<string, string> = {
  received: 'bg-yellow-100 text-yellow-700',
  matched: 'bg-blue-100 text-blue-700',
  disputed: 'bg-red-100 text-red-700',
  approved: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-green-100 text-green-700',
}

const QUEUE_ITEM_ICONS: Record<string, typeof AlertTriangle> = {
  unmatched_bill: AlertTriangle,
  overdue_invoice: Clock,
  draft_invoice: FileText,
  disputed_bill: Ban,
}

const QUEUE_ITEM_COLORS: Record<string, string> = {
  unmatched_bill: 'border-l-amber-500 bg-amber-50',
  overdue_invoice: 'border-l-red-500 bg-red-50',
  draft_invoice: 'border-l-gray-400 bg-gray-50',
  disputed_bill: 'border-l-red-500 bg-red-50',
}

// ============================================================================
// Component
// ============================================================================

export default function BillingQueue() {
  const [activeTab, setActiveTab] = useState<'queue' | 'carrier-bills' | 'summary'>('queue')
  const [queueItems, setQueueItems] = useState<BillingQueueItem[]>([])
  const [carrierBills, setCarrierBills] = useState<CarrierBill[]>([])
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Generate invoice modal
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateShipmentId, setGenerateShipmentId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<string | null>(null)

  // Bill status filter
  const [billStatusFilter, setBillStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [activeTab, billStatusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'queue') {
        const data = await api.getBillingQueue()
        setQueueItems(data)
      } else if (activeTab === 'carrier-bills') {
        const params: Record<string, string> = {}
        if (billStatusFilter !== 'all') params.status = billStatusFilter
        const data = await api.getCarrierBills(params)
        setCarrierBills(data)
      }
      // Always load summary for the header cards
      const summaryData = await api.getBillingSummary()
      setSummary(summaryData)
    } catch (error) {
      console.error('Failed to fetch billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMatchBill = async (billId: string) => {
    setActionLoading(billId)
    try {
      const result: MatchResult = await api.matchCarrierBill(billId)
      if (result.matched) {
        // Refresh the list
        await fetchData()
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('Failed to match bill:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveBill = async (billId: string) => {
    setActionLoading(billId)
    try {
      await api.approveCarrierBill(billId)
      await fetchData()
    } catch (error) {
      console.error('Failed to approve bill:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateInvoice = async () => {
    if (!generateShipmentId.trim()) return
    setGenerating(true)
    setGenerateResult(null)
    try {
      const result = await api.generateBillingInvoice(generateShipmentId)
      setGenerateResult(`Invoice ${result.invoice_number} created for $${(result.total / 100).toFixed(2)}`)
      await fetchData()
    } catch (error: any) {
      setGenerateResult(`Error: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const formatCents = (cents: number) => {
    const negative = cents < 0
    const abs = Math.abs(cents)
    return `${negative ? '-' : ''}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-emerald-600" />
            Billing Queue
          </h1>
          <p className="text-gray-500">
            Manage invoices, carrier bills, and billing summary
          </p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Receipt className="h-4 w-4" />
          Generate Invoice
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding AR</p>
                <p className="text-xl font-bold text-blue-600">{formatCents(summary.outstanding_ar)}</p>
                <p className="text-xs text-gray-400">{summary.outstanding_ar_count} invoices</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowDownRight className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding AP</p>
                <p className="text-xl font-bold text-red-600">{formatCents(summary.outstanding_ap)}</p>
                <p className="text-xs text-gray-400">{summary.outstanding_ap_count} bills</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCents(summary.revenue)}</p>
                <p className="text-xs text-gray-400">{summary.revenue_invoice_count} paid</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Margin</p>
                <p className="text-xl font-bold text-emerald-600">{formatCents(summary.margin)}</p>
                <p className="text-xs text-gray-400">{summary.margin_percent}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'queue' as const, label: 'Billing Queue', icon: AlertTriangle },
          { id: 'carrier-bills' as const, label: 'Carrier Bills', icon: Truck },
          { id: 'summary' as const, label: 'Summary', icon: TrendingUp },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-600 text-emerald-700'
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
          <p className="text-gray-500 mt-2">Loading billing data...</p>
        </div>
      ) : (
        <>
          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              {queueItems.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Check className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">All caught up!</p>
                  <p className="text-gray-500 mt-1">No billing items need attention</p>
                </div>
              ) : (
                queueItems.map((item) => {
                  const Icon = QUEUE_ITEM_ICONS[item.item_type] || AlertTriangle
                  const colorClass = QUEUE_ITEM_COLORS[item.item_type] || 'border-l-gray-400 bg-gray-50'
                  return (
                    <div
                      key={`${item.item_type}-${item.id}`}
                      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${colorClass} p-4`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-gray-900">{item.reference}</p>
                            <p className="text-sm text-gray-500">{item.details}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span className="capitalize">{item.item_type.replace(/_/g, ' ')}</span>
                              {item.due_date && (
                                <span>Due: {formatDate(item.due_date)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{formatCents(item.amount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${BILL_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Carrier Bills Tab */}
          {activeTab === 'carrier-bills' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'received', label: 'Received' },
                  { value: 'matched', label: 'Matched' },
                  { value: 'disputed', label: 'Disputed' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'paid', label: 'Paid' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setBillStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      billStatusFilter === f.value
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Bills Table */}
              <div className="bg-white rounded-xl border border-gray-200">
                {carrierBills.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No carrier bills found</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Bill #</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Carrier</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Received</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Amount</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Variance</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {carrierBills.map((bill) => (
                        <tr key={bill.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{bill.bill_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{bill.carrier_name || bill.carrier_id.slice(-8)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{bill.shipment_number || bill.shipment_id.slice(-8)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(bill.received_date)}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCents(bill.amount)}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {bill.variance_amount != null ? (
                              <span className={bill.variance_amount > 0 ? 'text-red-600' : bill.variance_amount < 0 ? 'text-green-600' : 'text-gray-500'}>
                                {bill.variance_amount > 0 ? '+' : ''}{formatCents(bill.variance_amount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${BILL_STATUS_COLORS[bill.status] || 'bg-gray-100 text-gray-600'}`}>
                              {bill.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              {bill.status === 'received' && (
                                <button
                                  onClick={() => handleMatchBill(bill.id)}
                                  disabled={actionLoading === bill.id}
                                  className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                                >
                                  {actionLoading === bill.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Link2 className="h-3 w-3" />
                                  )}
                                  Match
                                </button>
                              )}
                              {(bill.status === 'matched' || bill.status === 'disputed') && (
                                <button
                                  onClick={() => handleApproveBill(bill.id)}
                                  disabled={actionLoading === bill.id}
                                  className="flex items-center gap-1 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                >
                                  {actionLoading === bill.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Approve
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
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && summary && (
            <div className="grid grid-cols-2 gap-6">
              {/* AR Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-blue-600" />
                  Accounts Receivable
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-600">Outstanding</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCents(summary.outstanding_ar)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500">Unpaid invoices</span>
                    <span className="font-medium">{summary.outstanding_ar_count}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500">Collected (paid)</span>
                    <span className="font-medium text-green-600">{formatCents(summary.revenue)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500">Paid invoices</span>
                    <span className="font-medium">{summary.revenue_invoice_count}</span>
                  </div>
                </div>
              </div>

              {/* AP Breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                  Accounts Payable
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-600">Outstanding</span>
                    <span className="text-2xl font-bold text-red-600">{formatCents(summary.outstanding_ap)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500">Unpaid carrier bills</span>
                    <span className="font-medium">{summary.outstanding_ap_count}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500">Paid to carriers</span>
                    <span className="font-medium text-red-600">{formatCents(summary.cost)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-500">Paid bills</span>
                    <span className="font-medium">{summary.cost_bill_count}</span>
                  </div>
                </div>
              </div>

              {/* Margin Overview */}
              <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Margin Overview
                </h3>
                <div className="grid grid-cols-4 gap-8">
                  <div>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">{formatCents(summary.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Cost</p>
                    <p className="text-2xl font-bold text-red-600">{formatCents(summary.cost)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Gross Margin</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCents(summary.margin)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Margin %</p>
                    <p className="text-2xl font-bold text-emerald-600">{summary.margin_percent}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate Invoice Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Invoice from Shipment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shipment ID</label>
                <input
                  type="text"
                  value={generateShipmentId}
                  onChange={(e) => setGenerateShipmentId(e.target.value)}
                  placeholder="Enter delivered shipment ID..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-400 mt-1">Only delivered shipments can be invoiced</p>
              </div>
              {generateResult && (
                <div className={`p-3 rounded-lg text-sm ${generateResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {generateResult}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowGenerateModal(false); setGenerateShipmentId(''); setGenerateResult(null) }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {generateResult && !generateResult.startsWith('Error') ? 'Close' : 'Cancel'}
                </button>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={!generateShipmentId.trim() || generating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
