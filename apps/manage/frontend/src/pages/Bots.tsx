import { useState, useEffect, useCallback } from 'react'
import { Bot, Activity, Pause, Play, Settings, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { api, BotWithStatus, BotActivity, BotStats, Queue } from '../services/api'
import { Modal, ModalFooter } from '@expertly/ui'
import { formatDistanceToNow } from 'date-fns'

type StatusFilter = 'all' | 'online' | 'offline' | 'paused' | 'busy'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  online: { label: 'Online', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  offline: { label: 'Offline', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  busy: { label: 'Busy', color: 'bg-blue-100 text-blue-800', icon: Activity },
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  task_claimed: 'Claimed task',
  task_completed: 'Completed task',
  task_failed: 'Task failed',
  heartbeat: 'Heartbeat',
  status_change: 'Status changed',
}

export default function Bots() {
  const [bots, setBots] = useState<BotWithStatus[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [queueFilter, setQueueFilter] = useState<string>('')

  // Activity modal
  const [selectedBot, setSelectedBot] = useState<BotWithStatus | null>(null)
  const [botActivity, setBotActivity] = useState<BotActivity[]>([])
  const [botStats, setBotStats] = useState<BotStats | null>(null)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [activityLoading, setActivityLoading] = useState(false)

  // Config modal
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configForm, setConfigForm] = useState({
    max_concurrent_tasks: 1,
    allowed_queue_ids: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const loadBots = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [botsData, queuesData] = await Promise.all([
        api.getBots(),
        api.getQueues(),
      ])
      setBots(botsData)
      setQueues(queuesData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bots'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBots()
  }, [loadBots])

  const filteredBots = bots.filter(bot => {
    if (statusFilter !== 'all' && bot.status !== statusFilter) return false
    if (queueFilter && !bot.allowed_queue_ids?.includes(queueFilter)) return false
    return true
  })

  const statusCounts = {
    online: bots.filter(b => b.status === 'online').length,
    offline: bots.filter(b => b.status === 'offline').length,
    paused: bots.filter(b => b.status === 'paused').length,
    busy: bots.filter(b => b.status === 'busy').length,
  }

  const totalTasksWeek = bots.reduce((sum, b) => sum + (b.tasks_completed_7d || 0), 0)

  const openActivityModal = async (bot: BotWithStatus) => {
    setSelectedBot(bot)
    setShowActivityModal(true)
    setActivityLoading(true)
    try {
      const [activity, stats] = await Promise.all([
        api.getBotActivity(bot.id),
        api.getBotStats(bot.id),
      ])
      setBotActivity(activity)
      setBotStats(stats)
    } catch (err) {
      console.error('Failed to load bot activity:', err)
    } finally {
      setActivityLoading(false)
    }
  }

  const openConfigModal = (bot: BotWithStatus) => {
    setSelectedBot(bot)
    setConfigForm({
      max_concurrent_tasks: bot.max_concurrent_tasks || 1,
      allowed_queue_ids: bot.allowed_queue_ids || [],
    })
    setShowConfigModal(true)
  }

  const handlePause = async (bot: BotWithStatus) => {
    try {
      await api.pauseBot(bot.id)
      await loadBots()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause bot'
      setError(message)
    }
  }

  const handleResume = async (bot: BotWithStatus) => {
    try {
      await api.resumeBot(bot.id)
      await loadBots()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume bot'
      setError(message)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBot) return

    setSaving(true)
    try {
      await api.updateBotConfig(selectedBot.id, configForm)
      await loadBots()
      setShowConfigModal(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update bot config'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const toggleQueueInConfig = (queueId: string) => {
    setConfigForm(prev => ({
      ...prev,
      allowed_queue_ids: prev.allowed_queue_ids.includes(queueId)
        ? prev.allowed_queue_ids.filter(id => id !== queueId)
        : [...prev.allowed_queue_ids, queueId],
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bot className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bots</h2>
            <p className="text-sm text-gray-500">Monitor and manage your automation bots</p>
          </div>
        </div>
        <button
          onClick={loadBots}
          className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Bots</p>
          <p className="text-2xl font-bold text-gray-900">{bots.length}</p>
        </div>
        <div
          onClick={() => setStatusFilter(statusFilter === 'online' ? 'all' : 'online')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            statusFilter === 'online' ? 'ring-2 ring-green-400' : 'hover:shadow-md'
          }`}
        >
          <p className="text-sm text-gray-500">Online</p>
          <p className="text-2xl font-bold text-green-600">{statusCounts.online}</p>
        </div>
        <div
          onClick={() => setStatusFilter(statusFilter === 'busy' ? 'all' : 'busy')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            statusFilter === 'busy' ? 'ring-2 ring-blue-400' : 'hover:shadow-md'
          }`}
        >
          <p className="text-sm text-gray-500">Busy</p>
          <p className="text-2xl font-bold text-blue-600">{statusCounts.busy}</p>
        </div>
        <div
          onClick={() => setStatusFilter(statusFilter === 'paused' ? 'all' : 'paused')}
          className={`bg-white shadow rounded-lg p-4 cursor-pointer transition-all ${
            statusFilter === 'paused' ? 'ring-2 ring-yellow-400' : 'hover:shadow-md'
          }`}
        >
          <p className="text-sm text-gray-500">Paused</p>
          <p className="text-2xl font-bold text-yellow-600">{statusCounts.paused}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-sm text-gray-500">Tasks (7d)</p>
          <p className="text-2xl font-bold text-purple-600">{totalTasksWeek}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="online">Online</option>
          <option value="busy">Busy</option>
          <option value="paused">Paused</option>
          <option value="offline">Offline</option>
        </select>
        <select
          value={queueFilter}
          onChange={(e) => setQueueFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Queues</option>
          {queues.map(queue => (
            <option key={queue._id || queue.id} value={queue._id || queue.id}>
              {queue.purpose}
            </option>
          ))}
        </select>
      </div>

      {/* Bots Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading bots...</div>
        ) : filteredBots.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No bots found</p>
            <p className="text-sm mt-1">Try adjusting your filters or create a bot user</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Task</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks (7d)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBots.map(bot => {
                const statusConfig = STATUS_CONFIG[bot.status] || STATUS_CONFIG.offline
                const StatusIcon = statusConfig.icon
                return (
                  <tr key={bot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-3">
                        <Bot className="h-8 w-8 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{bot.name}</p>
                          {bot.email && <p className="text-sm text-gray-500">{bot.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {bot.current_task_count > 0 ? (
                        <span className="text-sm text-gray-600">Working on {bot.current_task_count} task{bot.current_task_count > 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-sm text-gray-400">Idle</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-900">{bot.tasks_completed_7d || 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      {bot.last_seen_at ? (
                        <span className="text-sm text-gray-500">
                          {formatDistanceToNow(new Date(bot.last_seen_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openActivityModal(bot)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Activity"
                        >
                          <Activity className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openConfigModal(bot)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="Configure"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        {bot.status === 'paused' ? (
                          <button
                            onClick={() => handleResume(bot)}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Resume"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePause(bot)}
                            className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                            title="Pause"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title={`${selectedBot?.name || 'Bot'} Activity`}
        size="lg"
      >
        {activityLoading ? (
          <div className="p-8 text-center text-gray-500">Loading activity...</div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            {botStats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500">Tasks Completed</p>
                  <p className="text-xl font-bold text-green-600">{botStats.tasks_completed}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500">Tasks Failed</p>
                  <p className="text-xl font-bold text-red-600">{botStats.tasks_failed}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-sm text-gray-500">Avg Duration</p>
                  <p className="text-xl font-bold text-blue-600">
                    {botStats.avg_duration_seconds
                      ? `${Math.round(botStats.avg_duration_seconds / 60)}m`
                      : '-'}
                  </p>
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Recent Activity</h4>
              {botActivity.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No activity recorded</p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {botActivity.map(activity => (
                    <div key={activity.id} className="flex items-start space-x-3 text-sm">
                      <Clock className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-gray-900">
                          {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
                        </p>
                        {activity.task_id && (
                          <p className="text-gray-500">Task ID: {activity.task_id}</p>
                        )}
                        {activity.duration_seconds && (
                          <p className="text-gray-500">Duration: {Math.round(activity.duration_seconds / 60)}m</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <ModalFooter>
          <button
            onClick={() => setShowActivityModal(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Config Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title={`Configure ${selectedBot?.name || 'Bot'}`}
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Concurrent Tasks
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={configForm.max_concurrent_tasks}
              onChange={(e) => setConfigForm(prev => ({ ...prev, max_concurrent_tasks: parseInt(e.target.value) || 1 }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed Queues
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
              {queues.length === 0 ? (
                <p className="text-sm text-gray-500">No queues available</p>
              ) : (
                queues.map(queue => {
                  const queueId = queue._id || queue.id
                  return (
                    <label key={queueId} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configForm.allowed_queue_ids.includes(queueId)}
                        onChange={() => toggleQueueInConfig(queueId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{queue.purpose}</span>
                    </label>
                  )
                })
              )}
            </div>
            {configForm.allowed_queue_ids.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No queues selected - bot can work on any queue</p>
            )}
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowConfigModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  )
}
