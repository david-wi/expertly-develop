import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Truck,
  Calendar,
  MessageSquare,
  MapPin,
  Clock,
  ChevronRight,
  RefreshCw,
  LogOut,
  Phone,
  Package,
  CircleDot,
  Loader2,
} from 'lucide-react'

// ---- Local API helpers (no import from api.ts) ----
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
  pickup_date: string | null
  delivery_date: string | null
  stops: DriverStop[]
  last_known_location: string | null
  eta: string | null
}

type TabType = 'loads' | 'schedule' | 'messages'

// ---- Status Helpers ----
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  booked: { label: 'Booked', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  pending_pickup: { label: 'Pending Pickup', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  in_transit: { label: 'In Transit', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/40' },
  out_for_delivery: { label: 'Out for Delivery', color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/40' },
  delivered: { label: 'Delivered', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800' },
  cancelled: { label: 'Cancelled', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/40' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return ''
  return timeStr
}

function getDriverId(): string | null {
  return localStorage.getItem('driver_id') || sessionStorage.getItem('driver_id')
}

// ---- My Loads Tab ----
function MyLoadsTab({ loads, loading, onRefresh, onSelectLoad }: {
  loads: DriverLoad[]
  loading: boolean
  onRefresh: () => void
  onSelectLoad: (id: string) => void
}) {
  return (
    <div className="pb-24">
      {/* Pull to refresh hint */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Loads</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Refresh loads"
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && loads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading your loads...</p>
        </div>
      ) : loads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-center">No active loads assigned</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center mt-1">Pull down to refresh</p>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {loads.map((load) => {
            const pickup = load.stops.find(s => s.stop_type === 'pickup')
            const delivery = load.stops.find(s => s.stop_type === 'delivery')

            return (
              <button
                key={load.id}
                onClick={() => onSelectLoad(load.id)}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow active:bg-gray-50 dark:active:bg-gray-750"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{load.shipment_number}</p>
                    {load.commodity && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{load.commodity}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={load.status} />
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {/* Route */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center mt-1">
                    <CircleDot className="w-4 h-4 text-green-500 shrink-0" />
                    <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-600 my-0.5" />
                    <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {pickup ? `${pickup.city}, ${pickup.state}` : 'TBD'}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(load.pickup_date)}{pickup?.scheduled_time_start ? ` ${formatTime(pickup.scheduled_time_start)}` : ''}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {delivery ? `${delivery.city}, ${delivery.state}` : 'TBD'}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(load.delivery_date)}{delivery?.scheduled_time_start ? ` ${formatTime(delivery.scheduled_time_start)}` : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                {pickup?.contact_phone && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <a
                      href={`tel:${pickup.contact_phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call Pickup
                    </a>
                    {delivery?.contact_phone && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <a
                          href={`tel:${delivery.contact_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Call Delivery
                        </a>
                      </>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Schedule Tab ----
function ScheduleTab({ schedule, loading, onRefresh, onSelectLoad }: {
  schedule: DriverLoad[]
  loading: boolean
  onRefresh: () => void
  onSelectLoad: (id: string) => void
}) {
  // Group by date
  const grouped: Record<string, DriverLoad[]> = {}
  for (const load of schedule) {
    const dateKey = load.pickup_date
      ? new Date(load.pickup_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'Unscheduled'
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(load)
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule (Next 7 Days)</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Refresh schedule"
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && schedule.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading schedule...</p>
        </div>
      ) : schedule.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-center">No upcoming loads</p>
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {Object.entries(grouped).map(([date, loads]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {date}
              </h3>
              <div className="space-y-2">
                {loads.map((load) => {
                  const pickup = load.stops.find(s => s.stop_type === 'pickup')
                  const delivery = load.stops.find(s => s.stop_type === 'delivery')
                  const isInTransit = load.status === 'in_transit' || load.status === 'out_for_delivery'

                  return (
                    <button
                      key={load.id}
                      onClick={() => onSelectLoad(load.id)}
                      className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-sm transition-shadow active:bg-gray-50 dark:active:bg-gray-750"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isInTransit ? 'bg-green-100 dark:bg-green-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                            {isInTransit ? (
                              <Truck className="w-5 h-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{load.shipment_number}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {pickup ? `${pickup.city}, ${pickup.state}` : '?'} → {delivery ? `${delivery.city}, ${delivery.state}` : '?'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={load.status} />
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Messages Tab (placeholder) ----
function MessagesTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 pb-24">
      <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-gray-500 dark:text-gray-400 text-center font-medium">Messages Coming Soon</p>
      <p className="text-gray-400 dark:text-gray-500 text-sm text-center mt-1">
        Dispatch messaging will be available in a future update
      </p>
    </div>
  )
}

// ---- Main Driver App Component ----
export default function DriverApp() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('loads')
  const [loads, setLoads] = useState<DriverLoad[]>([])
  const [schedule, setSchedule] = useState<DriverLoad[]>([])
  const [loading, setLoading] = useState(false)
  const driverName = localStorage.getItem('driver_name') || sessionStorage.getItem('driver_name') || 'Driver'
  const touchStartY = useRef(0)
  const isRefreshing = useRef(false)

  const driverId = getDriverId()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!driverId) {
      navigate('/driver/login')
    }
  }, [driverId, navigate])

  const fetchLoads = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    try {
      const data = await driverRequest<DriverLoad[]>(`/api/v1/driver-app/my-loads?driver_id=${driverId}`)
      setLoads(data)
    } catch {
      // Silently fail - show empty state
    } finally {
      setLoading(false)
    }
  }, [driverId])

  const fetchSchedule = useCallback(async () => {
    if (!driverId) return
    setLoading(true)
    try {
      const data = await driverRequest<DriverLoad[]>(`/api/v1/driver-app/my-schedule?driver_id=${driverId}`)
      setSchedule(data)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => {
    if (activeTab === 'loads') fetchLoads()
    if (activeTab === 'schedule') fetchSchedule()
  }, [activeTab, fetchLoads, fetchSchedule])

  // Pull-to-refresh handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY
    const diff = touchEndY - touchStartY.current

    if (diff > 100 && window.scrollY === 0 && !isRefreshing.current) {
      isRefreshing.current = true
      const refreshFn = activeTab === 'loads' ? fetchLoads : fetchSchedule
      refreshFn().finally(() => {
        isRefreshing.current = false
      })
    }
  }, [activeTab, fetchLoads, fetchSchedule])

  const handleSelectLoad = useCallback((shipmentId: string) => {
    navigate(`/driver/load/${shipmentId}`)
  }, [navigate])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('driver_id')
    localStorage.removeItem('driver_name')
    localStorage.removeItem('driver_token')
    localStorage.removeItem('driver_carrier_id')
    sessionStorage.removeItem('driver_id')
    sessionStorage.removeItem('driver_name')
    sessionStorage.removeItem('driver_token')
    sessionStorage.removeItem('driver_carrier_id')
    navigate('/driver/login')
  }, [navigate])

  // Send location updates periodically
  useEffect(() => {
    if (!driverId) return
    let intervalId: ReturnType<typeof setInterval>

    const sendLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            driverRequest('/api/v1/driver-app/my-location', {
              method: 'PUT',
              body: JSON.stringify({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }),
              headers: { 'Content-Type': 'application/json' },
            }).catch(() => { /* silent fail */ })
          },
          () => { /* location denied or unavailable */ },
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }
    }

    // Send location every 5 minutes
    sendLocation()
    intervalId = setInterval(sendLocation, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [driverId])

  if (!driverId) return null

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{driverName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loads.filter(l => l.status === 'in_transit').length > 0
                ? `${loads.filter(l => l.status === 'in_transit').length} active load(s)`
                : 'No active loads'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5 text-gray-500" />
        </button>
      </header>

      {/* Content Area */}
      <main className="flex-1">
        {activeTab === 'loads' && (
          <MyLoadsTab
            loads={loads}
            loading={loading}
            onRefresh={fetchLoads}
            onSelectLoad={handleSelectLoad}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            schedule={schedule}
            loading={loading}
            onRefresh={fetchSchedule}
            onSelectLoad={handleSelectLoad}
          />
        )}
        {activeTab === 'messages' && <MessagesTab />}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-20 safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {([
            { key: 'loads' as TabType, icon: Truck, label: 'My Loads', badge: loads.filter(l => l.status !== 'delivered' && l.status !== 'cancelled').length },
            { key: 'schedule' as TabType, icon: Calendar, label: 'Schedule', badge: 0 },
            { key: 'messages' as TabType, icon: MessageSquare, label: 'Messages', badge: 0 },
          ]).map(({ key, icon: Icon, label, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex flex-col items-center py-2 px-4 min-h-[56px] min-w-[80px] transition-colors ${
                activeTab === key
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
