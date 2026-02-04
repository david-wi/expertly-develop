import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { EmailMessage, TrackingEvent, Document as TmsDocument } from '../types'
import { EMAIL_CATEGORY_LABELS, DOCUMENT_TYPE_LABELS } from '../types'
import {
  Mail,
  FileText,
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  Check,
  Package,
  Send,
  Loader2,
  Sparkles,
  Download,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react'

interface ShipmentConversationProps {
  shipmentId: string
}

// Unified activity item type
type ActivityType = 'email' | 'tracking' | 'document'

interface ActivityItem {
  id: string
  type: ActivityType
  timestamp: Date
  data: EmailMessage | TrackingEvent | TmsDocument
}

const trackingEventIcons: Record<string, typeof Truck> = {
  created: FileText,
  dispatched: Send,
  picked_up: Package,
  in_transit: Truck,
  delivered: Check,
  exception: AlertTriangle,
  check_call: Clock,
  location_update: MapPin,
}

export default function ShipmentConversation({ shipmentId }: ShipmentConversationProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'emails' | 'tracking' | 'documents'>('all')

  useEffect(() => {
    fetchAllActivities()
  }, [shipmentId])

  const fetchAllActivities = async () => {
    setLoading(true)
    try {
      const [emails, tracking, documents] = await Promise.all([
        api.getEmailsByShipment(shipmentId).catch(() => []),
        api.getShipmentTracking(shipmentId).catch(() => []),
        api.getDocuments({ shipment_id: shipmentId }).catch(() => []),
      ])

      // Combine and sort by timestamp
      const allActivities: ActivityItem[] = [
        ...emails.map((e: EmailMessage) => ({
          id: `email-${e.id}`,
          type: 'email' as ActivityType,
          timestamp: new Date(e.received_at || e.created_at || Date.now()),
          data: e,
        })),
        ...tracking.map((t: TrackingEvent) => ({
          id: `tracking-${t.id}`,
          type: 'tracking' as ActivityType,
          timestamp: new Date(t.timestamp || Date.now()),
          data: t,
        })),
        ...documents.map((d: TmsDocument) => ({
          id: `document-${d.id}`,
          type: 'document' as ActivityType,
          timestamp: new Date(d.created_at || Date.now()),
          data: d,
        })),
      ]

      // Sort by timestamp descending (newest first)
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      setActivities(allActivities)
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const filteredActivities = activities.filter(a => {
    if (filter === 'all') return true
    if (filter === 'emails') return a.type === 'email'
    if (filter === 'tracking') return a.type === 'tracking'
    if (filter === 'documents') return a.type === 'document'
    return true
  })

  const formatDate = (date: Date) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (activityDate.getTime() === today.getTime()) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    } else if (activityDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ` at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
  }

  const renderEmailActivity = (activity: ActivityItem) => {
    const email = activity.data as EmailMessage
    const isExpanded = expandedItems.has(activity.id)

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div
          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleExpand(activity.id)}
        >
          <div className={`p-2 rounded-lg ${email.auto_matched ? 'bg-emerald-100' : 'bg-blue-100'}`}>
            <Mail className={`h-4 w-4 ${email.auto_matched ? 'text-emerald-600' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">
                {email.from_name || email.from_email}
              </span>
              {email.auto_matched && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Sparkles className="h-3 w-3" />
                  AI Matched
                </span>
              )}
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {EMAIL_CATEGORY_LABELS[email.category]}
              </span>
            </div>
            <p className="text-sm text-gray-700 font-medium truncate">{email.subject}</p>
            {email.ai_summary && !isExpanded && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">{email.ai_summary}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs">{formatDate(activity.timestamp)}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            {email.ai_summary && (
              <div className="bg-emerald-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 mb-1">
                  <Sparkles className="h-4 w-4" />
                  AI Summary
                </div>
                <p className="text-sm text-emerald-800">{email.ai_summary}</p>
              </div>
            )}
            <div className="text-sm text-gray-500 mb-2">
              To: {email.to_emails.join(', ')}
            </div>
            <div className="whitespace-pre-wrap text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200">
              {email.body_text || '(No text content)'}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTrackingActivity = (activity: ActivityItem) => {
    const event = activity.data as TrackingEvent
    const Icon = trackingEventIcons[event.event_type] || Clock
    const isException = event.event_type === 'exception' || event.event_type === 'delay'

    return (
      <div className={`flex items-start gap-3 p-4 bg-white border rounded-lg ${isException ? 'border-red-200' : 'border-gray-200'}`}>
        <div className={`p-2 rounded-lg ${isException ? 'bg-red-100' : 'bg-gray-100'}`}>
          <Icon className={`h-4 w-4 ${isException ? 'text-red-600' : 'text-gray-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 capitalize">
              {event.event_type.replace(/_/g, ' ')}
            </span>
            {isException && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
                Alert
              </span>
            )}
          </div>
          {event.location && (
            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {event.location}
            </p>
          )}
          {event.notes && (
            <p className="text-sm text-gray-700 mt-2">{event.notes}</p>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDate(activity.timestamp)}</span>
      </div>
    )
  }

  const renderDocumentActivity = (activity: ActivityItem) => {
    const doc = activity.data as TmsDocument
    const isExpanded = expandedItems.has(activity.id)

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div
          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleExpand(activity.id)}
        >
          <div className={`p-2 rounded-lg ${doc.auto_matched ? 'bg-emerald-100' : 'bg-purple-100'}`}>
            <FileText className={`h-4 w-4 ${doc.auto_matched ? 'text-emerald-600' : 'text-purple-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate">
                {doc.original_filename}
              </span>
              {doc.auto_matched && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Sparkles className="h-3 w-3" />
                  AI Matched
                </span>
              )}
              {doc.is_verified && (
                <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded">
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {DOCUMENT_TYPE_LABELS[doc.document_type]}
              <span className="mx-2">•</span>
              {Math.round(doc.size_bytes / 1024)} KB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={api.getDocumentDownloadUrl(doc.id)}
              onClick={(e) => e.stopPropagation()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <span className="text-xs text-gray-400">{formatDate(activity.timestamp)}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>

        {isExpanded && doc.extracted_fields && doc.extracted_fields.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              AI Extracted Fields
            </div>
            <div className="grid grid-cols-2 gap-2">
              {doc.extracted_fields.slice(0, 6).map((field, idx) => (
                <div key={idx} className="bg-white px-3 py-2 rounded text-sm border border-gray-200">
                  <span className="text-gray-500">
                    {field.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                  </span>{' '}
                  <span className="font-medium text-gray-900">{field.value || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Loading conversation...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-emerald-600" />
          Conversation History
        </h2>
        <span className="text-sm text-gray-500">
          {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: 'All', count: activities.length },
          { value: 'emails', label: 'Emails', count: activities.filter(a => a.type === 'email').length },
          { value: 'tracking', label: 'Tracking', count: activities.filter(a => a.type === 'tracking').length },
          { value: 'documents', label: 'Documents', count: activities.filter(a => a.type === 'document').length },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-white/50 rounded">
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No activities yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Emails, tracking updates, and documents will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActivities.map((activity) => (
            <div key={activity.id}>
              {activity.type === 'email' && renderEmailActivity(activity)}
              {activity.type === 'tracking' && renderTrackingActivity(activity)}
              {activity.type === 'document' && renderDocumentActivity(activity)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
