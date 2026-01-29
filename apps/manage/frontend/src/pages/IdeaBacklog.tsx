import { useEffect, useState, useCallback } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, BacklogItem, BacklogStatus, CreateBacklogItemRequest } from '../services/api'
import { Lightbulb, Plus, Sparkles } from 'lucide-react'

function getStatusBadgeColor(status: BacklogStatus): string {
  switch (status) {
    case 'new':
      return 'bg-purple-100 text-purple-800'
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800'
    case 'done':
      return 'bg-green-100 text-green-800'
    case 'archived':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatStatus(status: BacklogStatus): string {
  switch (status) {
    case 'new':
      return 'New'
    case 'in_progress':
      return 'Exploring'
    case 'done':
      return 'Implemented'
    case 'archived':
      return 'Archived'
    default:
      return status
  }
}

export default function IdeaBacklog() {
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state - simplified for ideas
  const [formData, setFormData] = useState<CreateBacklogItemRequest & { status?: BacklogStatus }>({
    title: '',
    description: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getIdeas({
        status: statusFilter || undefined,
      })
      setItems(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ideas'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
    })
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (item: BacklogItem) => {
    setSelectedItem(item)
    setFormData({
      title: item.title,
      description: item.description || '',
      status: item.status,
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (item: BacklogItem) => {
    setSelectedItem(item)
    setShowDeleteConfirm(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setSaving(true)
    setError(null)
    try {
      await api.createIdea({
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
      })
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create idea'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    const itemId = selectedItem._id || selectedItem.id
    setSaving(true)
    setError(null)
    try {
      await api.updateBacklogItem(itemId, {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        status: formData.status,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedItem(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update idea'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return

    const itemId = selectedItem._id || selectedItem.id
    setSaving(true)
    setError(null)
    try {
      await api.deleteBacklogItem(itemId)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedItem(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete idea'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const quickPromote = async (item: BacklogItem) => {
    const itemId = item._id || item.id
    try {
      await api.updateBacklogItem(itemId, {
        category: 'backlog',
        status: 'new',
      })
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to promote idea'
      alert(message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Idea Backlog</h2>
            <p className="text-sm text-gray-500">Capture and nurture new ideas</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-yellow-500 text-white px-3 py-1.5 rounded-md text-sm hover:bg-yellow-600 transition-colors flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          New Idea
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="in_progress">Exploring</option>
          <option value="done">Implemented</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Ideas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-4 text-gray-500 text-center">Loading...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full bg-white shadow rounded-lg p-8 text-center">
            <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No ideas yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Got a spark of inspiration? Capture it here!
            </p>
          </div>
        ) : (
          items.map((item) => {
            const itemId = item._id || item.id
            return (
              <div
                key={itemId}
                className="bg-white shadow rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(item.status)}`}
                  >
                    {formatStatus(item.status)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => quickPromote(item)}
                      title="Promote to Backlog"
                      className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{item.title}</h3>
                {item.description && (
                  <p className="text-sm text-gray-500 line-clamp-3 mb-3">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(item)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Capture New Idea"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What's the idea?</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., AI-powered task suggestions"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tell me more (optional)
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={4}
              placeholder="Why is this idea valuable? What problem does it solve?"
            />
          </div>
          <ModalFooter>
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
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Capture Idea'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal && !!selectedItem}
        onClose={() => setShowEditModal(false)}
        title="Edit Idea"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status || 'new'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as BacklogStatus })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="new">New</option>
              <option value="in_progress">Exploring</option>
              <option value="done">Implemented</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <ModalFooter>
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
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedItem}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Idea?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedItem?.title}"? This action cannot be undone.
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
