import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Phone,
  Navigation,
  Camera,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Truck,
  Send,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  MessageSquare,
} from 'lucide-react'

// ---- Local API helpers ----
import { httpErrorMessage } from '../utils/httpErrors'

const DRIVER_API = import.meta.env.VITE_API_URL || ''

async function driverRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DRIVER_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || httpErrorMessage(response.status))
  }
  return response.json()
}

// ---- Types ----
interface DriverStop {
  stop_number: number
  stop_type: string
  name: string | null
  address: string
  city: string
  state: string
  zip_code: string
  contact_name: string | null
  contact_phone: string | null
  scheduled_date: string | null
  scheduled_time_start: string | null
  scheduled_time_end: string | null
  appointment_number: string | null
  actual_arrival: string | null
  actual_departure: string | null
  special_instructions: string | null
}

interface DriverLoad {
  id: string
  shipment_number: string
  bol_number: string | null
  pro_number: string | null
  status: string
  equipment_type: string
  weight_lbs: number | null
  commodity: string | null
  piece_count: number | null
  pallet_count: number | null
  special_requirements: string | null
  customer_notes: string | null
  pickup_date: string | null
  delivery_date: string | null
  actual_pickup_date: string | null
  actual_delivery_date: string | null
  stops: DriverStop[]
  last_known_location: string | null
  eta: string | null
}

type ModalType = 'checkin' | 'pod' | 'exception' | null

// ---- Status flow for the driver ----
const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  booked: { next: 'pending_pickup', label: 'En Route to Pickup', color: 'bg-blue-600 hover:bg-blue-700' },
  pending_pickup: { next: 'picked_up', label: 'Arrived at Pickup', color: 'bg-yellow-600 hover:bg-yellow-700' },
  picked_up: { next: 'in_transit', label: 'Loaded - Depart', color: 'bg-green-600 hover:bg-green-700' },
  in_transit: { next: 'out_for_delivery', label: 'Arrived at Delivery', color: 'bg-purple-600 hover:bg-purple-700' },
  out_for_delivery: { next: 'delivered', label: 'Mark Delivered', color: 'bg-emerald-600 hover:bg-emerald-700' },
}

const STATUS_LABELS: Record<string, string> = {
  booked: 'Booked',
  pending_pickup: 'En Route to Pickup',
  in_transit: 'In Transit',
  out_for_delivery: 'At Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

function getDriverId(): string | null {
  return localStorage.getItem('driver_id') || sessionStorage.getItem('driver_id')
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ---- Check Call Modal ----
function CheckinModal({ shipmentId, driverId, onClose, onSuccess }: {
  shipmentId: string
  driverId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [notes, setNotes] = useState('')
  const [etaMinutes, setEtaMinutes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError('')

    try {
      let locationLat: number | undefined
      let locationLng: number | undefined

      // Try to get current location
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          )
          locationLat = pos.coords.latitude
          locationLng = pos.coords.longitude
        } catch {
          // Location unavailable, continue without it
        }
      }

      await driverRequest(`/api/v1/driver-app/my-loads/${shipmentId}/checkin?driver_id=${driverId}`, {
        method: 'POST',
        body: JSON.stringify({
          notes: notes || undefined,
          eta_minutes: etaMinutes ? parseInt(etaMinutes) : undefined,
          location_lat: locationLat,
          location_lng: locationLng,
        }),
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit check call')
    } finally {
      setSubmitting(false)
    }
  }, [shipmentId, driverId, notes, etaMinutes, onSuccess])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Check Call</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ETA (minutes from now)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(e.target.value)}
              placeholder="e.g., 120"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any updates or notes..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>Your current location will be included automatically</span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[56px]"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {submitting ? 'Submitting...' : 'Submit Check Call'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- POD Modal ----
function PODModal({ shipmentId, driverId, onClose, onSuccess }: {
  shipmentId: string
  driverId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [signerName, setSignerName] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    // In a real app, upload to S3/cloud storage and get URLs
    // For now, create data URLs as placeholders
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotos(prev => [...prev, `photo_${Date.now()}_${file.name}`])
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError('')

    try {
      let locationLat: number | undefined
      let locationLng: number | undefined

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          )
          locationLat = pos.coords.latitude
          locationLng = pos.coords.longitude
        } catch {
          // continue without location
        }
      }

      await driverRequest(`/api/v1/driver-app/my-loads/${shipmentId}/pod?driver_id=${driverId}`, {
        method: 'POST',
        body: JSON.stringify({
          photo_urls: photos,
          notes: notes || undefined,
          signer_name: signerName || undefined,
          location_lat: locationLat,
          location_lng: locationLng,
        }),
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload POD')
    } finally {
      setSubmitting(false)
    }
  }, [shipmentId, driverId, photos, notes, signerName, onSuccess])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Proof of Delivery</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Photo Capture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Take Photos
            </label>
            <label className="flex items-center justify-center gap-3 w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
              <Camera className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400 font-medium">Tap to take photo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </label>
            {photos.length > 0 && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                {photos.length} photo(s) captured
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Signed By
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Receiver's name"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery notes, damage, etc."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[56px]"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            {submitting ? 'Uploading...' : 'Submit POD'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Exception Modal ----
function ExceptionModal({ shipmentId, driverId, onClose, onSuccess }: {
  shipmentId: string
  driverId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reasons = [
    { value: 'delay', label: 'Delay' },
    { value: 'damage', label: 'Damage' },
    { value: 'refusal', label: 'Refusal' },
    { value: 'wrong_address', label: 'Wrong Address' },
    { value: 'closed', label: 'Facility Closed' },
    { value: 'other', label: 'Other' },
  ]

  const handlePhotoCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotos(prev => [...prev, `exception_${Date.now()}_${file.name}`])
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!reason || !details) return
    setSubmitting(true)
    setError('')

    try {
      let locationLat: number | undefined
      let locationLng: number | undefined

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          )
          locationLat = pos.coords.latitude
          locationLng = pos.coords.longitude
        } catch {
          // continue without location
        }
      }

      await driverRequest(`/api/v1/driver-app/my-loads/${shipmentId}/exception?driver_id=${driverId}`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          details,
          photo_urls: photos,
          location_lat: locationLat,
          location_lng: locationLng,
        }),
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report exception')
    } finally {
      setSubmitting(false)
    }
  }, [shipmentId, driverId, reason, details, photos, onSuccess])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Report Exception</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason
            </label>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors min-h-[48px] ${
                    reason === r.value
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the issue..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {/* Photo Capture */}
          <div>
            <label className="flex items-center justify-center gap-3 w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-red-400 transition-colors">
              <Camera className="w-6 h-6 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Add photos</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </label>
            {photos.length > 0 && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                {photos.length} photo(s) attached
              </p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !reason || !details}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[56px]"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
            {submitting ? 'Reporting...' : 'Report Exception'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Main Load Detail Component ----
export default function DriverLoadDetail() {
  const { shipmentId } = useParams<{ shipmentId: string }>()
  const navigate = useNavigate()
  const [load, setLoad] = useState<DriverLoad | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showAllStops, setShowAllStops] = useState(false)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [toast, setToast] = useState('')

  const driverId = getDriverId()

  useEffect(() => {
    if (!driverId) {
      navigate('/driver/login')
    }
  }, [driverId, navigate])

  const fetchLoad = useCallback(async () => {
    if (!driverId || !shipmentId) return
    setLoading(true)
    try {
      const data = await driverRequest<DriverLoad>(`/api/v1/driver-app/my-loads/${shipmentId}?driver_id=${driverId}`)
      setLoad(data)
    } catch {
      // If load not found, go back
      navigate('/driver')
    } finally {
      setLoading(false)
    }
  }, [driverId, shipmentId, navigate])

  useEffect(() => {
    fetchLoad()
  }, [fetchLoad])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const handleStatusUpdate = useCallback(async () => {
    if (!load || !driverId || !shipmentId) return

    const flow = STATUS_FLOW[load.status]
    if (!flow) return

    setStatusUpdating(true)

    try {
      let locationLat: number | undefined
      let locationLng: number | undefined

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          )
          locationLat = pos.coords.latitude
          locationLng = pos.coords.longitude
        } catch {
          // continue without location
        }
      }

      await driverRequest(`/api/v1/driver-app/my-loads/${shipmentId}/status?driver_id=${driverId}`, {
        method: 'POST',
        body: JSON.stringify({
          status: flow.next,
          location_lat: locationLat,
          location_lng: locationLng,
        }),
      })

      showToast(`Status updated: ${flow.label}`)
      await fetchLoad()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }, [load, driverId, shipmentId, fetchLoad, showToast])

  const handleModalSuccess = useCallback(() => {
    setActiveModal(null)
    showToast('Submitted successfully')
    fetchLoad()
  }, [fetchLoad, showToast])

  const openGoogleMaps = useCallback((stop: DriverStop) => {
    const address = encodeURIComponent(`${stop.address}, ${stop.city}, ${stop.state} ${stop.zip_code}`)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank')
  }, [])

  if (!driverId) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (!load) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Load not found</p>
      </div>
    )
  }

  const currentFlow = STATUS_FLOW[load.status]
  const isDelivered = load.status === 'delivered'
  const isCancelled = load.status === 'cancelled'
  const pickup = load.stops.find(s => s.stop_type === 'pickup')
  const delivery = load.stops.find(s => s.stop_type === 'delivery')
  const intermediateStops = load.stops.filter(s => s.stop_type === 'stop')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/driver')}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 dark:text-white truncate">{load.shipment_number}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {STATUS_LABELS[load.status] || load.status}
            </p>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-4 right-4 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-xl shadow-lg text-center text-sm font-medium animate-pulse">
          {toast}
        </div>
      )}

      {/* Status Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          {(['booked', 'pending_pickup', 'in_transit', 'out_for_delivery', 'delivered'] as const).map((step, idx) => {
            const steps = ['booked', 'pending_pickup', 'in_transit', 'out_for_delivery', 'delivered']
            const currentIdx = steps.indexOf(load.status)
            const stepIdx = steps.indexOf(step)
            const isCompleted = stepIdx < currentIdx
            const isCurrent = step === load.status

            return (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  isCompleted ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-[10px] font-bold text-white">{idx + 1}</span>
                  )}
                </div>
                {idx < 4 && (
                  <div className={`flex-1 h-0.5 mx-1 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-12 text-center">Book</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-12 text-center">Pickup</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-12 text-center">Transit</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-12 text-center">Arrive</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 w-12 text-center">Done</span>
        </div>
      </div>

      {/* Load Info Card */}
      <div className="px-4 mt-4 space-y-4">
        {/* Reference Numbers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-2 gap-3">
            {load.bol_number && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">BOL #</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{load.bol_number}</p>
              </div>
            )}
            {load.pro_number && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">PRO #</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{load.pro_number}</p>
              </div>
            )}
            {load.commodity && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Commodity</p>
                <p className="text-sm text-gray-900 dark:text-white">{load.commodity}</p>
              </div>
            )}
            {load.weight_lbs && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Weight</p>
                <p className="text-sm text-gray-900 dark:text-white">{load.weight_lbs.toLocaleString()} lbs</p>
              </div>
            )}
            {load.piece_count && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pieces</p>
                <p className="text-sm text-gray-900 dark:text-white">{load.piece_count}</p>
              </div>
            )}
            {load.pallet_count && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Pallets</p>
                <p className="text-sm text-gray-900 dark:text-white">{load.pallet_count}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Equipment</p>
              <p className="text-sm text-gray-900 dark:text-white capitalize">{load.equipment_type}</p>
            </div>
          </div>

          {load.special_requirements && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Special Instructions</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                {load.special_requirements}
              </p>
            </div>
          )}

          {load.customer_notes && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Customer Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{load.customer_notes}</p>
            </div>
          )}
        </div>

        {/* Stops */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white px-4 pt-4 pb-2">Stops</h3>

          {/* Pickup */}
          {pickup && (
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <CircleDot className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Pickup</span>
                    {pickup.appointment_number && (
                      <span className="text-xs text-gray-400">Appt: {pickup.appointment_number}</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {pickup.name || `${pickup.city}, ${pickup.state}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{pickup.address}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{pickup.city}, {pickup.state} {pickup.zip_code}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDateTime(pickup.scheduled_date)}
                      {pickup.scheduled_time_start && ` ${pickup.scheduled_time_start}`}
                      {pickup.scheduled_time_end && ` - ${pickup.scheduled_time_end}`}
                    </span>
                  </div>
                  {pickup.special_instructions && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{pickup.special_instructions}</p>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => openGoogleMaps(pickup)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium min-h-[36px]"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navigate
                    </button>
                    {pickup.contact_phone && (
                      <a
                        href={`tel:${pickup.contact_phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium min-h-[36px]"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {pickup.contact_name || 'Call'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Intermediate Stops */}
          {intermediateStops.length > 0 && (
            <>
              <button
                onClick={() => setShowAllStops(!showAllStops)}
                className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <span>{intermediateStops.length} intermediate stop(s)</span>
                {showAllStops ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showAllStops && intermediateStops.map((stop) => (
                <div key={stop.stop_number} className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <MapPin className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-gray-500 uppercase">Stop {stop.stop_number}</span>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{stop.name || `${stop.city}, ${stop.state}`}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{stop.address}, {stop.city}, {stop.state} {stop.zip_code}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => openGoogleMaps(stop)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium min-h-[36px]"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          Navigate
                        </button>
                        {stop.contact_phone && (
                          <a
                            href={`tel:${stop.contact_phone}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium min-h-[36px]"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Delivery */}
          {delivery && (
            <div className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <MapPin className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Delivery</span>
                    {delivery.appointment_number && (
                      <span className="text-xs text-gray-400">Appt: {delivery.appointment_number}</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {delivery.name || `${delivery.city}, ${delivery.state}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{delivery.address}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{delivery.city}, {delivery.state} {delivery.zip_code}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDateTime(delivery.scheduled_date)}
                      {delivery.scheduled_time_start && ` ${delivery.scheduled_time_start}`}
                      {delivery.scheduled_time_end && ` - ${delivery.scheduled_time_end}`}
                    </span>
                  </div>
                  {delivery.special_instructions && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{delivery.special_instructions}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => openGoogleMaps(delivery)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium min-h-[36px]"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navigate
                    </button>
                    {delivery.contact_phone && (
                      <a
                        href={`tel:${delivery.contact_phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium min-h-[36px]"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {delivery.contact_name || 'Call'}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        {!isDelivered && !isCancelled && (
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setActiveModal('checkin')}
              className="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-sm transition-shadow min-h-[80px]"
            >
              <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Check Call</span>
            </button>
            <button
              onClick={() => setActiveModal('pod')}
              className="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-sm transition-shadow min-h-[80px]"
            >
              <Camera className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Upload POD</span>
            </button>
            <button
              onClick={() => setActiveModal('exception')}
              className="flex flex-col items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-sm transition-shadow min-h-[80px]"
            >
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Exception</span>
            </button>
          </div>
        )}
      </div>

      {/* Fixed Bottom Status Update Button */}
      {currentFlow && !isDelivered && !isCancelled && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-10">
          <button
            onClick={handleStatusUpdate}
            disabled={statusUpdating}
            className={`w-full py-4 px-4 ${currentFlow.color} text-white font-semibold text-lg rounded-xl transition-colors flex items-center justify-center gap-3 min-h-[56px] disabled:opacity-60`}
          >
            {statusUpdating ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Truck className="w-6 h-6" />
            )}
            {statusUpdating ? 'Updating...' : currentFlow.label}
          </button>
        </div>
      )}

      {/* Delivered state */}
      {isDelivered && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-10">
          <div className="flex items-center justify-center gap-3 py-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            <span className="font-semibold text-green-700 dark:text-green-300 text-lg">Delivered</span>
          </div>
        </div>
      )}

      {/* Modals */}
      {activeModal === 'checkin' && driverId && shipmentId && (
        <CheckinModal
          shipmentId={shipmentId}
          driverId={driverId}
          onClose={() => setActiveModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}
      {activeModal === 'pod' && driverId && shipmentId && (
        <PODModal
          shipmentId={shipmentId}
          driverId={driverId}
          onClose={() => setActiveModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}
      {activeModal === 'exception' && driverId && shipmentId && (
        <ExceptionModal
          shipmentId={shipmentId}
          driverId={driverId}
          onClose={() => setActiveModal(null)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}
