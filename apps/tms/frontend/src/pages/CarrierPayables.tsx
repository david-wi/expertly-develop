import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type {
  AgingBucket,
  PayablesAgingResponse,
  CarrierPayableBill,
  CarrierPayablesQuickPayOffer,
  CarrierPayablesFactoringAssignment,
  CarrierPayablesDashboard,
  CarrierInvoiceRecord,
  CarrierPayablesRateConMatch,
  CashFlowProjection,
} from '../types'
import {
  DollarSign,
  FileText,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle,
  Check,
  Loader2,
  Link2,
  Clock,
  Truck,
  Zap,
  Building2,
  Upload,
  BarChart3,
  CheckCircle2,
  XCircle,
  Shield,
  CreditCard,
} from 'lucide-react'

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

const AGING_BUCKET_COLORS: Record<string, string> = {
  current: 'bg-green-100 text-green-800',
  '1_30': 'bg-yellow-100 text-yellow-800',
  '31_60': 'bg-orange-100 text-orange-800',
  '61_90': 'bg-red-100 text-red-800',
  '90_plus': 'bg-red-300 text-red-900',
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  uploaded: 'bg-gray-100 text-gray-700',
  extracted: 'bg-blue-100 text-blue-700',
  matched: 'bg-green-100 text-green-700',
  discrepancy: 'bg-red-100 text-red-700',
  approved: 'bg-emerald-100 text-emerald-700',
}

type TabId = 'bills' | 'aging' | 'quick-pay' | 'factoring' | 'invoices'

// ============================================================================
// Component
// ============================================================================

export default function CarrierPayables() {
  const [activeTab, setActiveTab] = useState<TabId>('bills')
  const [dashboard, setDashboard] = useState<CarrierPayablesDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Bills
  const [bills, setBills] = useState<CarrierPayableBill[]>([])
  const [billStatusFilter, setBillStatusFilter] = useState<string>('all')

  // Aging
  const [apAging, setApAging] = useState<PayablesAgingResponse | null>(null)

  // Quick pay
  const [quickPayOffers, setQuickPayOffers] = useState<CarrierPayablesQuickPayOffer[]>([])

  // Factoring
  const [factoringAssignments, setFactoringAssignments] = useState<CarrierPayablesFactoringAssignment[]>([])
  const [showFactoringModal, setShowFactoringModal] = useState(false)
  const [factoringCarrierId, setFactoringCarrierId] = useState('')
  const [factoringCompanyName, setFactoringCompanyName] = useState('')
  const [factoringNoaRef, setFactoringNoaRef] = useState('')
  const [factoringPaymentEmail, setFactoringPaymentEmail] = useState('')
  const [factoringFeePercent, setFactoringFeePercent] = useState('')
  const [factoringLoading, setFactoringLoading] = useState(false)

  // Carrier invoices
  const [carrierInvoices, setCarrierInvoices] = useState<CarrierInvoiceRecord[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCarrierId, setUploadCarrierId] = useState('')
  const [uploadInvoiceNumber, setUploadInvoiceNumber] = useState('')
  const [uploadAmount, setUploadAmount] = useState('')
  const [uploadRefNumbers, setUploadRefNumbers] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)

  // Rate con match result
  const [rateConResult, setRateConResult] = useState<CarrierPayablesRateConMatch | null>(null)

  useEffect(() => {
    fetchData()
  }, [activeTab, billStatusFilter])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Always load dashboard
      const dashData = await api.getCarrierPayablesDashboard()
      setDashboard(dashData)

      if (activeTab === 'bills') {
        const params: Record<string, string> = {}
        if (billStatusFilter !== 'all') params.status = billStatusFilter
        const data = await api.getCarrierPayableBills(params)
        setBills(data)
      } else if (activeTab === 'aging') {
        const data = await api.getCarrierPayablesAgingReport()
        setApAging(data)
      } else if (activeTab === 'quick-pay') {
        const data = await api.getCarrierPayablesQuickPayOffers()
        setQuickPayOffers(data)
      } else if (activeTab === 'factoring') {
        const data = await api.getCarrierPayablesFactoring()
        setFactoringAssignments(data)
      } else if (activeTab === 'invoices') {
        const data = await api.getCarrierPayablesInvoices()
        setCarrierInvoices(data)
      }
    } catch (error) {
      console.error('Failed to fetch carrier payables data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveBill = async (billId: string) => {
    setActionLoading(billId)
    try {
      await api.approveCarrierPayableBill(billId)
      await fetchData()
    } catch (error) {
      console.error('Failed to approve bill:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleMatchRateCon = async (billId: string) => {
    setActionLoading(billId)
    try {
      const result = await api.matchRateConfirmation(billId)
      setRateConResult(result)
      await fetchData()
    } catch (error) {
      console.error('Failed to match rate confirmation:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateQuickPay = async (billId: string) => {
    setActionLoading(billId)
    try {
      await api.createQuickPayForBill(billId)
      setActiveTab('quick-pay')
      await fetchData()
    } catch (error: any) {
      alert(`Quick pay error: ${error.message}`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleAcceptQuickPay = async (offerId: string, tierName: string) => {
    setActionLoading(offerId)
    try {
      await api.acceptCarrierPayablesQuickPay(offerId, tierName)
      await fetchData()
    } catch (error) {
      console.error('Failed to accept quick pay:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateFactoring = async () => {
    if (!factoringCarrierId.trim() || !factoringCompanyName.trim()) return
    setFactoringLoading(true)
    try {
      await api.createCarrierPayablesFactoring({
        carrier_id: factoringCarrierId,
        factoring_company_name: factoringCompanyName,
        noa_reference: factoringNoaRef || undefined,
        payment_email: factoringPaymentEmail || undefined,
        fee_percent: factoringFeePercent ? parseFloat(factoringFeePercent) : undefined,
      })
      setShowFactoringModal(false)
      setFactoringCarrierId('')
      setFactoringCompanyName('')
      setFactoringNoaRef('')
      setFactoringPaymentEmail('')
      setFactoringFeePercent('')
      await fetchData()
    } catch (error: any) {
      alert(`Factoring error: ${error.message}`)
    } finally {
      setFactoringLoading(false)
    }
  }

  const handleRevokeFactoring = async (assignmentId: string) => {
    setActionLoading(assignmentId)
    try {
      await api.updateCarrierPayablesFactoring(assignmentId, { noa_status: 'revoked' })
      await fetchData()
    } catch (error) {
      console.error('Failed to revoke factoring:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUploadInvoice = async () => {
    if (!uploadCarrierId.trim()) return
    setUploadLoading(true)
    try {
      await api.uploadCarrierPayablesInvoice({
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
            <CreditCard className="h-7 w-7 text-indigo-600" />
            Carrier Payables
          </h1>
          <p className="text-gray-500">
            Manage carrier bills, aging, quick pay, factoring, and invoice processing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFactoringModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-purple-600 text-purple-700 rounded-lg hover:bg-purple-50"
          >
            <Building2 className="h-4 w-4" />
            Add NOA
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Upload className="h-4 w-4" />
            Upload Invoice
          </button>
        </div>
      </div>

      {/* Dashboard Cards */}
      {dashboard && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowDownRight className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Outstanding AP</p>
                <p className="text-xl font-bold text-red-600">{formatCents(dashboard.total_outstanding)}</p>
                <p className="text-xs text-gray-400">{dashboard.total_bill_count} bills</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved / Pending Pay</p>
                <p className="text-xl font-bold text-emerald-600">{formatCents(dashboard.approved_pending_payment)}</p>
                <p className="text-xs text-gray-400">{dashboard.approved_pending_count} bills</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Quick Pay Savings YTD</p>
                <p className="text-xl font-bold text-amber-600">{formatCents(dashboard.quick_pay_savings_ytd)}</p>
                <p className="text-xs text-gray-400">{dashboard.factored_carrier_count} factored carriers</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Action Needed</p>
                <p className="text-xl font-bold text-orange-600">{dashboard.unmatched_invoices + dashboard.disputed_bills}</p>
                <p className="text-xs text-gray-400">
                  {dashboard.unmatched_invoices} unmatched, {dashboard.disputed_bills} disputed
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {([
          { id: 'bills' as TabId, label: 'Bills', icon: Truck },
          { id: 'aging' as TabId, label: 'Aging Report', icon: BarChart3 },
          { id: 'quick-pay' as TabId, label: 'Quick Pay', icon: Zap },
          { id: 'factoring' as TabId, label: 'Factoring / NOA', icon: Building2 },
          { id: 'invoices' as TabId, label: 'Invoice Processing', icon: Upload },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          <p className="text-gray-500 mt-2">Loading carrier payables...</p>
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* Bills Tab */}
          {/* ============================================================ */}
          {activeTab === 'bills' && (
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
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200">
                {bills.length === 0 ? (
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
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Factored</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {bills.map((bill) => (
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
                            {bill.is_factored ? (
                              <span className="flex items-center gap-1 text-xs text-purple-600 font-medium" title={`Factor: ${bill.factor_company}`}>
                                <Shield className="h-3 w-3" />
                                {bill.factor_company}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {bill.status === 'received' && (
                                <button
                                  onClick={() => handleMatchRateCon(bill.id)}
                                  disabled={actionLoading === bill.id}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                                  title="Match rate confirmation"
                                >
                                  {actionLoading === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                                  Match
                                </button>
                              )}
                              {(bill.status === 'matched' || bill.status === 'disputed') && (
                                <>
                                  <button
                                    onClick={() => handleApproveBill(bill.id)}
                                    disabled={actionLoading === bill.id}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                                  >
                                    {actionLoading === bill.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleCreateQuickPay(bill.id)}
                                    disabled={actionLoading === bill.id}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                                    title="Offer quick pay"
                                  >
                                    <Zap className="h-3 w-3" />
                                    QP
                                  </button>
                                </>
                              )}
                              {bill.status === 'approved' && (
                                <button
                                  onClick={() => handleCreateQuickPay(bill.id)}
                                  disabled={actionLoading === bill.id}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded disabled:opacity-50"
                                  title="Offer quick pay"
                                >
                                  <Zap className="h-3 w-3" />
                                  Quick Pay
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

              {/* Rate Con Match Result */}
              {rateConResult && (
                <div className={`rounded-xl border p-4 ${
                  rateConResult.auto_approved ? 'border-green-200 bg-green-50' :
                  rateConResult.match_status === 'over_billed' ? 'border-red-200 bg-red-50' :
                  'border-yellow-200 bg-yellow-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Rate Confirmation Match Result</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Shipment {rateConResult.shipment_number} -- {rateConResult.carrier_name}
                      </p>
                    </div>
                    <button onClick={() => setRateConResult(null)} className="text-gray-400 hover:text-gray-600">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Rate Con Amount</p>
                      <p className="font-bold">{rateConResult.rate_con_amount != null ? formatCents(rateConResult.rate_con_amount) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Carrier Bill Amount</p>
                      <p className="font-bold">{rateConResult.carrier_bill_amount != null ? formatCents(rateConResult.carrier_bill_amount) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Variance</p>
                      <p className={`font-bold ${
                        (rateConResult.variance || 0) > 0 ? 'text-red-600' :
                        (rateConResult.variance || 0) < 0 ? 'text-green-600' : ''
                      }`}>
                        {rateConResult.variance != null ? formatCents(rateConResult.variance) : 'N/A'}
                        {rateConResult.variance_percent != null && ` (${rateConResult.variance_percent}%)`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className={`font-bold ${rateConResult.auto_approved ? 'text-green-600' : 'text-orange-600'}`}>
                        {rateConResult.match_status.replace(/_/g, ' ')}
                        {rateConResult.auto_approved && ' (Auto-Approved)'}
                      </p>
                    </div>
                  </div>
                  {rateConResult.flags.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {rateConResult.flags.map((flag, i) => (
                        <p key={i} className="text-xs text-gray-600">{flag}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Aging Report Tab */}
          {/* ============================================================ */}
          {activeTab === 'aging' && apAging && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Accounts Payable Aging</h2>
                <p className="text-sm text-gray-500">
                  As of {formatDate(apAging.as_of_date)} -- Total: {formatCents(apAging.total_outstanding)} ({apAging.total_count} bills)
                </p>
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

          {/* ============================================================ */}
          {/* Quick Pay Tab */}
          {/* ============================================================ */}
          {activeTab === 'quick-pay' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Quick Pay Offers
                </h2>
                <p className="text-sm text-gray-500">Offer carriers faster payment for a discount fee</p>
              </div>

              {quickPayOffers.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Zap className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No quick pay offers</p>
                  <p className="text-gray-500 mt-1">Create quick pay offers from the Bills tab using the QP button</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quickPayOffers.map((offer) => (
                    <div key={offer.id} className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{offer.carrier_name}</h3>
                          <p className="text-sm text-gray-500">
                            Bill: {offer.bill_number || offer.bill_id.slice(-8)} -- Amount: {formatCents(offer.bill_amount)}
                          </p>
                          {offer.standard_payment_date && (
                            <p className="text-xs text-gray-400 mt-1">Standard payment: {offer.standard_payment_date}</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          offer.status === 'offered' ? 'bg-amber-100 text-amber-700' :
                          offer.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          offer.status === 'declined' ? 'bg-red-100 text-red-700' :
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
                              className="border border-gray-200 rounded-lg p-3 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-center"
                            >
                              <p className="font-semibold text-gray-900">{tier.name}</p>
                              <p className="text-xs text-gray-500">{tier.days} day{tier.days !== 1 ? 's' : ''}</p>
                              <p className="text-lg font-bold text-indigo-600 mt-1">{formatCents(tier.net_payment)}</p>
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
                              <p className="text-xs text-green-600">Broker savings: {formatCents(offer.savings)}</p>
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

          {/* ============================================================ */}
          {/* Factoring / NOA Tab */}
          {/* ============================================================ */}
          {activeTab === 'factoring' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    Factoring Assignments
                  </h2>
                  <p className="text-sm text-gray-500">Track Notice of Assignment (NOA) status per carrier. Payments route to factor when active.</p>
                </div>
                <button
                  onClick={() => setShowFactoringModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Building2 className="h-4 w-4" />
                  Add NOA
                </button>
              </div>

              {factoringAssignments.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Building2 className="h-12 w-12 text-purple-300 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">No factoring assignments</p>
                  <p className="text-gray-500 mt-1">Add a Notice of Assignment to redirect carrier payments to their factoring company</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Carrier</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Factoring Company</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">NOA Ref</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">NOA Date</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Payment Email</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Fee %</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Total Factored</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500"></th>
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
                          <td className="px-4 py-3 text-sm text-gray-600">{assignment.payment_email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{assignment.fee_percent != null ? `${assignment.fee_percent}%` : '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCents(assignment.total_factored_amount)}</td>
                          <td className="px-4 py-3">
                            {assignment.noa_status === 'active' && (
                              <button
                                onClick={() => handleRevokeFactoring(assignment.id)}
                                disabled={actionLoading === assignment.id}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              >
                                {actionLoading === assignment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* Invoice Processing Tab */}
          {/* ============================================================ */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    Carrier Invoice Processing
                  </h2>
                  <p className="text-sm text-gray-500">Upload carrier invoices for AI-powered extraction, auto-matching, and validation</p>
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
                  <p className="text-gray-900 font-medium">No carrier invoices uploaded</p>
                  <p className="text-gray-500 mt-1">Upload carrier invoices for AI-powered extraction and matching to rate confirmations</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Invoice #</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Carrier</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Shipment</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Extracted</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Rate Con</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 text-right">Variance</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Confidence</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">Status</th>
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
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">
                            {inv.matched_amount != null ? formatCents(inv.matched_amount) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {inv.variance != null ? (
                              <span className={inv.variance > 0 ? 'text-red-600 font-medium' : inv.variance < 0 ? 'text-green-600' : 'text-gray-500'}>
                                {inv.variance > 0 ? '+' : ''}{formatCents(inv.variance)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {inv.match_confidence != null ? (
                              <span className={`font-medium ${inv.match_confidence >= 0.9 ? 'text-green-600' : inv.match_confidence >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                                {(inv.match_confidence * 100).toFixed(0)}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${INVOICE_STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* Factoring NOA Modal */}
      {/* ============================================================ */}
      {showFactoringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Add Factoring Assignment (NOA)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier ID *</label>
                <input
                  type="text"
                  value={factoringCarrierId}
                  onChange={(e) => setFactoringCarrierId(e.target.value)}
                  placeholder="Enter carrier ID..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Factoring Company Name *</label>
                <input
                  type="text"
                  value={factoringCompanyName}
                  onChange={(e) => setFactoringCompanyName(e.target.value)}
                  placeholder="e.g., OTR Solutions, RTS Financial"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NOA Reference</label>
                <input
                  type="text"
                  value={factoringNoaRef}
                  onChange={(e) => setFactoringNoaRef(e.target.value)}
                  placeholder="e.g., NOA-2026-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Email</label>
                <input
                  type="email"
                  value={factoringPaymentEmail}
                  onChange={(e) => setFactoringPaymentEmail(e.target.value)}
                  placeholder="remittance@factorcompany.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-400 mt-1">Payments will be redirected to this email when NOA is active</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee Percent</label>
                <input
                  type="number"
                  step="0.1"
                  value={factoringFeePercent}
                  onChange={(e) => setFactoringFeePercent(e.target.value)}
                  placeholder="e.g., 3.0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowFactoringModal(false); setFactoringCarrierId(''); setFactoringCompanyName(''); setFactoringNoaRef(''); setFactoringPaymentEmail(''); setFactoringFeePercent('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFactoring}
                  disabled={!factoringCarrierId.trim() || !factoringCompanyName.trim() || factoringLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {factoringLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                  {factoringLoading ? 'Creating...' : 'Create NOA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Upload Carrier Invoice Modal */}
      {/* ============================================================ */}
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
                <p className="text-xs text-gray-400 mt-1">AI uses these to auto-match to shipments and rate confirmations</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowUploadModal(false); setUploadCarrierId(''); setUploadInvoiceNumber(''); setUploadAmount(''); setUploadRefNumbers('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadInvoice}
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
