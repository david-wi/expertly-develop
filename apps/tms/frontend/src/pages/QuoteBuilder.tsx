import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Quote, QuoteLineItem, QuoteRevisionSnapshot, QuoteApprovalStatus } from '../types'
import { ArrowRight, Plus, Trash2, Send, Check, Sparkles, Mail, Copy, FileText, Truck, DollarSign, Calendar, Package, History, RotateCcw, Shield, ShieldCheck, ShieldX, ShieldAlert, Zap, ChevronRight, X, Clock } from 'lucide-react'

interface QuoteWithExtras extends Quote {
  version_number?: number
  parent_quote_id?: string
  revision_history?: QuoteRevisionSnapshot[]
  is_current_version?: boolean
  customer_pricing_applied?: {
    rate_table_id?: string
    rate_table_name?: string
    playbook_id?: string
    playbook_name?: string
    discount_percent: number
    contract_rate_per_mile?: number
    contract_flat_rate?: number
    applied_at: string
    auto_applied: boolean
  }
  approval_status?: QuoteApprovalStatus
  approval_required?: boolean
  approved_by?: string
  approved_at?: string
  rejection_reason?: string
  approval_id?: string
}

export default function QuoteBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<QuoteWithExtras | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [draftedEmail, setDraftedEmail] = useState('')
  const [draftingEmail, setDraftingEmail] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  // Version history sidebar
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<QuoteRevisionSnapshot[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  // Customer pricing
  const [applyingPricing, setApplyingPricing] = useState(false)

  // Approval
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const [approvingQuote, setApprovingQuote] = useState(false)
  const [rejectingQuote, setRejectingQuote] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return
      try {
        const data = await api.getQuote(id)
        setQuote(data as QuoteWithExtras)
        setSendEmail((data as any).customer_email || '')
      } catch (error) {
        console.error('Failed to fetch quote:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [id])

  const handleAddLineItem = () => {
    if (!quote) return
    const newItem: QuoteLineItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      is_accessorial: false,
    }
    setQuote({
      ...quote,
      line_items: [...quote.line_items, newItem],
    })
  }

  const handleUpdateLineItem = (index: number, field: keyof QuoteLineItem, value: string | number | boolean) => {
    if (!quote) return
    const items = [...quote.line_items]
    items[index] = { ...items[index], [field]: value }
    setQuote({ ...quote, line_items: items })
  }

  const handleRemoveLineItem = (index: number) => {
    if (!quote) return
    setQuote({
      ...quote,
      line_items: quote.line_items.filter((_, i) => i !== index),
    })
  }

  const handleSave = async () => {
    if (!quote || !id) return
    setSaving(true)
    try {
      // Use revise endpoint to auto-save as a new version
      const updated = await api.reviseQuote(id, {
        change_summary: 'Manual save',
        line_items: quote.line_items,
        estimated_cost: quote.estimated_cost,
      })
      setQuote(updated as unknown as QuoteWithExtras)
    } catch {
      // Fallback to regular update if revise fails
      try {
        const updated = await api.updateQuote(id, {
          line_items: quote.line_items,
          estimated_cost: quote.estimated_cost,
        })
        setQuote(updated as QuoteWithExtras)
      } catch (error) {
        console.error('Failed to save quote:', error)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDraftEmail = async () => {
    if (!quote) return
    setDraftingEmail(true)
    try {
      const emailDraft = `Subject: Quote ${quote.quote_number} - ${quote.origin_city}, ${quote.origin_state} to ${quote.destination_city}, ${quote.destination_state}

Hi,

Thank you for your rate request. Please find below our quote for your shipment:

SHIPMENT DETAILS
━━━━━━━━━━━━━━━━
Origin: ${quote.origin_city}, ${quote.origin_state}
Destination: ${quote.destination_city}, ${quote.destination_state}
Equipment: ${quote.equipment_type}${quote.pickup_date ? `\nPickup Date: ${new Date(quote.pickup_date).toLocaleDateString()}` : ''}${quote.weight_lbs ? `\nWeight: ${quote.weight_lbs.toLocaleString()} lbs` : ''}${quote.commodity ? `\nCommodity: ${quote.commodity}` : ''}

PRICING
━━━━━━━
${quote.line_items.map(item => `${item.description}: $${(item.unit_price / 100).toFixed(2)}`).join('\n')}

Total: $${(totalPrice / 100).toFixed(2)}

This quote is valid for 7 days. Please reply to confirm and we'll get your shipment booked right away.

Best regards,
Your TMS Team`

      setDraftedEmail(emailDraft)
      setShowEmailPreview(true)
    } catch (error) {
      console.error('Failed to draft email:', error)
    } finally {
      setDraftingEmail(false)
    }
  }

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(draftedEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = async () => {
    if (!quote || !id || !sendEmail) return
    try {
      const updated = await api.sendQuote(id, sendEmail)
      setQuote(updated as QuoteWithExtras)
      setShowEmailPreview(false)
    } catch (error) {
      console.error('Failed to send quote:', error)
    }
  }

  const handleBook = async () => {
    if (!quote || !id) return
    try {
      const result = await api.bookQuote(id)
      navigate(`/shipments/${result.shipment_id}`)
    } catch (error) {
      console.error('Failed to book quote:', error)
    }
  }

  // Version history handlers
  const handleShowVersions = async () => {
    if (!id) return
    setShowVersionHistory(true)
    setLoadingVersions(true)
    try {
      const data = await api.getQuoteVersions(id)
      setVersions(data)
    } catch (error) {
      console.error('Failed to load versions:', error)
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleRevertVersion = async (version: number) => {
    if (!id) return
    if (!confirm(`Revert to version ${version}? Current changes will be saved in history.`)) return
    try {
      const updated = await api.revertQuoteVersion(id, version)
      setQuote(updated as unknown as QuoteWithExtras)
      // Refresh versions
      const data = await api.getQuoteVersions(id)
      setVersions(data)
    } catch (error) {
      console.error('Failed to revert:', error)
    }
  }

  // Customer pricing handler
  const handleApplyCustomerPricing = async () => {
    if (!id) return
    setApplyingPricing(true)
    try {
      const updated = await api.applyCustomerPricing(id)
      setQuote(updated as unknown as QuoteWithExtras)
    } catch (error: any) {
      alert(error.message || 'No matching customer pricing found for this lane')
    } finally {
      setApplyingPricing(false)
    }
  }

  // Approval handlers
  const handleSubmitForApproval = async () => {
    if (!id) return
    setSubmittingApproval(true)
    try {
      const updated = await api.submitQuoteForApproval(id)
      setQuote(updated as unknown as QuoteWithExtras)
    } catch (error) {
      console.error('Failed to submit for approval:', error)
    } finally {
      setSubmittingApproval(false)
    }
  }

  const handleApproveQuote = async () => {
    if (!id) return
    setApprovingQuote(true)
    try {
      const updated = await api.approveQuote(id)
      setQuote(updated as unknown as QuoteWithExtras)
    } catch (error) {
      console.error('Failed to approve quote:', error)
    } finally {
      setApprovingQuote(false)
    }
  }

  const handleRejectQuote = async () => {
    if (!id) return
    setRejectingQuote(true)
    try {
      const updated = await api.rejectQuote(id, { reason: rejectReason })
      setQuote(updated as unknown as QuoteWithExtras)
      setShowRejectModal(false)
      setRejectReason('')
    } catch (error) {
      console.error('Failed to reject quote:', error)
    } finally {
      setRejectingQuote(false)
    }
  }

  const totalPrice = quote?.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) || 0
  const margin = totalPrice - (quote?.estimated_cost || 0)
  const marginPercent = totalPrice > 0 ? (margin / totalPrice) * 100 : 0

  const getMarginColor = (pct: number) => {
    if (pct >= 20) return 'text-emerald-600'
    if (pct >= 15) return 'text-emerald-500'
    if (pct >= 10) return 'text-amber-500'
    return 'text-red-500'
  }

  const getMarginBgColor = (pct: number) => {
    if (pct >= 20) return 'bg-emerald-100 border-emerald-200'
    if (pct >= 15) return 'bg-emerald-50 border-emerald-100'
    if (pct >= 10) return 'bg-amber-50 border-amber-100'
    return 'bg-red-50 border-red-100'
  }

  const getApprovalBadge = (status?: QuoteApprovalStatus) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-amber-100 text-amber-700', icon: ShieldAlert, label: 'Pending Approval' }
      case 'approved':
        return { bg: 'bg-emerald-100 text-emerald-700', icon: ShieldCheck, label: 'Approved' }
      case 'rejected':
        return { bg: 'bg-red-100 text-red-700', icon: ShieldX, label: 'Rejected' }
      case 'auto_approved':
        return { bg: 'bg-blue-100 text-blue-700', icon: ShieldCheck, label: 'Auto-Approved' }
      default:
        return null
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (!quote) {
    return <div className="p-8 text-center text-gray-500">Quote not found</div>
  }

  const approvalBadge = getApprovalBadge(quote.approval_status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
            {quote.version_number && quote.version_number > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                v{quote.version_number}
              </span>
            )}
          </div>
          <p className="text-gray-500 flex items-center gap-2">
            {quote.origin_city}, {quote.origin_state}
            <ArrowRight className="h-4 w-4" />
            {quote.destination_city}, {quote.destination_state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {approvalBadge && (
            <span className={`px-3 py-1 text-sm font-medium rounded-full flex items-center gap-1.5 ${approvalBadge.bg}`}>
              <approvalBadge.icon className="h-3.5 w-3.5" />
              {approvalBadge.label}
            </span>
          )}
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            quote.status === 'draft' ? 'bg-gray-100 text-gray-700' :
            quote.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
            quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
            quote.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
            'bg-red-100 text-red-700'
          }`}>
            {quote.status === 'pending_approval' ? 'Pending Approval' : quote.status}
          </span>
        </div>
      </div>

      {/* Rejection Banner */}
      {quote.approval_status === 'rejected' && quote.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldX className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Quote was rejected</p>
            <p className="text-sm text-red-600 mt-1">{quote.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Customer Pricing Applied Banner */}
      {quote.customer_pricing_applied && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Zap className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-800">Customer pricing applied</p>
            <p className="text-sm text-blue-600 mt-1">
              {quote.customer_pricing_applied.rate_table_name && `Rate table: ${quote.customer_pricing_applied.rate_table_name}`}
              {quote.customer_pricing_applied.playbook_name && `Pricing playbook: ${quote.customer_pricing_applied.playbook_name}`}
              {quote.customer_pricing_applied.discount_percent > 0 && ` | Discount: ${quote.customer_pricing_applied.discount_percent}%`}
            </p>
          </div>
        </div>
      )}

      {/* Main Content - 3 Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Line Items */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                Line Items
              </h2>
              <button
                onClick={handleAddLineItem}
                className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {quote.line_items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="w-28">
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400">$</span>
                      <input
                        type="number"
                        value={item.unit_price / 100}
                        onChange={(e) => handleUpdateLineItem(index, 'unit_price', Math.round(parseFloat(e.target.value) * 100))}
                        placeholder="Price"
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveLineItem(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {quote.line_items.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    No line items. Add items or auto-apply customer pricing.
                  </p>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated Cost</span>
                <div className="relative">
                  <span className="absolute left-2 top-1 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={(quote.estimated_cost || 0) / 100}
                    onChange={(e) => setQuote({ ...quote, estimated_cost: Math.round(parseFloat(e.target.value) * 100) })}
                    className="w-28 pl-6 pr-2 py-1 border border-gray-300 rounded text-right text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Price</span>
                <span className="text-emerald-600">${(totalPrice / 100).toFixed(2)}</span>
              </div>
              <div className={`flex justify-between items-center p-3 rounded-lg border ${getMarginBgColor(marginPercent)}`}>
                <span className={`font-medium ${getMarginColor(marginPercent)}`}>Margin</span>
                <span className={`text-lg font-bold ${getMarginColor(marginPercent)}`}>
                  ${(margin / 100).toFixed(2)} ({marginPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Email Preview */}
          {showEmailPreview && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5 text-emerald-500" />
                  AI-Drafted Email
                </h2>
                <button
                  onClick={handleCopyEmail}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 bg-gray-50 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto border">
                {draftedEmail}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Details & Actions */}
        <div className="space-y-4">
          {/* Customer Pricing - AI Auto-Apply */}
          {quote.status === 'draft' && (
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Customer Pricing
              </h3>
              <p className="text-xs text-blue-600 mb-3">
                Auto-apply contracted rates and volume discounts from rate tables
              </p>
              <button
                onClick={handleApplyCustomerPricing}
                disabled={applyingPricing}
                className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                {applyingPricing ? 'Applying...' : 'Auto-Apply Customer Rates'}
              </button>
            </div>
          )}

          {/* Version History Button */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <button
              onClick={handleShowVersions}
              className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900"
            >
              <span className="flex items-center gap-2 font-medium">
                <History className="h-4 w-4 text-gray-400" />
                Version History
                {quote.version_number && quote.version_number > 1 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                    v{quote.version_number}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {/* Margin Guide */}
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100 p-4">
            <h3 className="text-sm font-semibold text-emerald-800 mb-3">Margin Guide</h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <span className="text-gray-600">20%+ Excellent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-400"></div>
                <span className="text-gray-600">15-20% Good</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-400"></div>
                <span className="text-gray-600">10-15% Fair</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-400"></div>
                <span className="text-gray-600">&lt;10% Low</span>
              </div>
            </div>
          </div>

          {/* Load Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="h-4 w-4 text-gray-400" />
              Load Details
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Equipment</dt>
                <dd className="font-medium text-gray-900">{quote.equipment_type}</dd>
              </div>
              {quote.weight_lbs && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Weight</dt>
                  <dd className="font-medium text-gray-900">{quote.weight_lbs.toLocaleString()} lbs</dd>
                </div>
              )}
              {quote.commodity && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Commodity</dt>
                  <dd className="font-medium text-gray-900">{quote.commodity}</dd>
                </div>
              )}
              {quote.pickup_date && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Pickup
                  </dt>
                  <dd className="font-medium text-gray-900">{new Date(quote.pickup_date).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save Quote'}
            </button>

            {quote.status === 'draft' && (
              <>
                {/* Submit for Approval */}
                <button
                  onClick={handleSubmitForApproval}
                  disabled={submittingApproval || totalPrice === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50 font-medium transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  {submittingApproval ? 'Submitting...' : 'Submit for Approval'}
                </button>

                <button
                  onClick={handleDraftEmail}
                  disabled={draftingEmail}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50 font-medium transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  {draftingEmail ? 'Drafting...' : 'Draft Email with AI'}
                </button>

                <div className="pt-2 border-t">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Send to Customer</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      placeholder="customer@email.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!sendEmail}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Approval Actions - shown when quote is pending approval */}
            {quote.status === 'pending_approval' && quote.approval_status === 'pending' && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-amber-600 mb-2">This quote needs approval before sending</p>
                <button
                  onClick={handleApproveQuote}
                  disabled={approvingQuote}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {approvingQuote ? 'Approving...' : 'Approve Quote'}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium transition-colors"
                >
                  <ShieldX className="h-4 w-4" />
                  Reject Quote
                </button>
              </div>
            )}

            {quote.status === 'sent' && (
              <button
                onClick={handleBook}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
              >
                <Check className="h-4 w-4" />
                Book Shipment
              </button>
            )}

            {quote.status === 'accepted' && quote.shipment_id && (
              <button
                onClick={() => navigate(`/shipments/${quote.shipment_id}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                <Package className="h-4 w-4" />
                View Shipment
              </button>
            )}

            {/* Approval Info */}
            {quote.approved_by && quote.approved_at && (
              <div className="pt-2 border-t text-xs text-gray-500">
                <p>
                  Approved by <span className="font-medium text-gray-700">{quote.approved_by}</span>
                  {' '}on {new Date(quote.approved_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version History Sidebar */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-[480px] bg-white shadow-xl h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                Version History
              </h2>
              <button onClick={() => setShowVersionHistory(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {loadingVersions ? (
              <div className="p-8 text-center text-gray-500">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p>No previous versions</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {[...versions].reverse().map((ver, idx) => {
                  const isCurrent = idx === 0
                  return (
                    <div
                      key={ver.version}
                      className={`rounded-lg border p-4 ${isCurrent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isCurrent ? 'text-emerald-700' : 'text-gray-700'}`}>
                            v{ver.version}
                          </span>
                          {isCurrent && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-700 font-medium">
                              Current
                            </span>
                          )}
                        </div>
                        {!isCurrent && (
                          <button
                            onClick={() => handleRevertVersion(ver.version)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Revert
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ver.revised_at).toLocaleString()}
                        </div>
                        {ver.revised_by && <p>By: {ver.revised_by}</p>}
                        {ver.change_summary && (
                          <p className="text-gray-600 italic">{ver.change_summary}</p>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Total</span>
                          <p className="font-medium text-gray-700">${(ver.total_price / 100).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Margin</span>
                          <p className="font-medium text-gray-700">{ver.margin_percent.toFixed(1)}%</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Items</span>
                          <p className="font-medium text-gray-700">{ver.line_items.length}</p>
                        </div>
                        {ver.equipment_type && (
                          <div>
                            <span className="text-gray-400">Equipment</span>
                            <p className="font-medium text-gray-700">{ver.equipment_type}</p>
                          </div>
                        )}
                      </div>

                      {/* Diff highlighting: show line item changes from previous version */}
                      {!isCurrent && idx < versions.length - 1 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">Line Items:</p>
                          {ver.line_items.map((item, i) => (
                            <div key={i} className="text-xs text-gray-600 flex justify-between">
                              <span className="truncate">{item.description || 'Unnamed'}</span>
                              <span className="font-mono">${(item.unit_price / 100).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-red-500" />
              Reject Quote
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRejectModal(false); setRejectReason('') }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectQuote}
                  disabled={rejectingQuote}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectingQuote ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
