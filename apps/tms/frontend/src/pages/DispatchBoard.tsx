import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import type { Shipment, Carrier, CarrierSuggestion } from '../types'
import { ArrowRight, Truck, Send, Check, X, Sparkles, AlertTriangle } from 'lucide-react'

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
    try {
      const suggestionData = await api.suggestCarriers(shipment.id)
      setSuggestions(suggestionData)
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

  const columns: { id: Column; title: string; color: string }[] = [
    { id: 'needs_carrier', title: 'Needs Carrier', color: 'border-red-500' },
    { id: 'tendered', title: 'Tendered', color: 'border-yellow-500' },
    { id: 'dispatched', title: 'Dispatched', color: 'border-green-500' },
  ]

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Board</h1>
        <p className="text-gray-500">Manage carrier assignments</p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Kanban Columns */}
        <div className="flex-1 flex gap-4 overflow-x-auto">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`flex-1 min-w-[280px] bg-gray-50 rounded-lg border-t-4 ${column.color}`}
            >
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{column.title}</h2>
                  <span className="px-2 py-0.5 bg-gray-200 rounded-full text-sm font-medium">
                    {getColumnShipments(column.id).length}
                  </span>
                </div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                {getColumnShipments(column.id).map((shipment) => (
                  <div
                    key={shipment.id}
                    onClick={() => handleSelectShipment(shipment)}
                    className={`p-3 bg-white rounded-lg border cursor-pointer transition-all ${
                      selectedShipment?.id === shipment.id
                        ? 'border-indigo-500 ring-2 ring-indigo-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{shipment.shipment_number}</span>
                      {shipment.at_risk && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <span>{shipment.origin_city}, {shipment.origin_state}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{shipment.destination_city}, {shipment.destination_state}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{shipment.equipment_type}</span>
                      {shipment.pickup_date && (
                        <span className="text-gray-500">
                          {new Date(shipment.pickup_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {shipment.carrier_name && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                        <Truck className="h-3 w-3 inline mr-1" />
                        {shipment.carrier_name}
                      </div>
                    )}
                  </div>
                ))}
                {getColumnShipments(column.id).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No shipments</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Carrier Selection Panel */}
        {selectedShipment && (
          <div className="w-96 bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Assign Carrier</h2>
                <button
                  onClick={() => setSelectedShipment(null)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {selectedShipment.shipment_number}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* AI Suggestions */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-medium text-sm">AI Suggestions</h3>
                </div>
                {loadingSuggestions ? (
                  <p className="text-sm text-gray-500">Loading suggestions...</p>
                ) : suggestions.length > 0 ? (
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <div
                        key={suggestion.carrier_id}
                        onClick={() => {
                          setSelectedCarrier(suggestion.carrier_id)
                          setTenderRate(((suggestion.estimated_cost || 0) / 100).toFixed(2))
                        }}
                        className={`p-3 rounded-lg border cursor-pointer ${
                          selectedCarrier === suggestion.carrier_id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{suggestion.carrier_name}</span>
                          <span className="text-sm font-medium text-green-600">
                            ${((suggestion.estimated_cost || 0) / 100).toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>{suggestion.on_time_percent}% on-time</span>
                          <span>·</span>
                          <span>{suggestion.lane_count} loads this lane</span>
                        </div>
                        {suggestion.score > 80 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-indigo-600">
                            <Check className="h-3 w-3" />
                            Best match
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No suggestions available</p>
                )}
              </div>

              {/* All Carriers */}
              <div>
                <h3 className="font-medium text-sm mb-2">All Carriers</h3>
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select a carrier...</option>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name} - MC#{carrier.mc_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tender Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Offer Rate
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={tenderRate}
                    onChange={(e) => setTenderRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleSendTender}
                disabled={!selectedCarrier || !tenderRate}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send Tender
              </button>
              <button
                onClick={() => navigate(`/shipments/${selectedShipment.id}`)}
                className="w-full mt-2 py-2 text-gray-600 hover:text-gray-900"
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
