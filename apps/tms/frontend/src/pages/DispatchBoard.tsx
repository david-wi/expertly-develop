import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import type { Shipment, Carrier, CarrierSuggestion } from '../types'
import { ArrowRight, Truck, Send, Check, X, Sparkles, AlertTriangle, DollarSign, TrendingUp, Clock, Star } from 'lucide-react'

type Column = 'needs_carrier' | 'tendered' | 'dispatched'

export default function DispatchBoard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [suggestions, setSuggestions] = useState<CarrierSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [tenderRate, setTenderRate] = useState('')
  const [selectedCarrier, setSelectedCarrier] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [shipmentsData, carriersData] = await Promise.all([
          api.getShipments({ status: 'booked,pending_pickup' }),
          api.getCarriers({ status: 'active' }),
        ])
        setShipments(shipmentsData)
        setCarriers(carriersData)

        // Check if a specific shipment was requested
        const shipmentId = searchParams.get('shipment')
        if (shipmentId) {
          const shipment = shipmentsData.find((s: Shipment) => s.id === shipmentId)
          if (shipment) {
            handleSelectShipment(shipment)
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [searchParams])

  const handleSelectShipment = async (shipment: Shipment) => {
    setSelectedShipment(shipment)
    setLoadingSuggestions(true)
    setSelectedCarrier('')
    setTenderRate('')
    try {
      const suggestionData = await api.suggestCarriers(shipment.id)
      setSuggestions(suggestionData)

      // Auto-select best carrier if score > 70
      const bestMatch = suggestionData.find((s: CarrierSuggestion) => s.score > 70)
      if (bestMatch) {
        setSelectedCarrier(bestMatch.carrier_id)
        setTenderRate(((bestMatch.estimated_cost || 0) / 100).toFixed(2))
      }
    } catch (error) {
      console.error('Failed to get carrier suggestions:', error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleSendTender = async () => {
    if (!selectedShipment || !selectedCarrier || !tenderRate) return
    try {
      await api.createTender({
        shipment_id: selectedShipment.id,
        carrier_id: selectedCarrier,
        offered_rate: Math.round(parseFloat(tenderRate) * 100),
      })
      // Refresh shipments
      const shipmentsData = await api.getShipments({ status: 'booked,pending_pickup' })
      setShipments(shipmentsData)
      setSelectedShipment(null)
      setSelectedCarrier('')
      setTenderRate('')
    } catch (error) {
      console.error('Failed to send tender:', error)
    }
  }

  const getColumnShipments = (column: Column): Shipment[] => {
    switch (column) {
      case 'needs_carrier':
        return shipments.filter(s => s.status === 'booked' && !s.carrier_id)
      case 'tendered':
        return shipments.filter(s => s.status === 'booked' && s.carrier_id)
      case 'dispatched':
        return shipments.filter(s => s.status === 'pending_pickup')
      default:
        return []
    }
  }

  // Calculate margin for selected shipment
  const calculateMargin = () => {
    if (!selectedShipment || !tenderRate) return null
    const customerPrice = selectedShipment.customer_price || 0
    const carrierCost = parseFloat(tenderRate) * 100
    const margin = customerPrice - carrierCost
    const marginPercent = customerPrice > 0 ? (margin / customerPrice) * 100 : 0
    return { margin, marginPercent }
  }

  const marginData = calculateMargin()

  const columns: { id: Column; title: string; borderColor: string; bgColor: string; iconColor: string }[] = [
    { id: 'needs_carrier', title: 'Needs Carrier', borderColor: 'border-red-400', bgColor: 'bg-red-50', iconColor: 'text-red-500' },
    { id: 'tendered', title: 'Tendered', borderColor: 'border-amber-400', bgColor: 'bg-amber-50', iconColor: 'text-amber-500' },
    { id: 'dispatched', title: 'Dispatched', borderColor: 'border-emerald-400', bgColor: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  ]

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
        <p className="text-gray-500">AI-powered carrier matching and assignment</p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Kanban Columns */}
        <div className="flex-1 flex gap-4 overflow-x-auto">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`flex-1 min-w-[300px] bg-white rounded-xl border-t-4 ${column.borderColor} shadow-sm`}
            >
              <div className={`p-4 ${column.bgColor} rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{column.title}</h2>
                  <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${column.iconColor} bg-white`}>
                    {getColumnShipments(column.id).length}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
                {getColumnShipments(column.id).map((shipment) => (
                  <div
                    key={shipment.id}
                    onClick={() => handleSelectShipment(shipment)}
                    className={`p-4 bg-white rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                      selectedShipment?.id === shipment.id
                        ? 'border-emerald-500 shadow-lg shadow-emerald-100'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{shipment.shipment_number}</span>
                      {shipment.at_risk && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          At Risk
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-3">
                      <span className="font-medium">{shipment.origin_city}, {shipment.origin_state}</span>
                      <ArrowRight className="h-4 w-4 text-emerald-500" />
                      <span className="font-medium">{shipment.destination_city}, {shipment.destination_state}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded-md font-medium text-gray-600">
                        {shipment.equipment_type}
                      </span>
                      {shipment.pickup_date && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock className="h-3 w-3" />
                          {new Date(shipment.pickup_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {shipment.carrier_name && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-emerald-600">
                        <Truck className="h-4 w-4" />
                        <span className="font-medium">{shipment.carrier_name}</span>
                      </div>
                    )}
                    {shipment.customer_price > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <DollarSign className="h-3 w-3" />
                        Revenue: ${(shipment.customer_price / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
                {getColumnShipments(column.id).length === 0 && (
                  <div className="text-center py-8">
                    <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No shipments</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Carrier Selection Panel */}
        {selectedShipment && (
          <div className="w-[400px] bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Assign Carrier</h2>
                  <p className="text-sm text-emerald-600 font-medium">
                    {selectedShipment.shipment_number}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedShipment(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Margin Calculator */}
              {marginData && (
                <div className={`p-4 rounded-xl border ${
                  marginData.marginPercent >= 15 ? 'bg-emerald-50 border-emerald-200' :
                  marginData.marginPercent >= 10 ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className={`h-4 w-4 ${
                      marginData.marginPercent >= 15 ? 'text-emerald-600' :
                      marginData.marginPercent >= 10 ? 'text-amber-600' : 'text-red-600'
                    }`} />
                    <span className="text-sm font-semibold text-gray-700">Live Margin</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-bold ${
                      marginData.marginPercent >= 15 ? 'text-emerald-600' :
                      marginData.marginPercent >= 10 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {marginData.marginPercent.toFixed(1)}%
                    </span>
                    <span className="text-sm text-gray-600">
                      ${(marginData.margin / 100).toFixed(2)} profit
                    </span>
                  </div>
                </div>
              )}

              {/* AI Suggestions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900">AI Recommendations</h3>
                </div>
                {loadingSuggestions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.carrier_id}
                        onClick={() => {
                          setSelectedCarrier(suggestion.carrier_id)
                          setTenderRate(((suggestion.estimated_cost || 0) / 100).toFixed(2))
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedCarrier === suggestion.carrier_id
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {index === 0 && suggestion.score > 70 && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                <Star className="h-3 w-3" />
                                Best Match
                              </span>
                            )}
                          </div>
                          <span className="text-lg font-bold text-emerald-600">
                            ${((suggestion.estimated_cost || 0) / 100).toFixed(0)}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">{suggestion.carrier_name}</span>
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3 text-emerald-500" />
                            {suggestion.on_time_percent || suggestion.on_time_percentage || 0}% on-time
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3 text-gray-400" />
                            {suggestion.lane_count || suggestion.total_loads_on_lane || 0} loads
                          </span>
                        </div>
                        {suggestion.score > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500">Match Score</span>
                              <span className={`font-medium ${
                                suggestion.score > 80 ? 'text-emerald-600' :
                                suggestion.score > 60 ? 'text-amber-600' : 'text-gray-600'
                              }`}>{suggestion.score}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  suggestion.score > 80 ? 'bg-emerald-500' :
                                  suggestion.score > 60 ? 'bg-amber-500' : 'bg-gray-400'
                                }`}
                                style={{ width: `${suggestion.score}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-xl">
                    <Truck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No AI suggestions available</p>
                  </div>
                )}
              </div>

              {/* All Carriers Dropdown */}
              <div>
                <h3 className="font-semibold text-sm text-gray-900 mb-2">Or Select Carrier</h3>
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Choose a carrier...</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} {carrier.mc_number ? `- MC#${carrier.mc_number}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tender Rate */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Offer Rate
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    value={tenderRate}
                    onChange={(e) => setTenderRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl space-y-2">
              <button
                onClick={handleSendTender}
                disabled={!selectedCarrier || !tenderRate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                <Send className="h-4 w-4" />
                Send Tender
              </button>
              <button
                onClick={() => navigate(`/shipments/${selectedShipment.id}`)}
                className="w-full py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                View Shipment Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
