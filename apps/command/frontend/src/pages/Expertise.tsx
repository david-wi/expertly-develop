import { useEffect, useState, useCallback, useRef } from 'react'
import { Modal, ModalFooter } from '@expertly/ui'
import { api, Expertise, ExpertiseContentType, CreateExpertiseRequest, ExpertiseHistoryEntry } from '../services/api'
import { BookOpen, Plus, FileText, Link, Upload, RefreshCw, Copy, History, Download, MoreVertical, Eye } from 'lucide-react'
import { createErrorLogger } from '../utils/errorLogger'

const logger = createErrorLogger('Expertise')

function getContentTypeBadge(type: ExpertiseContentType): { color: string; label: string; icon: typeof FileText } {
  switch (type) {
    case 'markdown':
      return { color: 'bg-blue-100 text-blue-800', label: 'Markdown', icon: FileText }
    case 'file':
      return { color: 'bg-purple-100 text-purple-800', label: 'File', icon: Upload }
    case 'url':
      return { color: 'bg-green-100 text-green-800', label: 'URL', icon: Link }
    default:
      return { color: 'bg-gray-100 text-gray-800', label: type, icon: FileText }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export default function ExpertisePage() {
  const [items, setItems] = useState<Expertise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Expertise | null>(null)
  const [historyEntries, setHistoryEntries] = useState<ExpertiseHistoryEntry[]>([])
  const [saving, setSaving] = useState(false)

  // Dropdown menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Form state
  const [formData, setFormData] = useState<{
    title: string
    description: string
    content_type: ExpertiseContentType
    markdown_content: string
    url: string
  }>({
    title: '',
    description: '',
    content_type: 'markdown',
    markdown_content: '',
    url: '',
  })

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getExpertise({
        content_type: contentTypeFilter || undefined,
      })
      setItems(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expertise items'
      setError(message)
      logger.error(err, { action: 'loadExpertise' })
    } finally {
      setLoading(false)
    }
  }, [contentTypeFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content_type: 'markdown',
      markdown_content: '',
      url: '',
    })
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const openCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const openEditModal = (item: Expertise) => {
    setSelectedItem(item)
    setFormData({
      title: item.title,
      description: item.description || '',
      content_type: item.content_type,
      markdown_content: item.markdown_content || '',
      url: item.url || '',
    })
    setShowEditModal(true)
  }

  const openDeleteConfirm = (item: Expertise) => {
    setSelectedItem(item)
    setShowDeleteConfirm(true)
    setOpenMenuId(null)
  }

  const openHistoryModal = async (item: Expertise) => {
    setSelectedItem(item)
    setOpenMenuId(null)
    try {
      const history = await api.getExpertiseHistory(item.id)
      setHistoryEntries(history)
      setShowHistoryModal(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history'
      alert(message)
      logger.error(err, { action: 'loadHistory' })
    }
  }

  const openPreviewModal = (item: Expertise) => {
    setSelectedItem(item)
    setShowPreviewModal(true)
    setOpenMenuId(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setSaving(true)
    setError(null)
    try {
      if (formData.content_type === 'file' && selectedFile) {
        await api.uploadExpertise(
          selectedFile,
          formData.title.trim(),
          formData.description.trim() || undefined
        )
      } else {
        const request: CreateExpertiseRequest = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          content_type: formData.content_type,
          markdown_content: formData.content_type === 'markdown' ? formData.markdown_content : undefined,
          url: formData.content_type === 'url' ? formData.url : undefined,
        }
        await api.createExpertise(request)
      }
      await loadData()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create expertise'
      setError(message)
      alert(message)
      logger.error(err, { action: 'createExpertise' })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    setSaving(true)
    setError(null)
    try {
      await api.updateExpertise(selectedItem.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        markdown_content: selectedItem.content_type === 'markdown' ? formData.markdown_content : undefined,
        url: selectedItem.content_type === 'url' ? formData.url : undefined,
      })
      await loadData()
      setShowEditModal(false)
      setSelectedItem(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update expertise'
      setError(message)
      alert(message)
      logger.error(err, { action: 'updateExpertise' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return

    setSaving(true)
    setError(null)
    try {
      await api.deleteExpertise(selectedItem.id)
      await loadData()
      setShowDeleteConfirm(false)
      setSelectedItem(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expertise'
      setError(message)
      alert(message)
      logger.error(err, { action: 'deleteExpertise' })
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (item: Expertise) => {
    setOpenMenuId(null)
    try {
      await api.duplicateExpertise(item.id)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to duplicate expertise'
      alert(message)
      logger.error(err, { action: 'duplicateExpertise' })
    }
  }

  const handleRefreshUrl = async (item: Expertise) => {
    setOpenMenuId(null)
    try {
      await api.refreshExpertiseUrl(item.id)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh URL content'
      alert(message)
      logger.error(err, { action: 'refreshUrl' })
    }
  }

  const handleReExtract = async (item: Expertise) => {
    setOpenMenuId(null)
    try {
      await api.reExtractExpertiseFile(item.id)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to re-extract file content'
      alert(message)
      logger.error(err, { action: 'reExtractFile' })
    }
  }

  const handleDownload = (item: Expertise) => {
    setOpenMenuId(null)
    window.open(api.getExpertiseDownloadUrl(item.id), '_blank')
  }

  const getContentPreview = (item: Expertise): string => {
    if (item.content_type === 'markdown') {
      return item.markdown_content || ''
    } else if (item.content_type === 'file') {
      return item.extracted_markdown || ''
    } else if (item.content_type === 'url') {
      return item.url_content_markdown || ''
    }
    return ''
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
          <BookOpen className="h-8 w-8 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Expertise</h2>
            <p className="text-sm text-gray-500">Reusable knowledge for playbooks and automation</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Expertise
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 flex-wrap gap-y-2">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Type:</label>
          <select
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="markdown">Markdown</option>
            <option value="file">File</option>
            <option value="url">URL</option>
          </select>
        </div>
      </div>

      {/* Expertise List */}
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
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => {
                const badge = getContentTypeBadge(item.content_type)
                const IconComponent = badge.icon
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.title}</div>
                      {item.description && (
                        <p className="text-xs text-gray-500 truncate max-w-md">
                          {item.description}
                        </p>
                      )}
                      {item.content_type === 'file' && item.original_filename && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.original_filename} ({formatBytes(item.size_bytes || 0)})
                        </p>
                      )}
                      {item.content_type === 'url' && item.url && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                          {item.url}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}
                      >
                        <IconComponent className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      v{item.version}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(item.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >
                          Edit
                        </button>
                        <div className="relative" ref={openMenuId === item.id ? menuRef : null}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === item.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-10">
                              <button
                                onClick={() => openPreviewModal(item)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Preview Content
                              </button>
                              <button
                                onClick={() => openHistoryModal(item)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <History className="w-4 h-4" />
                                View History
                              </button>
                              <button
                                onClick={() => handleDuplicate(item)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Duplicate
                              </button>
                              {item.content_type === 'url' && (
                                <button
                                  onClick={() => handleRefreshUrl(item)}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Refresh URL
                                </button>
                              )}
                              {item.content_type === 'file' && (
                                <>
                                  <button
                                    onClick={() => handleDownload(item)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <Download className="w-4 h-4" />
                                    Download File
                                  </button>
                                  <button
                                    onClick={() => handleReExtract(item)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                    Re-extract Text
                                  </button>
                                </>
                              )}
                              <hr className="my-1" />
                              <button
                                onClick={() => openDeleteConfirm(item)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No expertise items found. Create one to get started.
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
        title="Create Expertise"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Using the Automation Designer"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Brief description of this expertise..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="content_type"
                  value="markdown"
                  checked={formData.content_type === 'markdown'}
                  onChange={(e) => setFormData({ ...formData, content_type: e.target.value as ExpertiseContentType })}
                  className="text-indigo-600"
                />
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm">Markdown</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="content_type"
                  value="file"
                  checked={formData.content_type === 'file'}
                  onChange={(e) => setFormData({ ...formData, content_type: e.target.value as ExpertiseContentType })}
                  className="text-indigo-600"
                />
                <Upload className="w-4 h-4 text-gray-500" />
                <span className="text-sm">File Upload</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="content_type"
                  value="url"
                  checked={formData.content_type === 'url'}
                  onChange={(e) => setFormData({ ...formData, content_type: e.target.value as ExpertiseContentType })}
                  className="text-indigo-600"
                />
                <Link className="w-4 h-4 text-gray-500" />
                <span className="text-sm">URL</span>
              </label>
            </div>
          </div>

          {/* Content input based on type */}
          {formData.content_type === 'markdown' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.markdown_content}
                onChange={(e) => setFormData({ ...formData, markdown_content: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
                rows={12}
                placeholder="Enter markdown content..."
                required
              />
            </div>
          )}

          {formData.content_type === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Choose a file
                    </button>
                    <p className="text-xs text-gray-500 mt-1">PDF, Word, or text files</p>
                  </>
                )}
              </div>
            </div>
          )}

          {formData.content_type === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="https://example.com/docs/guide"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Content will be retrieved and stored. You can refresh it later.
              </p>
            </div>
          )}

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
              disabled={saving || (formData.content_type === 'file' && !selectedFile)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
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
        title="Edit Expertise"
        size="lg"
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
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          {/* Content type is fixed after creation, show badge */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
            {selectedItem && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getContentTypeBadge(selectedItem.content_type).color}`}>
                {getContentTypeBadge(selectedItem.content_type).label}
              </span>
            )}
          </div>

          {/* Content input based on type */}
          {selectedItem?.content_type === 'markdown' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.markdown_content}
                onChange={(e) => setFormData({ ...formData, markdown_content: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
                rows={12}
              />
            </div>
          )}

          {selectedItem?.content_type === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              {selectedItem.url_retrieved_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Last retrieved: {formatDate(selectedItem.url_retrieved_at)}
                </p>
              )}
            </div>
          )}

          {selectedItem?.content_type === 'file' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <div className="bg-gray-50 rounded-md p-3 text-sm">
                <p className="font-medium">{selectedItem.original_filename}</p>
                <p className="text-gray-500">{formatBytes(selectedItem.size_bytes || 0)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  To replace the file, create a new expertise item.
                </p>
              </div>
            </div>
          )}

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
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal && !!selectedItem}
        onClose={() => setShowHistoryModal(false)}
        title={`History: ${selectedItem?.title}`}
        size="lg"
      >
        <div className="space-y-4">
          {historyEntries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No history available.</p>
          ) : (
            <div className="divide-y">
              {historyEntries.map((entry, idx) => (
                <div key={idx} className="py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Version {entry.version}</span>
                    <span className="text-sm text-gray-500">{formatDate(entry.changed_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{entry.title}</p>
                  {entry.description && (
                    <p className="text-xs text-gray-500">{entry.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal && !!selectedItem}
        onClose={() => setShowPreviewModal(false)}
        title={`Preview: ${selectedItem?.title}`}
        size="lg"
      >
        <div className="max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-md font-mono">
            {selectedItem ? getContentPreview(selectedItem) || 'No content available.' : ''}
          </pre>
        </div>
        <ModalFooter>
          <button
            onClick={() => setShowPreviewModal(false)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm && !!selectedItem}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Expertise?"
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
