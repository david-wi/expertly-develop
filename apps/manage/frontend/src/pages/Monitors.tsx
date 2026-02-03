import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import {
  api,
  Monitor,
  MonitorEvent,
  CreateMonitorRequest,
  UpdateMonitorRequest,
  Connection,
  Playbook,
  Queue,
  Project,
  MonitorProviderType,
  SlackConfig,
} from '../services/api'

const PROVIDER_LABELS: Record<MonitorProviderType, string> = {
  slack: 'Slack',
  google_drive: 'Google Drive',
  gmail: 'Gmail',
  outlook: 'Outlook',
  teamwork: 'Teamwork',
  github: 'GitHub',
}

const POLL_INTERVAL_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
]

interface MonitorFormData {
  name: string
  description: string
  provider: MonitorProviderType
  connection_id: string
  playbook_id: string
  queue_id: string
  project_id: string
  poll_interval_seconds: number
  // Slack config
  slack_channel_ids: string
  slack_workspace_wide: boolean
  slack_my_mentions: boolean
  slack_keywords: string
  slack_context_messages: number
}

const defaultFormData: MonitorFormData = {
  name: '',
  description: '',
  provider: 'slack',
  connection_id: '',
  playbook_id: '',
  queue_id: '',
  project_id: '',
  poll_interval_seconds: 300,
  slack_channel_ids: '',
  slack_workspace_wide: false,
  slack_my_mentions: false,
  slack_keywords: '',
  slack_context_messages: 5,
}

export default function Monitors() {
  const [searchParams] = useSearchParams()
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEventsModal, setShowEventsModal] = useState(false)
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null)
  const [events, setEvents] = useState<MonitorEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  const [formData, setFormData] = useState<MonitorFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [polling, setPolling] = useState<string | null>(null)

  // Notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const monitorId = searchParams.get('id')
    if (monitorId) {
      const monitor = monitors.find((m) => (m._id || m.id) === monitorId)
      if (monitor) setSelectedMonitor(monitor)
    }
  }, [searchParams, monitors])

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const loadData = async () => {
    setLoading(true)
    try {
      const [monitorsData, connectionsData, playbooksData, queuesData, projectsData] = await Promise.all([
        api.getMonitors(),
        api.getConnections(),
        api.getPlaybooks(),
        api.getQueues(),
        api.getProjects(),
      ])
      setMonitors(monitorsData)
      setConnections(connectionsData)
      setPlaybooks(playbooksData)
      setQueues(queuesData)
      setProjects(projectsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async (monitorId: string) => {
    setLoadingEvents(true)
    try {
      const eventsData = await api.getMonitorEvents(monitorId, 50)
      setEvents(eventsData)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const buildProviderConfig = (): SlackConfig => {
    if (formData.provider === 'slack') {
      return {
        channel_ids: formData.slack_channel_ids
          ? formData.slack_channel_ids.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        workspace_wide: formData.slack_workspace_wide || formData.slack_my_mentions,
        my_mentions: formData.slack_my_mentions,
        keywords: formData.slack_keywords
          ? formData.slack_keywords.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        context_messages: formData.slack_context_messages,
      }
    }
    return {}
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.connection_id || !formData.playbook_id) return

    setSaving(true)
    try {
      const request: CreateMonitorRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        provider: formData.provider,
        connection_id: formData.connection_id,
        provider_config: buildProviderConfig(),
        playbook_id: formData.playbook_id,
        queue_id: formData.queue_id || undefined,
        project_id: formData.project_id || undefined,
        poll_interval_seconds: formData.poll_interval_seconds,
      }
      await api.createMonitor(request)
      await loadData()
      setShowCreateModal(false)
      setFormData(defaultFormData)
      setNotification({ type: 'success', message: 'Monitor created successfully' })
    } catch (error) {
      console.error('Failed to create monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create monitor',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMonitor || !formData.name.trim()) return

    const monitorId = selectedMonitor._id || selectedMonitor.id
    setSaving(true)
    try {
      const request: UpdateMonitorRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        provider_config: buildProviderConfig(),
        playbook_id: formData.playbook_id || undefined,
        queue_id: formData.queue_id || undefined,
        project_id: formData.project_id || undefined,
        poll_interval_seconds: formData.poll_interval_seconds,
      }
      await api.updateMonitor(monitorId, request)
      await loadData()
      setShowEditModal(false)
      setSelectedMonitor(null)
      setNotification({ type: 'success', message: 'Monitor updated successfully' })
    } catch (error) {
      console.error('Failed to update monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update monitor',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedMonitor) return

    const monitorId = selectedMonitor._id || selectedMonitor.id
    setSaving(true)
    try {
      await api.deleteMonitor(monitorId)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedMonitor(null)
      setNotification({ type: 'success', message: 'Monitor deleted successfully' })
    } catch (error) {
      console.error('Failed to delete monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete monitor',
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePoll = async (monitor: Monitor) => {
    const monitorId = monitor._id || monitor.id
    setPolling(monitorId)
    try {
      const result = await api.pollMonitor(monitorId)
      await loadData()
      setNotification({
        type: 'success',
        message: `Poll complete: ${result.events_found} events found, ${result.playbooks_triggered} playbooks triggered`,
      })
    } catch (error) {
      console.error('Failed to poll monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to poll monitor',
      })
    } finally {
      setPolling(null)
    }
  }

  const handlePauseResume = async (monitor: Monitor) => {
    const monitorId = monitor._id || monitor.id
    try {
      if (monitor.status === 'active') {
        await api.pauseMonitor(monitorId)
        setNotification({ type: 'success', message: 'Monitor paused' })
      } else {
        await api.resumeMonitor(monitorId)
        setNotification({ type: 'success', message: 'Monitor resumed' })
      }
      await loadData()
    } catch (error) {
      console.error('Failed to pause/resume monitor:', error)
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update monitor status',
      })
    }
  }

  const openEditModal = (monitor: Monitor) => {
    setSelectedMonitor(monitor)
    const slackConfig = monitor.provider_config as SlackConfig
    setFormData({
      name: monitor.name,
      description: monitor.description || '',
      provider: monitor.provider,
      connection_id: monitor.connection_id,
      playbook_id: monitor.playbook_id,
      queue_id: monitor.queue_id || '',
      project_id: monitor.project_id || '',
      poll_interval_seconds: monitor.poll_interval_seconds,
      slack_channel_ids: slackConfig?.channel_ids?.join(', ') || '',
      slack_workspace_wide: slackConfig?.workspace_wide || false,
      slack_my_mentions: slackConfig?.my_mentions || false,
      slack_keywords: slackConfig?.keywords?.join(', ') || '',
      slack_context_messages: slackConfig?.context_messages || 5,
    })
    setShowEditModal(true)
  }

  const openEventsModal = async (monitor: Monitor) => {
    setSelectedMonitor(monitor)
    setShowEventsModal(true)
    await loadEvents(monitor._id || monitor.id)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        )
      case 'paused':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Paused
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Error
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getConnectionLabel = (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId)
    return connection?.provider_email || connection?.provider || 'Unknown'
  }

  const getPlaybookLabel = (playbookId: string) => {
    const playbook = playbooks.find((p) => p.id === playbookId)
    return playbook?.name || 'Unknown'
  }

  // Filter connections by selected provider
  const filteredConnections = connections.filter((c) => {
    if (formData.provider === 'slack') return c.provider === 'slack'
    if (formData.provider === 'google_drive' || formData.provider === 'gmail') return c.provider === 'google'
    if (formData.provider === 'outlook') return c.provider === 'microsoft'
    if (formData.provider === 'teamwork') return c.provider === 'teamwork'
    return true
  })

  return (
    <div className="space-y-4">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Monitors</h2>
          <p className="text-sm text-gray-500 mt-1">
            Watch external services and trigger playbooks when events are detected
          </p>
        </div>
        <button
          onClick={() => {
            setFormData(defaultFormData)
            setShowCreateModal(true)
          }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          New Monitor
        </button>
      </div>

      {/* Monitors List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : monitors.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No monitors</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create a monitor to watch Slack, email, or other services for events.
            </p>
            <button
              onClick={() => {
                setFormData(defaultFormData)
                setShowCreateModal(true)
              }}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Create your first monitor
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monitor
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Event
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Events
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monitors.map((monitor) => {
                const monitorId = monitor._id || monitor.id
                return (
                  <tr key={monitorId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{monitor.name}</p>
                        {monitor.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{monitor.description}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          Triggers: {getPlaybookLabel(monitor.playbook_id)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-700">{PROVIDER_LABELS[monitor.provider]}</span>
                        <p className="text-xs text-gray-500">{getConnectionLabel(monitor.connection_id)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {getStatusBadge(monitor.status)}
                        {monitor.last_error && (
                          <p className="text-xs text-red-500 mt-1 truncate max-w-xs" title={monitor.last_error}>
                            {monitor.last_error}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">{formatDate(monitor.last_event_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEventsModal(monitor)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        {monitor.events_detected}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handlePoll(monitor)}
                        disabled={polling === monitorId || monitor.status === 'paused'}
                        className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                      >
                        {polling === monitorId ? 'Polling...' : 'Poll'}
                      </button>
                      <button
                        onClick={() => handlePauseResume(monitor)}
                        className="text-yellow-600 hover:text-yellow-800 text-sm"
                      >
                        {monitor.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => openEditModal(monitor)} className="text-gray-600 hover:text-gray-800 text-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMonitor(monitor)
                          setShowDeleteConfirm(true)
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false)
          setShowEditModal(false)
          setSelectedMonitor(null)
        }}
        title={showCreateModal ? 'Create Monitor' : 'Edit Monitor'}
      >
        <form onSubmit={showCreateModal ? handleCreate : handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Slack Support Requests"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="What does this monitor watch for?"
            />
          </div>

          {showCreateModal && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider *</label>
              <select
                value={formData.provider}
                onChange={(e) =>
                  setFormData({ ...formData, provider: e.target.value as MonitorProviderType, connection_id: '' })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              >
                {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Connection *</label>
            <select
              value={formData.connection_id}
              onChange={(e) => setFormData({ ...formData, connection_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
              disabled={!showCreateModal}
            >
              <option value="">Select a connection</option>
              {filteredConnections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.provider_email || conn.provider}
                </option>
              ))}
            </select>
            {filteredConnections.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No {PROVIDER_LABELS[formData.provider]} connections found.{' '}
                <a href="/connections" className="underline">
                  Add one first
                </a>
              </p>
            )}
          </div>

          {/* Slack-specific config */}
          {formData.provider === 'slack' && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Slack Settings</h4>

              <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <input
                  type="checkbox"
                  id="my_mentions"
                  checked={formData.slack_my_mentions}
                  onChange={(e) => setFormData({
                    ...formData,
                    slack_my_mentions: e.target.checked,
                    // Auto-clear channel filters when my_mentions is enabled
                    slack_channel_ids: e.target.checked ? '' : formData.slack_channel_ids,
                  })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <div className="ml-2">
                  <label htmlFor="my_mentions" className="text-sm font-medium text-blue-800">
                    Monitor my @mentions (recommended)
                  </label>
                  <p className="text-xs text-blue-600">
                    Automatically create tasks when someone mentions you in any channel
                  </p>
                </div>
              </div>

              {!formData.slack_my_mentions && (
                <>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Channel IDs (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.slack_channel_ids}
                      onChange={(e) => setFormData({ ...formData, slack_channel_ids: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="C01234567, C07654321"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty if watching all channels</p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="workspace_wide"
                      checked={formData.slack_workspace_wide}
                      onChange={(e) => setFormData({ ...formData, slack_workspace_wide: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label htmlFor="workspace_wide" className="ml-2 text-sm text-gray-700">
                      Monitor all channels (workspace-wide)
                    </label>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-gray-700 mb-1">Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={formData.slack_keywords}
                  onChange={(e) => setFormData({ ...formData, slack_keywords: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="help, support, urgent"
                />
                <p className="text-xs text-gray-500 mt-1">Only capture messages containing these keywords</p>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Context messages</label>
                <input
                  type="number"
                  value={formData.slack_context_messages}
                  onChange={(e) => setFormData({ ...formData, slack_context_messages: parseInt(e.target.value) || 0 })}
                  className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  min={0}
                  max={20}
                />
                <p className="text-xs text-gray-500 mt-1">Number of surrounding messages to capture</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Playbook to Trigger *</label>
            <select
              value={formData.playbook_id}
              onChange={(e) => setFormData({ ...formData, playbook_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select a playbook</option>
              {playbooks.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Queue (optional)</label>
              <select
                value={formData.queue_id}
                onChange={(e) => setFormData({ ...formData, queue_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Default queue</option>
                {queues.map((q) => (
                  <option key={q._id || q.id} value={q._id || q.id}>
                    {q.purpose}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project (optional)</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Interval</label>
            <select
              value={formData.poll_interval_seconds}
              onChange={(e) => setFormData({ ...formData, poll_interval_seconds: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              {POLL_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                setShowEditModal(false)
                setSelectedMonitor(null)
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : showCreateModal ? 'Create' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Events Modal */}
      <Modal
        isOpen={showEventsModal && !!selectedMonitor}
        onClose={() => {
          setShowEventsModal(false)
          setSelectedMonitor(null)
          setEvents([])
        }}
        title={`Events - ${selectedMonitor?.name}`}
        size="lg"
      >
        {loadingEvents ? (
          <div className="p-4 text-gray-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-4 text-gray-500">No events detected yet</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(event.provider_timestamp || event.created_at)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{event.event_type}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">
                      {JSON.stringify(event.event_data).substring(0, 100)}...
                    </td>
                    <td className="px-3 py-2">
                      {event.processed ? (
                        <span className="text-xs text-green-600">Processed</span>
                      ) : (
                        <span className="text-xs text-gray-500">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ModalFooter>
          <button
            onClick={() => {
              setShowEventsModal(false)
              setSelectedMonitor(null)
              setEvents([])
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedMonitor}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Monitor?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedMonitor?.name}"? This will stop monitoring and remove all
          event history.
        </p>
        <ModalFooter>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
