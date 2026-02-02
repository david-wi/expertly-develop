import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Bug,
} from 'lucide-react'
import { InlineVoiceTranscription } from '@expertly/ui'

// Types
interface KnownIssue {
  id: string
  title: string
  description: string
  app_name: string | null // null means affects all apps
  severity: 'critical' | 'major' | 'minor' | 'cosmetic'
  status: 'open' | 'investigating' | 'workaround' | 'resolved'
  workaround?: string
  affected_version?: string
  resolved_version?: string
  created_at: string
  updated_at: string
  resolved_at?: string
}

interface KnownIssueCreate {
  title: string
  description: string
  app_name?: string
  severity: KnownIssue['severity']
  status: KnownIssue['status']
  workaround?: string
  affected_version?: string
}

// API functions
const API_BASE = import.meta.env.VITE_API_URL || ''

const knownIssuesApi = {
  async list(): Promise<KnownIssue[]> {
    const res = await fetch(`${API_BASE}/api/known-issues`)
    if (!res.ok) throw new Error('Failed to fetch known issues')
    return res.json()
  },

  async create(data: KnownIssueCreate): Promise<KnownIssue> {
    const res = await fetch(`${API_BASE}/api/known-issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create issue')
    return res.json()
  },

  async update(id: string, data: Partial<KnownIssue>): Promise<KnownIssue> {
    const res = await fetch(`${API_BASE}/api/known-issues/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to update issue')
    return res.json()
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/known-issues/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete issue')
  },
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function SeverityBadge({ severity }: { severity: KnownIssue['severity'] }) {
  const config = {
    critical: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    major: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
    minor: { icon: Info, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
    cosmetic: { icon: Info, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  }
  const { icon: Icon, color } = config[severity]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: KnownIssue['status'] }) {
  const config = {
    open: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    investigating: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
    workaround: { icon: Info, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
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
  icon: Icon,
  color,
}: {
  title: string
  value: number
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
        </div>
      </div>
    </div>
  )
}

function IssueCard({
  issue,
  onEdit,
  onUpdateStatus,
}: {
  issue: KnownIssue
  onEdit: () => void
  onUpdateStatus: (status: KnownIssue['status']) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-theme-bg-elevated transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <SeverityBadge severity={issue.severity} />
              <StatusBadge status={issue.status} />
              {issue.app_name ? (
                <span className="text-xs px-2 py-0.5 bg-theme-bg-elevated rounded text-theme-text-secondary">
                  {issue.app_name}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 rounded text-primary-700 dark:text-primary-300">
                  All Apps
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-theme-text-primary mb-1">{issue.title}</h3>
            <p className="text-sm text-theme-text-secondary line-clamp-2">{issue.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-text-muted whitespace-nowrap">
              {formatDate(issue.created_at)}
            </span>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-theme-text-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-theme-text-muted" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-theme-border pt-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-theme-text-primary mb-2">Description</h4>
            <p className="text-sm text-theme-text-secondary whitespace-pre-wrap">{issue.description}</p>
          </div>

          {issue.workaround && (
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-2">Workaround</h4>
              <p className="text-sm text-theme-text-secondary bg-theme-bg-elevated p-3 rounded-lg whitespace-pre-wrap">
                {issue.workaround}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-theme-text-muted">
            {issue.affected_version && (
              <span>Affected: v{issue.affected_version}</span>
            )}
            {issue.resolved_version && (
              <span>Fixed in: v{issue.resolved_version}</span>
            )}
            {issue.resolved_at && (
              <span>Resolved: {formatDate(issue.resolved_at)}</span>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              {issue.status === 'open' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateStatus('investigating')
                  }}
                  className="px-3 py-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors"
                >
                  Mark Investigating
                </button>
              )}
              {issue.status !== 'resolved' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateStatus('resolved')
                  }}
                  className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
                >
                  Mark Resolved
                </button>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateIssueModal({
  issue,
  onClose,
  onSave,
}: {
  issue?: KnownIssue
  onClose: () => void
  onSave: (data: KnownIssueCreate | Partial<KnownIssue>) => void
}) {
  const [form, setForm] = useState<KnownIssueCreate>({
    title: issue?.title || '',
    description: issue?.description || '',
    app_name: issue?.app_name || undefined,
    severity: issue?.severity || 'minor',
    status: issue?.status || 'open',
    workaround: issue?.workaround || '',
    affected_version: issue?.affected_version || '',
  })

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  const apps = [
    'expertly-admin',
    'expertly-define',
    'expertly-develop',
    'expertly-identity',
    'expertly-manage',
    'expertly-salon',
    'expertly-today',
    'expertly-vibecode',
    'expertly-vibetest',
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-theme-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-text-primary">
            {issue ? 'Edit Known Issue' : 'Report Known Issue'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-theme-text-muted hover:text-theme-text-primary rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              Title *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
                className="flex-1 px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Brief description of the issue"
              />
              <InlineVoiceTranscription
                wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                onTranscribe={(text) => setForm({ ...form, title: form.title ? form.title + ' ' + text : text })}
                size="md"
                className="self-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              Description *
            </label>
            <div className="flex gap-2">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
                rows={4}
                className="flex-1 px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Detailed description of the issue and how it manifests"
              />
              <InlineVoiceTranscription
                wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                onTranscribe={(text) => setForm({ ...form, description: form.description ? form.description + ' ' + text : text })}
                size="md"
                className="self-start mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-1">
                App
              </label>
              <select
                value={form.app_name || ''}
                onChange={(e) => setForm({ ...form, app_name: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Apps</option>
                {apps.map((app) => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-1">
                Severity
              </label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as KnownIssue['severity'] })}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="critical">Critical</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="cosmetic">Cosmetic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as KnownIssue['status'] })}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="workaround">Workaround Available</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-1">
                Affected Version
              </label>
              <input
                type="text"
                value={form.affected_version}
                onChange={(e) => setForm({ ...form, affected_version: e.target.value })}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., 1.2.0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              Workaround
            </label>
            <div className="flex gap-2">
              <textarea
                value={form.workaround}
                onChange={(e) => setForm({ ...form, workaround: e.target.value })}
                rows={3}
                className="flex-1 px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Steps users can take to work around this issue"
              />
              <InlineVoiceTranscription
                wsUrl="wss://identity-api.ai.devintensive.com/ws/transcribe"
                onTranscribe={(text) => setForm({ ...form, workaround: form.workaround ? form.workaround + ' ' + text : text })}
                size="md"
                className="self-start mt-1"
              />
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-theme-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {issue ? 'Save Changes' : 'Create Issue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function KnownIssues() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<{ status?: string; severity?: string; app?: string }>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingIssue, setEditingIssue] = useState<KnownIssue | null>(null)

  // Fetch issues
  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ['known-issues'],
    queryFn: () => knownIssuesApi.list(),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: KnownIssueCreate) => knownIssuesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['known-issues'] })
      setShowCreateModal(false)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnownIssue> }) =>
      knownIssuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['known-issues'] })
      setEditingIssue(null)
    },
  })

  // Filter issues
  const filteredIssues = issues.filter((issue) => {
    if (filter.status && issue.status !== filter.status) return false
    if (filter.severity && issue.severity !== filter.severity) return false
    if (filter.app && issue.app_name !== filter.app) return false
    return true
  })

  // Stats
  const openCount = issues.filter((i) => i.status === 'open').length
  const investigatingCount = issues.filter((i) => i.status === 'investigating').length
  const workaroundCount = issues.filter((i) => i.status === 'workaround').length
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length

  // Get unique apps
  const apps = [...new Set(issues.map((i) => i.app_name).filter(Boolean))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Known Issues</h1>
          <p className="text-theme-text-secondary mt-1">
            Track and communicate known issues across all Expertly applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Report Issue
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Open Issues"
          value={openCount}
          icon={AlertCircle}
          color="bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
        />
        <StatCard
          title="Investigating"
          value={investigatingCount}
          icon={Clock}
          color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400"
        />
        <StatCard
          title="Workaround Available"
          value={workaroundCount}
          icon={Info}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
        />
        <StatCard
          title="Resolved"
          value={resolvedCount}
          icon={CheckCircle}
          color="bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-theme-bg-surface rounded-xl border border-theme-border p-4">
        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Status</label>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="workaround">Workaround</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Severity</label>
          <select
            value={filter.severity || ''}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value || undefined })}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="cosmetic">Cosmetic</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">App</label>
          <select
            value={filter.app || ''}
            onChange={(e) => setFilter({ ...filter, app: e.target.value || undefined })}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Apps</option>
            {apps.map((app) => (
              <option key={app} value={app!}>{app}</option>
            ))}
          </select>
        </div>

        {(filter.status || filter.severity || filter.app) && (
          <button
            onClick={() => setFilter({})}
            className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary mt-4"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Issues list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-8 text-center text-theme-text-muted">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading known issues...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-8 text-center text-theme-text-muted">
            <Bug className="w-8 h-8 mx-auto mb-2" />
            <p className="text-lg font-medium text-theme-text-primary mb-1">No known issues</p>
            <p className="text-sm">
              {Object.keys(filter).length > 0
                ? 'No issues match the current filters.'
                : 'All systems operating normally.'}
            </p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onEdit={() => setEditingIssue(issue)}
              onUpdateStatus={(status) =>
                updateMutation.mutate({
                  id: issue.id,
                  data: {
                    status,
                    resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
                  },
                })
              }
            />
          ))
        )}
      </div>

      {/* Create/Edit modal */}
      {(showCreateModal || editingIssue) && (
        <CreateIssueModal
          issue={editingIssue || undefined}
          onClose={() => {
            setShowCreateModal(false)
            setEditingIssue(null)
          }}
          onSave={(data) => {
            if (editingIssue) {
              updateMutation.mutate({ id: editingIssue.id, data })
            } else {
              createMutation.mutate(data as KnownIssueCreate)
            }
          }}
        />
      )}
    </div>
  )
}
