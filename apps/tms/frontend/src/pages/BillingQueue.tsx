import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type {
  AgingBucket,
  AgingReportResponse,
  PayablesAgingResponse,
  QuickPayOffer,
  FactoringAssignment,
  CarrierInvoiceRecord,
  BatchInvoiceResponse,
  CashFlowProjection,
} from '../types'
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
  Zap,
  Building2,
  Upload,
  Shield,
  BarChart3,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ListChecks,
} from 'lucide-react'

// ============================================================================
// Types (local to this page)
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

const AGING_BUCKET_COLORS: Record<string, string> = {
  current: 'bg-green-100 text-green-800',
  '1_30': 'bg-yellow-100 text-yellow-800',
  '31_60': 'bg-orange-100 text-orange-800',
  '61_90': 'bg-red-100 text-red-800',
  '91_120': 'bg-red-200 text-red-900',
  '120_plus': 'bg-red-300 text-red-900',
  '90_plus': 'bg-red-300 text-red-900',
}

const CARRIER_INVOICE_STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-700',
  extracted: 'bg-blue-100 text-blue-700',
  matched: 'bg-green-100 text-green-700',
  discrepancy: 'bg-red-100 text-red-700',
  approved: 'bg-emerald-100 text-emerald-700',
}

type TabId = 'queue' | 'carrier-bills' | 'aging-ar' | 'aging-ap' | 'quick-pay' | 'factoring' | 'carrier-invoices' | 'summary'

// ============================================================================
// Component
// ============================================================================

export default function BillingQueue() {
  const [activeTab, setActiveTab] = useState<TabId>('queue')
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

  // Batch invoicing modal
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchShipmentIds, setBatchShipmentIds] = useState('')
  const [batchConsolidate, setBatchConsolidate] = useState(false)
  const [batchAutoSend, setBatchAutoSend] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchInvoiceResponse | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)

  // Bill status filter
  const [billStatusFilter, setBillStatusFilter] = useState<string>('all')

  // Aging reports
  const [arAging, setArAging] = useState<AgingReportResponse | null>(null)
  const [apAging, setApAging] = useState<PayablesAgingResponse | null>(null)

  // Quick pay
  const [quickPayOffers, setQuickPayOffers] = useState<QuickPayOffer[]>([])

  // Factoring
  const [factoringAssignments, setFactoringAssignments] = useState<FactoringAssignment[]>([])

  // Carrier invoices
  const [carrierInvoices, setCarrierInvoices] = useState<CarrierInvoiceRecord[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCarrierId, setUploadCarrierId] = useState('')
  const [uploadInvoiceNumber, setUploadInvoiceNumber] = useState('')
  const [uploadAmount, setUploadAmount] = useState('')
  const [uploadRefNumbers, setUploadRefNumbers] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)

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
      } else if (activeTab === 'aging-ar') {
        const data = await api.getARAgingReport()
        setArAging(data)
      } else if (activeTab === 'aging-ap') {
        const data = await api.getPayablesAgingReport()
        setApAging(data)
      } else if (activeTab === 'quick-pay') {
        const data = await api.getQuickPayOffers()
        setQuickPayOffers(data)
      } else if (activeTab === 'factoring') {
        const data = await api.getFactoringStatus()
        setFactoringAssignments(data)
      } else if (activeTab === 'carrier-invoices') {
        const data = await api.getCarrierInvoices()
        setCarrierInvoices(data)
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

  const handleAutoInvoiceFromPOD = async () => {
    if (!generateShipmentId.trim()) return
    setGenerating(true)
    setGenerateResult(null)
    try {
      const result = await api.autoInvoiceFromPOD(generateShipmentId)
      let msg = `Invoice ${result.invoice_number} created for $${(result.total / 100).toFixed(2)}`
      if (result.ai_detected_accessorials.length > 0) {
        msg += ` (AI detected: ${result.ai_detected_accessorials.join(', ')})`
      }
      setGenerateResult(msg)
      await fetchData()
    } catch (error: any) {
      setGenerateResult(`Error: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleBatchGenerate = async () => {
    setBatchLoading(true)
    setBatchResult(null)
    try {
      const ids = batchShipmentIds.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
      const result = await api.batchGenerateInvoices({
        shipment_ids: ids,
        consolidate_by_customer: batchConsolidate,
        auto_send: batchAutoSend,
      })
      setBatchResult(result)
      await fetchData()
    } catch (error: any) {
      setBatchResult({ total_processed: 0, created: 0, skipped: 0, errors: 1, results: [{ shipment_id: '', status: 'error', message: error.message }] })
    } finally {
      setBatchLoading(false)
    }
  }

  const handleUploadCarrierInvoice = async () => {
    setUploadLoading(true)
    try {
      await api.uploadCarrierInvoice({
        carrier_id: uploadCarrierId,
        invoice_number: uploadInvoiceNumber || undefined,
        amount: uploadAmount ? Math.round(parseFloat(uploadAmount) * 100) : undefined,
        reference_numbers: uploadRefNumbers ? uploadRefNumbers.split(',').map(s => s.trim()).filter(Boolean) : [],
      })
      setShowUploadModal(false)
      setUploadCarrierId('')
      setUploadInvoiceNumber('')
      setUploadAmount('')
      setUploadRefNumbers('')
      await fetchData()
    } catch (error: any) {
      alert(`Upload failed: ${error.message}`)
    } finally {
      setUploadLoading(false)
    }
  }

  const handleMatchCarrierInvoice = async (invoiceId: string) => {
    setActionLoading(invoiceId)
    try {
      await api.matchCarrierInvoice(invoiceId)
      await fetchData()
    } catch (error) {
      console.error('Failed to match carrier invoice:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApproveCarrierInvoice = async (invoiceId: string) => {
    setActionLoading(invoiceId)
    try {
      await api.approveCarrierInvoice(invoiceId)
      await fetchData()
    } catch (error) {
      console.error('Failed to approve carrier invoice:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptQuickPay = async (offerId: string, tierName: string) => {
    setActionLoading(offerId)
    try {
      await api.acceptQuickPay(offerId, tierName)
      await fetchData()
    } catch (error) {
      console.error('Failed to accept quick pay:', error)
    } finally {
      setActionLoading(null)
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
            Manage invoices, carrier bills, aging reports, quick pay, and factoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50"
          >
            <ListChecks className="h-4 w-4" />
            Batch Invoice
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Receipt className="h-4 w-4" />
            Generate Invoice
          </button>
        </div>
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
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {([
          { id: 'queue' as TabId, label: 'Queue', icon: AlertTriangle },
          { id: 'carrier-bills' as TabId, label: 'Carrier Bills', icon: Truck },
          { id: 'aging-ar' as TabId, label: 'AR Aging', icon: BarChart3 },
          { id: 'aging-ap' as TabId, label: 'AP Aging', icon: ArrowDownRight },
          { id: 'quick-pay' as TabId, label: 'Quick Pay', icon: Zap },
          { id: 'factoring' as TabId, label: 'Factoring', icon: Building2 },
          { id: 'carrier-invoices' as TabId, label: 'Carrier Invoices', icon: Upload },
          { id: 'summary' as TabId, label: 'Summary', icon: TrendingUp },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
                                  {actionLoading === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                                  Match
                                </button>
                              )}
                              {(bill.status === 'matched' || bill.status === 'disputed') && (
                                <button
                                  onClick={() => handleApproveBill(bill.id)}
                                  disabled={actionLoading === bill.id}
                                  className="flex items-center gap-1 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                >
                                  {actionLoading === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
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

          {/* AR Aging Report Tab */}
          {activeTab === 'aging-ar' && arAging && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Accounts Receivable Aging</h2>
                  <p className="text-sm text-gray-500">As of {formatDate(arAging.as_of_date)} -- Total: {formatCents(arAging.total_outstanding)} ({arAging.total_count} invoices)</p>
                </div>
              </div>

              {/* Aging Buckets */}
              <div className="grid grid-cols-6 gap-3">
                {arAging.buckets.map((bucket: AgingBucket) => (
                  <div key={bucket.bucket} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${AGING_BUCKET_COLORS[bucket.bucket] || 'bg-gray-100 text-gray-600'}`}>
                      {bucket.label}
                    </span>
                    <p className="text-xl font-bold text-gray-900 mt-2">{formatCents(bucket.total_amount)}</p>
                    <p className="text-xs text-gray-400">{bucket.count} invoices</p>
                  </div>
                ))}
              </div>

              {/* By Customer */}
              {arAging.by_entity.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">By Customer</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Current</th>
                        <th className="px-4 py-3 text-right">1-30</th>
                        <th className="px-4 py-3 text-right">31-60</th>
                        <th className="px-4 py-3 text-right">61-90</th>
                        <th className="px-4 py-3 text-right">91-120</th>
                        <th className="px-4 py-3 text-right">120+</th>
                        <th className="px-4 py-3 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {arAging.by_entity.map((entity) => (
                        <tr key={entity.entity_id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{entity.entity_name}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents(entity.current as number || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((entity as any).past_due_1_30 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((entity as any).past_due_31_60 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((entity as any).past_due_61_90 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((entity as any).past_due_91_120 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{formatCents((entity as any).past_due_120_plus || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCents(entity.total_outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* AP Aging Report Tab */}
          {activeTab === 'aging-ap' && apAging && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Accounts Payable Aging</h2>
                <p className="text-sm text-gray-500">As of {formatDate(apAging.as_of_date)} -- Total: {formatCents(apAging.total_outstanding)} ({apAging.total_count} bills)</p>
              </div>

              {/* Aging Buckets */}
              <div className="grid grid-cols-5 gap-3">
                {apAging.buckets.map((bucket: AgingBucket) => (
                  <div key={bucket.bucket} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${AGING_BUCKET_COLORS[bucket.bucket] || 'bg-gray-100 text-gray-600'}`}>
                      {bucket.label}
                    </span>
                    <p className="text-xl font-bold text-gray-900 mt-2">{formatCents(bucket.total_amount)}</p>
                    <p className="text-xs text-gray-400">{bucket.count} bills</p>
                  </div>
                ))}
              </div>

              {/* Cash Flow Projection */}
              {apAging.cash_flow_projection && apAging.cash_flow_projection.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Cash Flow Projection (Next 8 Weeks)
                  </h3>
                  <div className="grid grid-cols-8 gap-2">
                    {apAging.cash_flow_projection.map((week: CashFlowProjection, idx: number) => (
                      <div key={idx} className="text-center">
                        <p className="text-xs text-gray-400">Week {idx + 1}</p>
                        <p className="text-sm font-bold text-red-600 mt-1">{formatCents(week.expected_outflow)}</p>
                        <p className="text-xs text-gray-400">{week.bill_count} bills</p>
                        <div
                          className="mx-auto mt-2 bg-red-200 rounded"
                          style={{
                            width: '24px',
                            height: `${Math.max(4, Math.min(60, week.expected_outflow / 1000))}px`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Carrier */}
              {apAging.by_carrier && apAging.by_carrier.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">By Carrier</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                        <th className="px-6 py-3">Carrier</th>
                        <th className="px-4 py-3 text-right">Current</th>
                        <th className="px-4 py-3 text-right">1-30</th>
                        <th className="px-4 py-3 text-right">31-60</th>
                        <th className="px-4 py-3 text-right">61-90</th>
                        <th className="px-4 py-3 text-right">90+</th>
                        <th className="px-4 py-3 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {apAging.by_carrier.map((carrier) => (
                        <tr key={carrier.entity_id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{carrier.entity_name}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents(carrier.current as number || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((carrier as any).past_due_1_30 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((carrier as any).past_due_31_60 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCents((carrier as any).past_due_61_90 || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right text-red-600 font-medium">{formatCents((carrier as any).past_due_90_plus || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatCents(carrier.total_outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Quick Pay Tab */}
          {activeTab === 'quick-pay' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    Quick Pay Offers
                  </h2>
                  <p className="text-sm text-gray-500">Offer carriers faster payment for a discount</p>
                </div>
              </div>

              {quickPayOffers.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Zap className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No quick pay offers</p>
                  <p className="text-gray-500 mt-1">Quick pay offers can be created from carrier bills</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quickPayOffers.map((offer) => (
                    <div key={offer.id} className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{offer.carrier_name}</h3>
                          <p className="text-sm text-gray-500">Bill Amount: {formatCents(offer.bill_amount)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          offer.status === 'offered' ? 'bg-amber-100 text-amber-700' :
                          offer.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {offer.status}
                        </span>
                      </div>

                      {offer.status === 'offered' && offer.tiers && (
                        <div className="grid grid-cols-4 gap-3">
                          {offer.tiers.map((tier) => (
                            <button
                              key={tier.name}
                              onClick={() => handleAcceptQuickPay(offer.id, tier.name)}
                              disabled={actionLoading === offer.id}
                              className="border border-gray-200 rounded-lg p-3 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-center"
                            >
                              <p className="font-semibold text-gray-900">{tier.name}</p>
                              <p className="text-xs text-gray-500">{tier.days} day{tier.days !== 1 ? 's' : ''}</p>
                              <p className="text-lg font-bold text-emerald-600 mt-1">{formatCents(tier.net_payment)}</p>
                              <p className="text-xs text-amber-600">{tier.discount_percent}% discount</p>
                            </button>
                          ))}
                        </div>
                      )}

                      {offer.status === 'accepted' && (
                        <div className="flex items-center gap-4 bg-green-50 rounded-lg p-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-800">Accepted: {offer.selected_tier}</p>
                            {offer.savings != null && (
                              <p className="text-xs text-green-600">Savings: {formatCents(offer.savings)}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Factoring Tab */}
          {activeTab === 'factoring' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    Factoring Assignments
                  </h2>
                  <p className="text-sm text-gray-500">Track NOA status and factoring company integrations</p>
                </div>
              </div>

              {factoringAssignments.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Building2 className="h-12 w-12 text-purple-300 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No factoring assignments</p>
                  <p className="text-gray-500 mt-1">Factoring assignments track NOA status for carriers using factoring companies</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Carrier</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Factoring Company</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">NOA Reference</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">NOA Date</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Fee %</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Total Factored</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {factoringAssignments.map((assignment) => (
                        <tr key={assignment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{assignment.carrier_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{assignment.factoring_company_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{assignment.noa_reference || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(assignment.noa_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              assignment.noa_status === 'active' ? 'bg-green-100 text-green-700' :
                              assignment.noa_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              assignment.noa_status === 'revoked' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {assignment.noa_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{assignment.fee_percent != null ? `${assignment.fee_percent}%` : '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCents(assignment.total_factored_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Carrier Invoices Tab */}
          {activeTab === 'carrier-invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    Carrier Invoice Processing
                  </h2>
                  <p className="text-sm text-gray-500">Upload, AI-extract, match, and approve carrier invoices</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload Invoice
                </button>
              </div>

              {carrierInvoices.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Upload className="h-12 w-12 text-blue-300 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No carrier invoices</p>
                  <p className="text-gray-500 mt-1">Upload carrier invoices for AI-powered extraction and matching</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Invoice #</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Carrier</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Amount</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Variance</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Confidence</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {carrierInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{inv.invoice_number || inv.id.slice(-8)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{inv.carrier_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{inv.shipment_number || '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {inv.extracted_amount != null ? formatCents(inv.extracted_amount) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {inv.variance != null ? (
                              <span className={inv.variance > 0 ? 'text-red-600' : inv.variance < 0 ? 'text-green-600' : 'text-gray-500'}>
                                {inv.variance > 0 ? '+' : ''}{formatCents(inv.variance)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {inv.match_confidence != null ? `${(inv.match_confidence * 100).toFixed(0)}%` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${CARRIER_INVOICE_STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                              {inv.status}
                            </span>
                            {inv.discrepancy_flags.length > 0 && (
                              <div className="mt-1">
                                {inv.discrepancy_flags.map((flag, i) => (
                                  <p key={i} className="text-xs text-red-500">{flag}</p>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              {(inv.status === 'uploaded' || inv.status === 'extracted') && (
                                <button
                                  onClick={() => handleMatchCarrierInvoice(inv.id)}
                                  disabled={actionLoading === inv.id}
                                  className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                                >
                                  {actionLoading === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                                  Match
                                </button>
                              )}
                              {(inv.status === 'matched' || inv.status === 'discrepancy') && (
                                <button
                                  onClick={() => handleApproveCarrierInvoice(inv.id)}
                                  disabled={actionLoading === inv.id}
                                  className="flex items-center gap-1 px-2 py-1 text-sm text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                >
                                  {actionLoading === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Approve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && summary && (
            <div className="grid grid-cols-2 gap-6">
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
                  onClick={handleAutoInvoiceFromPOD}
                  disabled={!generateShipmentId.trim() || generating}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  title="AI auto-detects accessorials from POD"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Auto (POD)
                </button>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={!generateShipmentId.trim() || generating}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Invoice Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-emerald-600" />
              Batch Invoice Generation
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shipment IDs (one per line or comma-separated)</label>
                <textarea
                  value={batchShipmentIds}
                  onChange={(e) => setBatchShipmentIds(e.target.value)}
                  placeholder="Enter shipment IDs..."
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchConsolidate}
                    onChange={(e) => setBatchConsolidate(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Consolidate by customer</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchAutoSend}
                    onChange={(e) => setBatchAutoSend(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Auto-send</span>
                </label>
              </div>

              {batchResult && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> {batchResult.created} created
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <ArrowRight className="h-4 w-4" /> {batchResult.skipped} skipped
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" /> {batchResult.errors} errors
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {batchResult.results.map((r, i) => (
                      <p key={i} className={`text-xs ${r.status === 'created' ? 'text-green-700' : r.status === 'skipped' ? 'text-gray-500' : 'text-red-600'}`}>
                        {r.shipment_id.slice(-8)}: {r.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowBatchModal(false); setBatchShipmentIds(''); setBatchResult(null) }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {batchResult ? 'Close' : 'Cancel'}
                </button>
                <button
                  onClick={handleBatchGenerate}
                  disabled={!batchShipmentIds.trim() || batchLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {batchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                  {batchLoading ? 'Processing...' : 'Generate Batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Carrier Invoice Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload Carrier Invoice
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier ID *</label>
                <input
                  type="text"
                  value={uploadCarrierId}
                  onChange={(e) => setUploadCarrierId(e.target.value)}
                  placeholder="Enter carrier ID..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={uploadInvoiceNumber}
                  onChange={(e) => setUploadInvoiceNumber(e.target.value)}
                  placeholder="e.g., INV-12345"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={uploadAmount}
                  onChange={(e) => setUploadAmount(e.target.value)}
                  placeholder="e.g., 1500.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Numbers (comma-separated)</label>
                <input
                  type="text"
                  value={uploadRefNumbers}
                  onChange={(e) => setUploadRefNumbers(e.target.value)}
                  placeholder="e.g., S-2026-00001, PRO123456"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">AI will use these to auto-match to shipments</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadCarrierInvoice}
                  disabled={!uploadCarrierId.trim() || uploadLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploadLoading ? 'Processing...' : 'Upload & Process'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
