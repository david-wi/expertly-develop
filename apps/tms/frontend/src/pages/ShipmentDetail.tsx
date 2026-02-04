import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Shipment, Tender, TrackingEvent } from '../types'
import ShipmentDocuments from '../components/ShipmentDocuments'
import ShipmentConversation from '../components/ShipmentConversation'
import {
  ArrowRight,
  Truck,
  Package,
  MapPin,
  Clock,
  FileText,
  AlertTriangle,
  Check,
  Send,
  Plus,
} from 'lucide-react'

const statusColors: Record<string, string> = {
  booked: 'bg-gray-100 text-gray-700',
  pending_pickup: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const eventIcons: Record<string, typeof Truck> = {
  created: FileText,
  dispatched: Send,
  picked_up: Package,
  in_transit: Truck,
  delivered: Check,
  exception: AlertTriangle,
}

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [tenders, setTenders] = useState<Tender[]>([])
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'tracking' | 'documents' | 'conversation'>('overview')
  const [showAddTracking, setShowAddTracking] = useState(false)
  const [newEvent, setNewEvent] = useState({
    event_type: 'check_call',
    location: '',
    notes: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return
      try {
        const [shipmentData, tendersData, trackingData] = await Promise.all([
          api.getShipment(id),
          api.getShipmentTenders(id),
          api.getShipmentTracking(id),
        ])
        setShipment(shipmentData)
        setTenders(tendersData)
        setTrackingEvents(trackingData)
      } catch (error) {
        console.error('Failed to fetch shipment:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleTransition = async (newStatus: string) => {
    if (!shipment || !id) return
    try {
      const updated = await api.transitionShipment(id, newStatus)
      setShipment(updated)
    } catch (error) {
      console.error('Failed to transition shipment:', error)
    }
  }

  const handleAddTrackingEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    try {
      const event = await api.addTrackingEvent(id, {
        event_type: newEvent.event_type,
        location: newEvent.location || undefined,
        notes: newEvent.notes || undefined,
      })
      setTrackingEvents([event, ...trackingEvents])
      setShowAddTracking(false)
      setNewEvent({ event_type: 'check_call', location: '', notes: '' })
    } catch (error) {
      console.error('Failed to add tracking event:', error)
    }
  }

  const handleCreateInvoice = async () => {
    if (!id) return
    try {
      const invoice = await api.createInvoice({
        shipment_id: id,
      })
      navigate(`/invoices/${invoice.id}`)
    } catch (error) {
      console.error('Failed to create invoice:', error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  if (!shipment) {
    return <div className="p-8 text-center text-gray-500">Shipment not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{shipment.shipment_number}</h1>
            <span className={`px-3 py-1 text-sm font-medium rounded-lg ${statusColors[shipment.status]}`}>
              {shipment.status.replace(/_/g, ' ')}
            </span>
            {shipment.at_risk && (
              <span className="px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-lg flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                At Risk
              </span>
            )}
          </div>
          <p className="text-gray-500 flex items-center gap-2 mt-1">
            {shipment.origin_city}, {shipment.origin_state}
            <ArrowRight className="h-4 w-4" />
            {shipment.destination_city}, {shipment.destination_state}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shipment.status === 'booked' && (
            <button
              onClick={() => navigate(`/dispatch?shipment=${id}`)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Assign Carrier
            </button>
          )}
          {shipment.status === 'pending_pickup' && (
            <button
              onClick={() => handleTransition('in_transit')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Mark Picked Up
            </button>
          )}
          {shipment.status === 'in_transit' && (
            <button
              onClick={() => handleTransition('delivered')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Mark Delivered
            </button>
          )}
          {shipment.status === 'delivered' && (
            <button
              onClick={handleCreateInvoice}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'tracking', label: 'Tracking' },
            { id: 'documents', label: 'Documents' },
            { id: 'conversation', label: 'Conversation' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Load Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Load Details</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Equipment</dt>
                  <dd className="font-medium">{shipment.equipment_type}</dd>
                </div>
                {shipment.weight_lbs && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Weight</dt>
                    <dd className="font-medium">{shipment.weight_lbs.toLocaleString()} lbs</dd>
                  </div>
                )}
                {shipment.commodity && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Commodity</dt>
                    <dd className="font-medium">{shipment.commodity}</dd>
                  </div>
                )}
                {shipment.pickup_date && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Pickup Date</dt>
                    <dd className="font-medium">{new Date(shipment.pickup_date).toLocaleDateString()}</dd>
                  </div>
                )}
                {shipment.delivery_date && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Delivery Date</dt>
                    <dd className="font-medium">{new Date(shipment.delivery_date).toLocaleDateString()}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Stops */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Stops</h2>
              <div className="space-y-4">
                {shipment.stops?.map((stop, index) => (
                  <div key={index} className="flex gap-3">
                    <div className={`p-2 rounded-full ${
                      stop.stop_type === 'pickup' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <MapPin className={`h-4 w-4 ${
                        stop.stop_type === 'pickup' ? 'text-blue-600' : 'text-green-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {stop.stop_type === 'pickup' ? 'Pickup' : 'Delivery'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {stop.city}, {stop.state}
                      </p>
                      {stop.scheduled_date && (
                        <p className="text-sm text-gray-500">
                          {new Date(stop.scheduled_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Financials */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Financials</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Customer Price</dt>
                  <dd className="font-medium">${((shipment.customer_price || 0) / 100).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Carrier Cost</dt>
                  <dd className="font-medium">${((shipment.carrier_cost || 0) / 100).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <dt className="font-medium">Margin</dt>
                  <dd className="font-medium text-green-600">
                    ${(((shipment.customer_price || 0) - (shipment.carrier_cost || 0)) / 100).toFixed(2)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Carrier */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Carrier</h2>
              {shipment.carrier_id ? (
                <div className="space-y-3 text-sm">
                  <p className="font-medium">{shipment.carrier_name}</p>
                  {/* Tender history would go here */}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No carrier assigned</p>
              )}
              {tenders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium mb-2">Tender History</p>
                  <ul className="space-y-2">
                    {tenders.map((tender) => (
                      <li key={tender.id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{tender.carrier_name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          tender.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          tender.status === 'declined' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {tender.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tracking' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Tracking History</h2>
            <button
              onClick={() => setShowAddTracking(true)}
              className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add Event
            </button>
          </div>

          {showAddTracking && (
            <form onSubmit={handleAddTrackingEvent} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="check_call">Check Call</option>
                  <option value="location_update">Location Update</option>
                  <option value="delay">Delay</option>
                  <option value="exception">Exception</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="City, State"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Add Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTracking(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {trackingEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No tracking events yet</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <ul className="space-y-6">
                {trackingEvents.map((event) => {
                  const Icon = eventIcons[event.event_type] || Clock
                  return (
                    <li key={event.id} className="relative pl-10">
                      <div className="absolute left-0 p-2 bg-white border border-gray-200 rounded-full">
                        <Icon className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 capitalize">
                          {event.event_type.replace(/_/g, ' ')}
                        </p>
                        {event.location && (
                          <p className="text-sm text-gray-500">{event.location}</p>
                        )}
                        {event.notes && (
                          <p className="text-sm text-gray-600 mt-1">{event.notes}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && id && (
        <ShipmentDocuments shipmentId={id} />
      )}

      {activeTab === 'conversation' && id && (
        <ShipmentConversation shipmentId={id} />
      )}
    </div>
  )
}
