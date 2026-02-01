import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lightbulb,
  Plus,
  Sparkles,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// Types
interface Idea {
  id: string
  product: string
  title: string
  description: string | null
  status: 'new' | 'in_progress' | 'done' | 'archived'
  priority: 'low' | 'medium' | 'high'
  tags: string[] | null
  created_by_email: string | null
  created_at: string
  updated_at: string
}

interface IdeaCreate {
  product: string
  title: string
  description?: string
  status?: Idea['status']
  priority?: Idea['priority']
  tags?: string[]
}

// Valid products
const VALID_PRODUCTS = [
  'admin',
  'define',
  'develop',
  'identity',
  'manage',
  'salon',
  'today',
  'vibecode',
  'vibetest',
  'chem',
]

// API functions
const API_BASE = import.meta.env.VITE_API_URL || ''

const ideasApi = {
  async list(params?: { product?: string; status?: string; priority?: string; include_archived?: boolean }): Promise<Idea[]> {
    const searchParams = new URLSearchParams()
    if (params?.product) searchParams.set('product', params.product)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.priority) searchParams.set('priority', params.priority)
    if (params?.include_archived) searchParams.set('include_archived', 'true')
    const query = searchParams.toString()
    const res = await fetch(`${API_BASE}/api/ideas${query ? `?${query}` : ''}`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to fetch ideas')
    return res.json()
  },

  async create(data: IdeaCreate): Promise<Idea> {
    const res = await fetch(`${API_BASE}/api/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to create idea')
    return res.json()
  },

  async update(id: string, data: Partial<Idea>): Promise<Idea> {
    const res = await fetch(`${API_BASE}/api/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to update idea')
    return res.json()
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/ideas/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to delete idea')
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

function getStatusBadgeColor(status: Idea['status']): string {
  switch (status) {
    case 'new':
      return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300'
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
    case 'done':
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
    case 'archived':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
  }
}

function formatStatus(status: Idea['status']): string {
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

function getPriorityBadgeColor(priority: Idea['priority']): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
    case 'low':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300'
  }
}

function IdeaCard({
  idea,
  onEdit,
  onUpdateStatus,
}: {
  idea: Idea
  onEdit: () => void
  onUpdateStatus: (status: Idea['status']) => void
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
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(idea.status)}`}>
                {formatStatus(idea.status)}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(idea.priority)}`}>
                {idea.priority}
              </span>
              <span className="text-xs px-2 py-0.5 bg-theme-bg-elevated rounded text-theme-text-secondary">
                {idea.product}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-theme-text-primary mb-1">{idea.title}</h3>
            {idea.description && (
              <p className="text-sm text-theme-text-secondary line-clamp-2">{idea.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-text-muted whitespace-nowrap">
              {formatDate(idea.created_at)}
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
          {idea.description && (
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-2">Description</h4>
              <p className="text-sm text-theme-text-secondary whitespace-pre-wrap">{idea.description}</p>
            </div>
          )}

          {idea.tags && idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 bg-theme-bg-elevated rounded text-theme-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-theme-text-muted">
            {idea.created_by_email && (
              <span>Created by: {idea.created_by_email}</span>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              {idea.status === 'new' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateStatus('in_progress')
                  }}
                  className="px-3 py-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded-lg text-sm font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors"
                >
                  Start Exploring
                </button>
              )}
              {idea.status === 'in_progress' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateStatus('done')
                  }}
                  className="px-3 py-1.5 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
                >
                  Mark Implemented
                </button>
              )}
              {idea.status !== 'archived' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateStatus('archived')
                  }}
                  className="px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-sm transition-colors"
                >
                  Archive
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

function CreateIdeaModal({
  idea,
  defaultProduct,
  onClose,
  onSave,
}: {
  idea?: Idea
  defaultProduct?: string
  onClose: () => void
  onSave: (data: IdeaCreate | Partial<Idea>) => void
}) {
  const [form, setForm] = useState<IdeaCreate>({
    product: idea?.product || defaultProduct || 'admin',
    title: idea?.title || '',
    description: idea?.description || '',
    status: idea?.status || 'new',
    priority: idea?.priority || 'medium',
    tags: idea?.tags || [],
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-theme-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-text-primary">
            {idea ? 'Edit Idea' : 'Capture New Idea'}
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
              Product *
            </label>
            <select
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              required
              className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {VALID_PRODUCTS.map((product) => (
                <option key={product} value={product}>
                  {product.charAt(0).toUpperCase() + product.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              What's the idea? *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              autoFocus
              className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., AI-powered task suggestions"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              Tell me more (optional)
            </label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Why is this idea valuable? What problem does it solve?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Idea['status'] })}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="new">New</option>
                <option value="in_progress">Exploring</option>
                <option value="done">Implemented</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Idea['priority'] })}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
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
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            {idea ? 'Save Changes' : 'Capture Idea'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function IdeaBacklog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // Get product filter from URL
  const productFilter = searchParams.get('product') || ''
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [includeArchived, setIncludeArchived] = useState(false)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)

  // Fetch ideas
  const { data: ideas = [], isLoading, refetch } = useQuery({
    queryKey: ['ideas', productFilter, statusFilter, priorityFilter, includeArchived],
    queryFn: () => ideasApi.list({
      product: productFilter || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      include_archived: includeArchived,
    }),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: IdeaCreate) => ideasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      setShowCreateModal(false)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Idea> }) =>
      ideasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      setEditingIdea(null)
    },
  })

  // Stats
  const newCount = ideas.filter((i) => i.status === 'new').length
  const exploringCount = ideas.filter((i) => i.status === 'in_progress').length
  const implementedCount = ideas.filter((i) => i.status === 'done').length

  // Update URL when product filter changes
  const handleProductFilterChange = useCallback((product: string) => {
    if (product) {
      setSearchParams({ product })
    } else {
      setSearchParams({})
    }
  }, [setSearchParams])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-theme-text-primary">Idea Backlog</h1>
            <p className="text-theme-text-secondary mt-1">
              Capture and nurture ideas across all Expertly products
            </p>
          </div>
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
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            New Idea
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme-text-primary">{newCount}</p>
              <p className="text-sm text-theme-text-secondary">New Ideas</p>
            </div>
          </div>
        </div>
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme-text-primary">{exploringCount}</p>
              <p className="text-sm text-theme-text-secondary">Exploring</p>
            </div>
          </div>
        </div>
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme-text-primary">{implementedCount}</p>
              <p className="text-sm text-theme-text-secondary">Implemented</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-theme-bg-surface rounded-xl border border-theme-border p-4">
        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Product</label>
          <select
            value={productFilter}
            onChange={(e) => handleProductFilterChange(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Products</option>
            {VALID_PRODUCTS.map((product) => (
              <option key={product} value={product}>
                {product.charAt(0).toUpperCase() + product.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="in_progress">Exploring</option>
            <option value="done">Implemented</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Priority</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-theme-border"
            />
            <span className="text-sm text-theme-text-secondary">Show archived</span>
          </label>
        </div>

        {(productFilter || statusFilter || priorityFilter) && (
          <button
            onClick={() => {
              handleProductFilterChange('')
              setStatusFilter('')
              setPriorityFilter('')
            }}
            className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary mt-4"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Ideas list */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-8 text-center text-theme-text-muted">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading ideas...
          </div>
        ) : ideas.length === 0 ? (
          <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-8 text-center text-theme-text-muted">
            <Lightbulb className="w-8 h-8 mx-auto mb-2" />
            <p className="text-lg font-medium text-theme-text-primary mb-1">No ideas yet</p>
            <p className="text-sm">
              {productFilter
                ? `No ideas for ${productFilter}. Got a spark of inspiration? Capture it!`
                : "Got a spark of inspiration? Capture it here!"}
            </p>
          </div>
        ) : (
          ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onEdit={() => setEditingIdea(idea)}
              onUpdateStatus={(status) =>
                updateMutation.mutate({
                  id: idea.id,
                  data: { status },
                })
              }
            />
          ))
        )}
      </div>

      {/* Create/Edit modal */}
      {(showCreateModal || editingIdea) && (
        <CreateIdeaModal
          idea={editingIdea || undefined}
          defaultProduct={productFilter || undefined}
          onClose={() => {
            setShowCreateModal(false)
            setEditingIdea(null)
          }}
          onSave={(data) => {
            if (editingIdea) {
              updateMutation.mutate({ id: editingIdea.id, data })
            } else {
              createMutation.mutate(data as IdeaCreate)
            }
          }}
        />
      )}
    </div>
  )
}

export default IdeaBacklog
