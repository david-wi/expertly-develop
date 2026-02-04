import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Quote, QuoteLineItem } from '../types'
import { ArrowRight, Plus, Trash2, Send, Check, Sparkles, Mail, Copy, FileText, Truck, DollarSign, Calendar, Package } from 'lucide-react'

export default function QuoteBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [draftedEmail, setDraftedEmail] = useState('')
  const [draftingEmail, setDraftingEmail] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return
      try {
        const data = await api.getQuote(id)
        setQuote(data)
        setSendEmail(data.customer_email || '')
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
      const updated = await api.updateQuote(id, {
        line_items: quote.line_items,
        estimated_cost: quote.estimated_cost,
      })
      setQuote(updated)
    } catch (error) {
      console.error('Failed to save quote:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDraftEmail = async () => {
    if (!quote) return
    setDraftingEmail(true)
    try {
      // AI-drafted email with professional template
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
      setQuote(updated)
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

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (!quote) {
    return <div className="p-8 text-center text-gray-500">Quote not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
          <p className="text-gray-500 flex items-center gap-2">
            {quote.origin_city}, {quote.origin_state}
            <ArrowRight className="h-4 w-4" />
            {quote.destination_city}, {quote.destination_state}
          </p>
        </div>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          quote.status === 'draft' ? 'bg-gray-100 text-gray-700' :
          quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
          quote.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
          'bg-red-100 text-red-700'
        }`}>
          {quote.status}
        </span>
      </div>

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
                    No line items. Add items to build the quote.
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
          </div>
        </div>
      </div>
    </div>
  )
}
