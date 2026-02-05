import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services/api'
import type { PublicTracking } from '../types'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  booked: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Booked' },
  pending_pickup: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Awaiting Pickup' },
  in_transit: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'In Transit' },
  out_for_delivery: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Out for Delivery' },
  delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

function ProgressBar({ status }: { status: string }) {
  const steps = ['booked', 'pending_pickup', 'in_transit', 'delivered']
  const currentIndex = steps.indexOf(status)
  const progress = status === 'delivered' ? 100 : ((currentIndex + 1) / steps.length) * 100

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        {steps.map((step, index) => (
          <div key={step} className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index <= currentIndex ? '✓' : index + 1}
            </div>
            <span className="text-xs mt-1 text-gray-500 text-center">
              {STATUS_COLORS[step]?.label || step}
            </span>
          </div>
        ))}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default function TrackingPortal() {
  const { token } = useParams<{ token: string }>()
  const [tracking, setTracking] = useState<PublicTracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTracking() {
      if (!token) {
        setError('Invalid tracking link')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const data = await api.getPublicTracking(token)
        setTracking(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tracking information not found')
      } finally {
        setLoading(false)
      }
    }
    loadTracking()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    )
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tracking Not Found</h1>
          <p className="text-gray-600">{error || 'This tracking link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Track Your Shipment</h1>
              <p className="text-gray-500">Shipment #{tracking.shipment_number}</p>
            </div>
            <StatusBadge status={tracking.status} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <ProgressBar status={tracking.status} />
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Origin/Destination */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Route</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  📍
                </div>
                <div>
                  <p className="text-sm text-gray-500">Origin</p>
                  <p className="font-medium">{tracking.origin || 'Not specified'}</p>
                  {tracking.pickup_date && (
                    <p className="text-sm text-gray-500">Pickup: {formatShortDate(tracking.pickup_date)}</p>
                  )}
                </div>
              </div>
              <div className="ml-4 border-l-2 border-dashed border-gray-200 h-4"></div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  🏁
                </div>
                <div>
                  <p className="text-sm text-gray-500">Destination</p>
                  <p className="font-medium">{tracking.destination || 'Not specified'}</p>
                  {tracking.delivery_date && (
                    <p className="text-sm text-gray-500">Expected: {formatShortDate(tracking.delivery_date)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Current Status</h2>
            <div className="space-y-3">
              {tracking.last_location && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">📍 Location:</span>
                  <span className="font-medium">{tracking.last_location}</span>
                </div>
              )}
              {tracking.eta && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">⏰ ETA:</span>
                  <span className="font-medium">{formatDate(tracking.eta)}</span>
                </div>
              )}
              {tracking.last_update && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">🔄 Last Update:</span>
                  <span className="font-medium">{formatDate(tracking.last_update)}</span>
                </div>
              )}
              {tracking.carrier && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">🚚 Carrier:</span>
                  <span className="font-medium">{tracking.carrier.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* POD */}
        {tracking.pod && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Proof of Delivery</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xl">
                ✅
              </div>
              <div>
                <p className="font-medium">Delivered</p>
                <p className="text-sm text-gray-500">
                  Received by: {tracking.pod.received_by || 'Unknown'} at {formatDate(tracking.pod.captured_at)}
                </p>
                <div className="flex gap-2 mt-1">
                  {tracking.pod.has_signature && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Signature</span>
                  )}
                  {tracking.pod.photo_count > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      {tracking.pod.photo_count} Photo{tracking.pod.photo_count > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tracking History */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Tracking History</h2>
          {tracking.tracking_events.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No tracking events yet</p>
          ) : (
            <div className="space-y-4">
              {tracking.tracking_events.map((event, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    {index < tracking.tracking_events.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 capitalize">
                          {event.event_type.replace(/_/g, ' ')}
                        </p>
                        {event.location && (
                          <p className="text-sm text-gray-500">{event.location}</p>
                        )}
                        {event.notes && (
                          <p className="text-sm text-gray-500">{event.notes}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        {tracking.documents && tracking.documents.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Documents</h2>
            <div className="space-y-2">
              {tracking.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <span className="font-medium">{doc.filename}</span>
                    <span className="text-xs text-gray-500 capitalize">({doc.type})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          Powered by Expertly TMS
        </div>
      </footer>
    </div>
  )
}
