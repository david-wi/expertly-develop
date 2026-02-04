import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Quote, QuoteLineItem } from '../types'
import { ArrowRight, Plus, Trash2, Send, Check } from 'lucide-react'

export default function QuoteBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendEmail, setSendEmail] = useState('')

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return
      try {
        const data = await api.getQuote(id)
        setQuote(data)
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

  const handleSend = async () => {
    if (!quote || !id || !sendEmail) return
    try {
      const updated = await api.sendQuote(id, sendEmail)
      setQuote(updated)
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
        <span className={`px-3 py-1 text-sm font-medium rounded-lg ${
          quote.status === 'draft' ? 'bg-gray-100 text-gray-700' :
          quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
          quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
          'bg-red-100 text-red-700'
        }`}>
          {quote.status}
        </span>
      </div>

      {/* Quote Details */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Line Items */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <button
              onClick={handleAddLineItem}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {quote.line_items.map((item, index) => (
              <div key={index} className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleUpdateLineItem(index, 'description', e.target.value)}
                    placeholder="Description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.unit_price / 100}
                    onChange={(e) => handleUpdateLineItem(index, 'unit_price', Math.round(parseFloat(e.target.value) * 100))}
                    placeholder="Price"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => handleRemoveLineItem(index)}
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {quote.line_items.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No line items. Add items to build the quote.
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Estimated Cost</span>
              <input
                type="number"
                value={(quote.estimated_cost || 0) / 100}
                onChange={(e) => setQuote({ ...quote, estimated_cost: Math.round(parseFloat(e.target.value) * 100) })}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
              />
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total Price</span>
              <span>${(totalPrice / 100).toFixed(2)}</span>
            </div>
            <div className={`flex justify-between text-sm mt-1 ${marginPercent >= 15 ? 'text-green-600' : marginPercent >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              <span>Margin</span>
              <span>${(margin / 100).toFixed(2)} ({marginPercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Load Details</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Equipment</dt>
                <dd className="font-medium">{quote.equipment_type}</dd>
              </div>
              {quote.weight_lbs && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Weight</dt>
                  <dd className="font-medium">{quote.weight_lbs.toLocaleString()} lbs</dd>
                </div>
              )}
              {quote.commodity && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Commodity</dt>
                  <dd className="font-medium">{quote.commodity}</dd>
                </div>
              )}
              {quote.pickup_date && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Pickup Date</dt>
                  <dd className="font-medium">{new Date(quote.pickup_date).toLocaleDateString()}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Quote'}
            </button>

            {quote.status === 'draft' && (
              <>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="Customer email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!sendEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </>
            )}

            {quote.status === 'sent' && (
              <button
                onClick={handleBook}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                Book Shipment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
