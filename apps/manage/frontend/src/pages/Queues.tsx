import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { api, Queue, CreateQueueRequest } from '../services/api'

interface QueueStats {
  _id: string
  purpose: string
  scope_type: string
  scope_id?: string
  is_system: boolean
  total_tasks: number
  queued: number
  in_progress: number
  completed: number
  failed: number
}

export default function Queues() {
  const { queues, user, fetchQueues, loading } = useAppStore()
  const [searchParams] = useSearchParams()
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null)
  const [stats, setStats] = useState<QueueStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({ purpose: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchQueues()
    loadStats()
  }, [fetchQueues])

  useEffect(() => {
    const queueId = searchParams.get('id')
    if (queueId) {
      const queue = queues.find((q) => (q._id || q.id) === queueId)
      if (queue) setSelectedQueue(queue)
    }
  }, [searchParams, queues])

  // Close modals on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false)
        if (showEditModal) setShowEditModal(false)
        if (showDeleteConfirm) setShowDeleteConfirm(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showCreateModal, showEditModal, showDeleteConfirm])

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const response = await fetch('/api/v1/queues/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load queue stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const getQueueStats = (queueId: string): QueueStats | undefined => {
    return stats.find((s) => s._id === queueId)
  }

  const getOwnerLabel = (queue: Queue): string => {
    if (queue.scope_type === 'user') {
      // If scope_id matches current user, show their name
      if (queue.scope_id === user?.id) {
        return user?.name || 'You'
      }
      return 'User'
    }
    if (queue.scope_type === 'team') {
      return 'Team'
    }
    return 'Everyone'
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.purpose.trim()) return

    setSaving(true)
    try {
      const newQueue: CreateQueueRequest = {
        purpose: formData.purpose.trim(),
        description: formData.description.trim() || undefined,
        scope_type: 'user', // Default to user-scoped
      }
      await api.createQueue(newQueue)
      await fetchQueues()
      await loadStats()
      setShowCreateModal(false)
      setFormData({ purpose: '', description: '' })
    } catch (error) {
      console.error('Failed to create queue:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedQueue || !formData.purpose.trim()) return

    const queueId = selectedQueue._id || selectedQueue.id
    setSaving(true)
    try {
      await api.updateQueue(queueId, {
        purpose: formData.purpose.trim(),
        description: formData.description.trim() || undefined,
      })
      await fetchQueues()
      setShowEditModal(false)
      setSelectedQueue(null)
    } catch (error) {
      console.error('Failed to update queue:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedQueue) return

    const queueId = selectedQueue._id || selectedQueue.id
    setSaving(true)
    try {
      await api.deleteQueue(queueId)
      await fetchQueues()
      await loadStats()
      setShowDeleteConfirm(false)
      setSelectedQueue(null)
    } catch (error) {
      console.error('Failed to delete queue:', error)
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (queue: Queue) => {
    setSelectedQueue(queue)
    setFormData({ purpose: queue.purpose, description: queue.description || '' })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (queue: Queue) => {
    setSelectedQueue(queue)
    setShowDeleteConfirm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Queues</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadStats}
            className="text-gray-600 hover:text-gray-700 text-sm"
            disabled={loadingStats}
          >
            {loadingStats ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => {
              setFormData({ purpose: '', description: '' })
              setShowCreateModal(true)
            }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            New Queue
          </button>
        </div>
      </div>

      {/* Compact Queue List */}
      <div className="bg-white shadow rounded-lg overflow-hidden max-w-3xl">
        {loading.queues ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queue
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Queued
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Active
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Done
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {queues.map((queue) => {
                const queueId = queue._id || queue.id
                const queueStats = getQueueStats(queueId)

                return (
                  <tr key={queueId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{queue.purpose}</p>
                        {queue.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {queue.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {getOwnerLabel(queue)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-blue-600">
                        {queueStats?.queued ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-yellow-600">
                        {queueStats?.in_progress ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-green-600">
                        {queueStats?.completed ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(queue)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(queue)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {queues.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No queues found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Queue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Queue</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Client Projects, Weekly Reviews"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                  placeholder="Brief description of this queue"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Queue Modal */}
      {showEditModal && selectedQueue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Queue</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedQueue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Queue?</h3>
            <p className="text-gray-500 mb-4">
              Are you sure you want to delete "{selectedQueue.purpose}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
