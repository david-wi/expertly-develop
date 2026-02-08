import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { Shipment, Tender, TrackingEvent, ShipmentPhoto, BOLGenerationResult, FuelSurchargeResult, SplitShipmentResult } from '../types'
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
  Camera,
  Download,
  Loader2,
  Scissors,
  Wrench,
  Fuel,
  Save,
} from 'lucide-react'
import PageHelp from '../components/PageHelp'

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

  // BOL Generation state
  const [showBOLModal, setShowBOLModal] = useState(false)
  const [bolGenerating, setBolGenerating] = useState(false)
  const [bolResult, setBolResult] = useState<BOLGenerationResult | null>(null)

  // Photo capture state
  const [photos, setPhotos] = useState<ShipmentPhoto[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoCategory, setPhotoCategory] = useState('delivery')

  // Enhanced POD state
  const [showPODModal, setShowPODModal] = useState(false)
  const [podCapturing, setPodCapturing] = useState(false)
  const [podForm, setPodForm] = useState({
    received_by: '',
    delivery_notes: '',
    damage_reported: false,
    damage_description: '',
  })

  // Split shipment state
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [splitResult, setSplitResult] = useState<SplitShipmentResult | null>(null)

  // Equipment assignment state
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false)
  const [trailerNumber, setTrailerNumber] = useState('')
  const [assigningEquipment, setAssigningEquipment] = useState(false)

  // Fuel surcharge state
  const [fuelSurcharge, setFuelSurcharge] = useState<FuelSurchargeResult | null>(null)
  const [loadingFuel, setLoadingFuel] = useState(false)

  // Save as template state
  const [savingTemplate, setSavingTemplate] = useState(false)

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

  const handleSplitShipment = async () => {
    if (!id) return
    setSplitting(true)
    try {
      const result = await api.splitShipment(id, {
        split_type: 'by_weight',
        max_weight_per_child: 40000,
      })
      setSplitResult(result)
    } catch (error) {
      console.error('Failed to split shipment:', error)
    } finally {
      setSplitting(false)
    }
  }

  const handleAssignEquipment = async () => {
    if (!id || !trailerNumber) return
    setAssigningEquipment(true)
    try {
      const updated = await api.assignEquipment(id, {
        shipment_id: id,
        trailer_number: trailerNumber,
        equipment_type: shipment?.equipment_type || 'van',
      })
      setShipment(updated)
      setShowEquipmentPanel(false)
      setTrailerNumber('')
    } catch (error) {
      console.error('Failed to assign equipment:', error)
    } finally {
      setAssigningEquipment(false)
    }
  }

  const handleCalculateFuelSurcharge = async () => {
    if (!shipment) return
    setLoadingFuel(true)
    try {
      const result = await api.calculateFuelSurcharge({
        line_haul_cents: shipment.customer_price || 0,
        customer_id: shipment.customer_id,
      })
      setFuelSurcharge(result)
    } catch (error) {
      console.error('Failed to calculate fuel surcharge:', error)
    } finally {
      setLoadingFuel(false)
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!shipment) return
    setSavingTemplate(true)
    try {
      await api.createLoadTemplate({
        name: `${shipment.origin_city}, ${shipment.origin_state} to ${shipment.destination_city}, ${shipment.destination_state}`,
        customer_id: shipment.customer_id,
        stops: shipment.stops,
        equipment_type: shipment.equipment_type,
        weight_lbs: shipment.weight_lbs,
        commodity: shipment.commodity,
        customer_price: shipment.customer_price,
        carrier_cost: shipment.carrier_cost,
      })
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleGenerateBOL = async () => {
    if (!id) return
    setBolGenerating(true)
    try {
      const result = await api.generateBOL(id)
      setBolResult(result)
    } catch (error) {
      console.error('Failed to generate BOL:', error)
    } finally {
      setBolGenerating(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.length) return
    setPhotoUploading(true)
    try {
      const files = Array.from(e.target.files)
      await api.uploadShipmentPhotos(id, files, photoCategory)
      const updatedPhotos = await api.getShipmentPhotos(id)
      setPhotos(updatedPhotos)
    } catch (error) {
      console.error('Failed to upload photos:', error)
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleCaptureEnhancedPOD = async () => {
    if (!id) return
    setPodCapturing(true)
    try {
      await api.captureEnhancedPOD(id, {
        received_by: podForm.received_by,
        delivery_notes: podForm.delivery_notes,
        damage_reported: podForm.damage_reported,
        damage_description: podForm.damage_reported ? podForm.damage_description : undefined,
      })
      setShowPODModal(false)
      // Refresh shipment data
      const updated = await api.getShipment(id)
      setShipment(updated)
    } catch (error) {
      console.error('Failed to capture POD:', error)
    } finally {
      setPodCapturing(false)
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
            <PageHelp pageId="shipment-detail" />
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
          <button
            onClick={() => setShowBOLModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Generate BOL
          </button>
          {shipment.status === 'in_transit' && (
            <button
              onClick={() => setShowPODModal(true)}
              className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Capture POD
            </button>
          )}
          <button
            onClick={() => setShowSplitModal(true)}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm"
            title="Split Shipment"
          >
            <Scissors className="h-4 w-4" />
            Split
          </button>
          <button
            onClick={() => setShowEquipmentPanel(!showEquipmentPanel)}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm"
            title="Assign Equipment"
          >
            <Wrench className="h-4 w-4" />
            Equipment
          </button>
          <button
            onClick={handleSaveAsTemplate}
            disabled={savingTemplate}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Save as Template"
          >
            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Template
          </button>
        </div>
      </div>

      {/* Equipment Assignment Panel */}
      {showEquipmentPanel && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-gray-600" />
              Equipment Assignment
            </h3>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Trailer / Chassis Number</label>
              <input
                type="text"
                value={trailerNumber}
                onChange={(e) => setTrailerNumber(e.target.value)}
                placeholder="e.g., TRL-12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={handleAssignEquipment}
              disabled={!trailerNumber || assigningEquipment}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {assigningEquipment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Assign
            </button>
            <button
              onClick={handleCalculateFuelSurcharge}
              disabled={loadingFuel}
              className="px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {loadingFuel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fuel className="h-4 w-4" />}
              Fuel Surcharge
            </button>
          </div>
          {fuelSurcharge && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-gray-500">Fuel Price:</span>
                  <span className="ml-1 font-medium">${(fuelSurcharge.current_fuel_price).toFixed(2)}/gal</span>
                </div>
                <div>
                  <span className="text-gray-500">Surcharge:</span>
                  <span className="ml-1 font-medium text-amber-700">{fuelSurcharge.surcharge_percent.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-1 font-medium">${(fuelSurcharge.surcharge_amount / 100).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total w/ FSC:</span>
                  <span className="ml-1 font-bold text-gray-900">${(fuelSurcharge.total_with_surcharge / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Photo Capture Section (visible in tracking tab) */}
      {activeTab === 'tracking' && id && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Camera className="h-5 w-5 text-gray-600" />
              Shipment Photos
            </h2>
            <div className="flex items-center gap-3">
              <select
                value={photoCategory}
                onChange={(e) => setPhotoCategory(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="delivery">Delivery</option>
                <option value="damage">Damage</option>
                <option value="bol">BOL</option>
                <option value="loading">Loading</option>
                <option value="unloading">Unloading</option>
                <option value="other">Other</option>
              </select>
              <label className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer text-sm">
                {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {photoUploading ? 'Uploading...' : 'Upload Photos'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={photoUploading}
                />
              </label>
            </div>
          </div>
          {photos.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No photos uploaded yet</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="border border-gray-200 rounded-lg p-2">
                  <div className="aspect-video bg-gray-100 rounded flex items-center justify-center text-gray-400 mb-2">
                    <Camera className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-medium text-gray-900 truncate">{photo.filename}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{photo.category}</span>
                    <span className="text-xs text-gray-400">{new Date(photo.created_at).toLocaleDateString()}</span>
                  </div>
                  {photo.annotations.length > 0 && (
                    <span className="text-xs text-blue-600 mt-1 block">{photo.annotations.length} annotation(s)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BOL Generation Modal */}
      {showBOLModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Bill of Lading</h3>
            {bolResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">BOL Generated Successfully</p>
                  <p className="text-green-600 text-sm mt-1">BOL #{bolResult.bol_number}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <p><span className="text-gray-500">Shipment:</span> {bolResult.bol_data.bol_number}</p>
                  <p><span className="text-gray-500">Origin:</span> {JSON.stringify(bolResult.bol_data.origin)}</p>
                  <p><span className="text-gray-500">Destination:</span> {JSON.stringify(bolResult.bol_data.destination)}</p>
                  <p><span className="text-gray-500">Hazmat:</span> {bolResult.bol_data.hazmat ? 'Yes' : 'No'}</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowBOLModal(false); setBolResult(null) }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  Generate a Bill of Lading from the shipment data. The BOL will include shipper, consignee,
                  carrier details, commodity info, and special instructions.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                  <p><span className="text-gray-500">Shipment:</span> {shipment.shipment_number}</p>
                  <p><span className="text-gray-500">Route:</span> {shipment.origin_city}, {shipment.origin_state} to {shipment.destination_city}, {shipment.destination_state}</p>
                  <p><span className="text-gray-500">Equipment:</span> {shipment.equipment_type}</p>
                  {shipment.weight_lbs && <p><span className="text-gray-500">Weight:</span> {shipment.weight_lbs.toLocaleString()} lbs</p>}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowBOLModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateBOL}
                    disabled={bolGenerating}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bolGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    {bolGenerating ? 'Generating...' : 'Generate BOL'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Split Shipment Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Scissors className="h-5 w-5 text-gray-600" />
              Split Shipment
            </h3>
            {splitResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">Shipment Split Successfully</p>
                  <p className="text-green-600 text-sm mt-1">{splitResult.child_shipments.length} child shipments created</p>
                </div>
                <div className="space-y-2">
                  {splitResult.child_shipments.map((child) => (
                    <div key={child.id} className="p-3 border border-gray-200 rounded-lg text-sm">
                      <span className="font-medium">{child.shipment_number}</span>
                      {child.weight_lbs && <span className="text-gray-500 ml-2">{child.weight_lbs.toLocaleString()} lbs</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => { setShowSplitModal(false); setSplitResult(null) }}
                  className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Split this shipment into smaller child shipments. A parent-child relationship will be maintained.
                </p>
                <div className="bg-gray-50 p-4 rounded-lg text-sm">
                  <p><span className="text-gray-500">Current Weight:</span> {shipment.weight_lbs?.toLocaleString() || 'N/A'} lbs</p>
                  <p><span className="text-gray-500">Route:</span> {shipment.origin_city}, {shipment.origin_state} to {shipment.destination_city}, {shipment.destination_state}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowSplitModal(false)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSplitShipment} disabled={splitting}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {splitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                    {splitting ? 'Splitting...' : 'Split by Weight (40k lbs)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced POD Capture Modal */}
      {showPODModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Capture Proof of Delivery</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                <input
                  type="text"
                  value={podForm.received_by}
                  onChange={(e) => setPodForm({ ...podForm, received_by: e.target.value })}
                  placeholder="Name of person who received delivery"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
                <textarea
                  value={podForm.delivery_notes}
                  onChange={(e) => setPodForm({ ...podForm, delivery_notes: e.target.value })}
                  rows={2}
                  placeholder="Any notes about the delivery..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={podForm.damage_reported}
                    onChange={(e) => setPodForm({ ...podForm, damage_reported: e.target.checked })}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Report Damage</span>
                </label>
              </div>
              {podForm.damage_reported && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Damage Description</label>
                  <textarea
                    value={podForm.damage_description}
                    onChange={(e) => setPodForm({ ...podForm, damage_description: e.target.value })}
                    rows={2}
                    placeholder="Describe the damage..."
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPODModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCaptureEnhancedPOD}
                  disabled={podCapturing || !podForm.received_by}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {podCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {podCapturing ? 'Capturing...' : 'Capture POD'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
