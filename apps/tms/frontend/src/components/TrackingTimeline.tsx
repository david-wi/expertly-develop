import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { TrackingTimeline as TrackingTimelineType, TimelineEvent, Milestone } from '../types'

interface TrackingTimelineProps {
  shipmentId: string
  onError?: (error: string) => void
}

const ICON_MAP: Record<string, string> = {
  'calendar': '📅',
  'truck': '🚚',
  'user': '👤',
  'navigation': '🧭',
  'map-pin': '📍',
  'package': '📦',
  'arrow-right': '➡️',
  'phone': '📞',
  'check-circle': '✅',
  'file-check': '📋',
  'clock': '⏰',
  'alert-triangle': '⚠️',
  'message-square': '💬',
  'circle': '⚪',
  'location': '📍',
  'plus': '➕',
}

function getIconEmoji(icon: string): string {
  return ICON_MAP[icon] || '⚪'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MilestoneTracker({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="flex items-center justify-between mb-6 px-4">
      {milestones.map((milestone, index) => (
        <div key={milestone.status} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                milestone.completed
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {milestone.completed ? '✓' : index + 1}
            </div>
            <span className={`text-xs mt-1 ${milestone.completed ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {milestone.label}
            </span>
          </div>
          {index < milestones.length - 1 && (
            <div
              className={`h-0.5 w-16 mx-2 ${
                milestones[index + 1]?.completed ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
            event.is_exception
              ? 'bg-red-100'
              : 'bg-blue-100'
          }`}
        >
          {getIconEmoji(event.icon)}
        </div>
        <div className="w-0.5 h-full bg-gray-200 mt-2" />
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className={`font-medium ${event.is_exception ? 'text-red-600' : 'text-gray-900'}`}>
              {event.title}
            </p>
            {event.description && (
              <p className="text-sm text-gray-600 mt-0.5">{event.description}</p>
            )}
            {event.location && (
              <p className="text-sm text-gray-500 mt-0.5">
                📍 {event.location}
              </p>
            )}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
            {formatDate(event.timestamp)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function TrackingTimeline({ shipmentId, onError }: TrackingTimelineProps) {
  const [timeline, setTimeline] = useState<TrackingTimelineType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTimeline() {
      try {
        setLoading(true)
        const data = await api.getTrackingTimeline(shipmentId)
        setTimeline(data)
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Failed to load timeline')
      } finally {
        setLoading(false)
      }
    }
    loadTimeline()
  }, [shipmentId, onError])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!timeline) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No tracking information available
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Shipment {timeline.shipment_number}</h3>
            <p className="text-sm text-gray-500">
              Status: <span className="font-medium capitalize">{timeline.status.replace('_', ' ')}</span>
            </p>
          </div>
          <div className="text-right">
            {timeline.current_location && (
              <p className="text-sm text-gray-600">
                📍 {timeline.current_location}
              </p>
            )}
            {timeline.eta && (
              <p className="text-sm text-gray-500">
                ETA: {formatDate(timeline.eta)}
              </p>
            )}
            {timeline.pod_captured && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                ✅ POD Captured
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Milestone Tracker */}
      <div className="p-4 border-b bg-gray-50">
        <MilestoneTracker milestones={timeline.milestones} />
      </div>

      {/* Timeline */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {timeline.timeline.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No events recorded yet</p>
        ) : (
          <div>
            {timeline.timeline.map((event, index) => (
              <TimelineItem key={`${event.event_type}-${index}`} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
