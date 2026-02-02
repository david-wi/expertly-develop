import { useEffect, useState, useCallback } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, BacklogItem, BacklogStatus, BacklogPriority, CreateBacklogItemRequest } from '../services/api'
import { ClipboardList, Plus, Tag } from 'lucide-react'

function getStatusBadgeColor(status: BacklogStatus): string {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800'
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

function getPriorityBadgeColor(priority: BacklogPriority): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-orange-100 text-orange-800'
    case 'low':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatStatus(status: BacklogStatus): string {
  switch (status) {
    case 'new':
      return 'New'
    case 'in_progress':
      return 'In Progress'
    case 'done':
      return 'Done'
    case 'archived':
      return 'Archived'
    default:
      return status
  }
}

function formatPriority(priority: BacklogPriority): string {
  switch (priority) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    default:
      return priority
  }
}

export default function Backlog() {
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateBacklogItemRequest & { status?: BacklogStatus }>({
    title: '',
    description: '',
    priority: 'medium',
    tags: [],
  })
  const [tagInput, setTagInput] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getBacklogItems({
        category: 'backlog',
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      })
      setItems(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load backlog items'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      tags: [],
    })
    setTagInput('')
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
      priority: item.priority,
      status: item.status,
      tags: item.tags || [],
    })
    setTagInput('')
    setShowEditModal(true)
  }

  const openDeleteConfirm = (item: BacklogItem) => {
    setSelectedItem(item)
    setShowDeleteConfirm(true)
  }

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags?.includes(tag)) {
      setFormData({ ...formData, tags: [...(formData.tags || []), tag] })
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter(t => t !== tag) || [] })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setSaving(true)
    setError(null)
    try {
      await api.createBacklogItem({
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        priority: formData.priority,
        category: 'backlog',
        tags: formData.tags,
      })
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create backlog item'
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
        priority: formData.priority,
        tags: formData.tags,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedItem(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update backlog item'
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
      const message = err instanceof Error ? err.message : 'Failed to delete backlog item'
      setError(message)
      alert(message)
    } finally {
      setSaving(false)
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
          <ClipboardList className="h-8 w-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Backlog</h2>
            <p className="text-sm text-gray-500">Track work items and tasks</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 flex-wrap gap-y-2">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Priority:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Backlog Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => {
                const itemId = item._id || item.id
                return (
                  <tr key={itemId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      {item.description && (
                        <p className="text-xs text-gray-500 truncate max-w-md">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(item.status)}`}
                      >
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(item.priority)}`}
                      >
                        {formatPriority(item.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                        {item.tags && item.tags.length > 3 && (
                          <span className="text-xs text-gray-400">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditModal(item)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(item)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No backlog items found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Backlog Item"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Implement user authentication"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="Describe the work item..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority || 'medium'}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as BacklogPriority })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal && !!selectedItem}
        onClose={() => setShowEditModal(false)}
        title="Edit Backlog Item"
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
              rows={3}
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
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={formData.priority || 'medium'}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as BacklogPriority })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
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
        title="Delete Backlog Item?"
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
