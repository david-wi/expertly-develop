import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { errorLogsApi } from '@/services/api'
import type {
  ErrorLog,
  ErrorStatus,
  ErrorSeverity,
  ErrorLogFilters,
} from '@/types/error_logs'

function formatDateEST(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' EST'
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateEST(dateString)
}

function SeverityBadge({ severity }: { severity: ErrorSeverity }) {
  const config = {
    error: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
    info: { icon: Info, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  }
  const { icon: Icon, color } = config[severity]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: ErrorStatus }) {
  const config = {
    new: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    acknowledged: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
    resolved: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  }
  const { icon: Icon, color } = config[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string
  value: number
  subtitle?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-theme-text-primary">{value}</p>
          <p className="text-sm text-theme-text-secondary">{title}</p>
          {subtitle && <p className="text-xs text-theme-text-muted">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

function ErrorDetailModal({
  error,
  onClose,
  onUpdateStatus,
}: {
  error: ErrorLog
  onClose: () => void
  onUpdateStatus: (status: ErrorStatus) => void
}) {
  const [showFullStack, setShowFullStack] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-theme-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SeverityBadge severity={error.severity} />
            <StatusBadge status={error.status} />
            <span className="text-sm text-theme-text-muted">{error.app_name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-theme-text-muted hover:text-theme-text-primary rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-theme-text-primary mb-2">Error Message</h3>
            <p className="text-theme-text-secondary bg-theme-bg-elevated p-3 rounded-lg font-mono text-sm whitespace-pre-wrap">
              {error.error_message}
            </p>
          </div>

          {error.stack_trace && (
            <div>
              <button
                onClick={() => setShowFullStack(!showFullStack)}
                className="flex items-center gap-2 text-sm font-medium text-theme-text-primary mb-2"
              >
                Stack Trace
                {showFullStack ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showFullStack && (
                <pre className="text-xs text-theme-text-secondary bg-theme-bg-elevated p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                  {error.stack_trace}
                </pre>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-1">URL</h4>
              <p className="text-sm text-theme-text-secondary break-all">
                {error.url || '-'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-1">Occurred At</h4>
              <p className="text-sm text-theme-text-secondary">
                {formatDateEST(error.occurred_at)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-1">User</h4>
              <p className="text-sm text-theme-text-secondary">
                {error.user_email || error.user_id || 'Not authenticated'}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-1">Browser</h4>
              <p className="text-sm text-theme-text-secondary truncate" title={error.browser_info || ''}>
                {error.browser_info || '-'}
              </p>
            </div>
          </div>

          {error.additional_context && Object.keys(error.additional_context).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-2">Additional Context</h4>
              <pre className="text-xs text-theme-text-secondary bg-theme-bg-elevated p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(error.additional_context, null, 2)}
              </pre>
            </div>
          )}

          {error.acknowledged_at && (
            <p className="text-xs text-theme-text-muted">
              Acknowledged: {formatDateEST(error.acknowledged_at)}
            </p>
          )}
          {error.resolved_at && (
            <p className="text-xs text-theme-text-muted">
              Resolved: {formatDateEST(error.resolved_at)}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-theme-border flex justify-between">
          <div className="flex gap-2">
            {error.status === 'new' && (
              <button
                onClick={() => onUpdateStatus('acknowledged')}
                className="px-3 py-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors"
              >
                Acknowledge
              </button>
            )}
            {error.status !== 'resolved' && (
              <button
                onClick={() => onUpdateStatus('resolved')}
                className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
              >
                Mark Resolved
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function ErrorLogs() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ErrorLogFilters>({
    limit: 50,
    skip: 0,
  })
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['error-stats'],
    queryFn: () => errorLogsApi.getStats(),
    refetchInterval: autoRefresh ? 30000 : false,
  })

  // Fetch apps list for filter
  const { data: apps } = useQuery({
    queryKey: ['error-apps'],
    queryFn: () => errorLogsApi.getApps(),
  })

  // Fetch error logs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['error-logs', filters],
    queryFn: () => errorLogsApi.list(filters),
    refetchInterval: autoRefresh ? 30000 : false,
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ErrorStatus }) =>
      errorLogsApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] })
      queryClient.invalidateQueries({ queryKey: ['error-stats'] })
      setSelectedError(null)
    },
  })

  const handleFilterChange = (key: keyof ErrorLogFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      skip: 0, // Reset pagination on filter change
    }))
  }

  const handlePageChange = (direction: 'next' | 'prev') => {
    const limit = filters.limit || 50
    const currentSkip = filters.skip || 0
    const newSkip = direction === 'next' ? currentSkip + limit : Math.max(0, currentSkip - limit)
    setFilters(prev => ({ ...prev, skip: newSkip }))
  }

  const total = data?.total || 0
  const currentPage = Math.floor((filters.skip || 0) / (filters.limit || 50)) + 1
  const totalPages = Math.ceil(total / (filters.limit || 50))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Error Logs</h1>
          <p className="text-theme-text-secondary mt-1">
            Centralized error tracking across all Expertly applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-theme-text-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-theme-border"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Errors"
            value={stats.total}
            icon={AlertCircle}
            color="bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
          />
          <StatCard
            title="New (Unacknowledged)"
            value={stats.by_status.find(s => s.status === 'new')?.count || 0}
            icon={AlertTriangle}
            color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400"
          />
          <StatCard
            title="Last 24 Hours"
            value={stats.last_24h}
            icon={Clock}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
          />
          <StatCard
            title="Last 7 Days"
            value={stats.last_7d}
            icon={Info}
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-theme-bg-surface rounded-xl border border-theme-border p-4">
        <div>
          <label className="block text-xs text-theme-text-muted mb-1">App</label>
          <select
            value={filters.app_name || ''}
            onChange={(e) => handleFilterChange('app_name', e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Apps</option>
            {apps?.map((app) => (
              <option key={app} value={app}>{app}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Status</label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Severity</label>
          <select
            value={filters.severity || ''}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Severities</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        {(filters.app_name || filters.status || filters.severity) && (
          <button
            onClick={() => setFilters({ limit: 50, skip: 0 })}
            className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary mt-4"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error list */}
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-theme-text-muted">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading errors...
          </div>
        ) : data?.errors.length === 0 ? (
          <div className="p-8 text-center text-theme-text-muted">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            No errors found
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-theme-border">
              <thead className="bg-theme-bg-elevated">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase tracking-wider">
                    Error
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase tracking-wider w-24">
                    App
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase tracking-wider w-24">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase tracking-wider w-28">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-muted uppercase tracking-wider w-32">
                    Time
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-theme-text-muted uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {data?.errors.map((error) => (
                  <tr
                    key={error.id}
                    className="hover:bg-theme-bg-elevated cursor-pointer"
                    onClick={() => setSelectedError(error)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-theme-text-primary truncate max-w-md">
                        {error.error_message}
                      </p>
                      {error.url && (
                        <p className="text-xs text-theme-text-muted truncate max-w-md">
                          {error.url}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-theme-text-secondary">{error.app_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={error.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={error.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-theme-text-muted" title={formatDateEST(error.occurred_at)}>
                        {formatRelativeTime(error.occurred_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedError(error)
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-theme-border flex items-center justify-between">
                <p className="text-sm text-theme-text-muted">
                  Showing {(filters.skip || 0) + 1} to {Math.min((filters.skip || 0) + (filters.limit || 50), total)} of {total} errors
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange('prev')}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-theme-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-bg-elevated"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-theme-text-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange('next')}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1 text-sm border border-theme-border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-bg-elevated"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedError && (
        <ErrorDetailModal
          error={selectedError}
          onClose={() => setSelectedError(null)}
          onUpdateStatus={(status) => updateMutation.mutate({ id: selectedError.id, status })}
        />
      )}
    </div>
  )
}
