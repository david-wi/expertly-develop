import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { api } from '../services/api'
import type { WorkItem } from '../types'
import {
  Clock,
  FileText,
  Truck,
  AlertTriangle,
  Check,
  BellOff,
} from 'lucide-react'

const typeIcons: Record<string, typeof FileText> = {
  quote_request: FileText,
  quote_followup: FileText,
  shipment_needs_carrier: Truck,
  tender_pending: Truck,
  check_call_due: Clock,
  exception: AlertTriangle,
}

const typeLabels: Record<string, string> = {
  quote_request: 'Quote Request',
  quote_followup: 'Quote Follow-up',
  shipment_needs_carrier: 'Needs Carrier',
  tender_pending: 'Tender Pending',
  check_call_due: 'Check Call Due',
  document_needed: 'Document Needed',
  invoice_ready: 'Invoice Ready',
  exception: 'Exception',
}

export default function Inbox() {
  const { workItems, loading, fetchWorkItems, removeWorkItem } = useAppStore()
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchWorkItems()
  }, [fetchWorkItems])

  const filteredItems = workItems.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'overdue') return item.is_overdue
    return item.work_type === filter
  })

  const handleComplete = async (item: WorkItem) => {
    try {
      await api.completeWorkItem(item.id)
      removeWorkItem(item.id)
    } catch (error) {
      console.error('Failed to complete work item:', error)
    }
  }

  const handleSnooze = async (item: WorkItem) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)

    try {
      await api.snoozeWorkItem(item.id, tomorrow.toISOString())
      fetchWorkItems()
    } catch (error) {
      console.error('Failed to snooze work item:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-500">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} to action
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'All' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'quote_request', label: 'Quotes' },
          { value: 'shipment_needs_carrier', label: 'Dispatch' },
          { value: 'check_call_due', label: 'Check Calls' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Work Items List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading.workItems ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">No pending work items</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredItems.map((item) => {
              const Icon = typeIcons[item.work_type] || FileText
              return (
                <li key={item.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      item.is_overdue ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <Icon className={`h-5 w-5 ${
                        item.is_overdue ? 'text-red-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {item.title}
                        </h3>
                        {item.is_overdue && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {typeLabels[item.work_type] || item.work_type}
                        {item.due_at && (
                          <> · Due {new Date(item.due_at).toLocaleDateString()}</>
                        )}
                      </p>
                      {item.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSnooze(item)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Snooze until tomorrow"
                      >
                        <BellOff className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleComplete(item)}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                        title="Mark complete"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
