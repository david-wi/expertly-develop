import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import { usersApi } from '@/services/api'
import {
  Lightbulb,
  Plus,
  Sparkles,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  Archive,
  ArchiveRestore,
  Heart,
  MessageCircle,
  Square,
  CheckSquare,
  Trash2,
  Send,
  Code,
} from 'lucide-react'
import { InlineVoiceTranscription, EXPERTLY_PRODUCTS } from '@expertly/ui'

// Types
interface Idea {
  id: string
  product: string
  title: string
  description: string | null
  status: 'new' | 'in_progress' | 'done' | 'archived'
  priority: 'low' | 'medium' | 'high'
  tags: string[] | null
  category: string | null
  item_type: string
  created_by_email: string | null
  organization_id: string | null
  created_at: string
  updated_at: string
  vote_count?: number
  user_voted?: boolean
  comment_count?: number
}

interface IdeaComment {
  id: string
  idea_id: string
  author_email: string
  content: string
  created_at: string
  updated_at: string
}

// Predefined tags per product
const PRODUCT_TAGS: Record<string, string[]> = {
  admin: ['ui', 'api', 'security', 'monitoring', 'performance', 'themes'],
  manage: ['tasks', 'projects', 'calendar', 'notifications', 'mobile', 'queue'],
  define: ['requirements', 'artifacts', 'ai', 'collaboration', 'export', 'templates'],
  develop: ['walkthroughs', 'recording', 'playback', 'projects', 'artifacts'],
  identity: ['auth', 'users', 'organizations', 'teams', 'permissions', 'sso'],
  salon: ['appointments', 'clients', 'services', 'staff', 'scheduling'],
  tms: ['shipments', 'carriers', 'routes', 'tracking', 'dispatch', 'loads'],
  today: ['tasks', 'workflows', 'calendar', 'notifications', 'integrations'],
  vibecode: ['agents', 'sessions', 'tools', 'streaming', 'widgets'],
  vibetest: ['testing', 'automation', 'reports', 'scenarios', 'ai'],
}

// Helper to get product icon from EXPERTLY_PRODUCTS
function getProductIcon(productCode: string) {
  const product = EXPERTLY_PRODUCTS.find(p => p.code === productCode)
  return product?.icon
}

// Helper to get product display name
function getProductDisplayName(productCode: string): string {
  const product = EXPERTLY_PRODUCTS.find(p => p.code === productCode)
  if (product) {
    return product.name.replace('Expertly ', '')
  }
  return productCode.charAt(0).toUpperCase() + productCode.slice(1)
}

// Priority order for sorting
const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

type SortOption = 'priority' | 'date' | 'loves'
type GroupByOption = 'none' | 'category'

interface IdeaCreate {
  product: string
  title: string
  description?: string
  status?: Idea['status']
  priority?: Idea['priority']
  tags?: string[]
  category?: string
  item_type?: string
  organization_id?: string
  created_by_email?: string
}


// API functions
// VITE_API_URL already includes /api prefix (e.g., https://admin-api.ai.devintensive.com/api)
const API_BASE = import.meta.env.VITE_API_URL || '/api'

const ideasApi = {
  async list(params?: { product?: string; status?: string; priority?: string; include_archived?: boolean; user_email?: string; organization_id?: string; backlog_type?: string; item_type?: string }): Promise<Idea[]> {
    const searchParams = new URLSearchParams()
    if (params?.product) searchParams.set('product', params.product)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.priority) searchParams.set('priority', params.priority)
    if (params?.include_archived) searchParams.set('include_archived', 'true')
    if (params?.user_email) searchParams.set('user_email', params.user_email)
    if (params?.organization_id) searchParams.set('organization_id', params.organization_id)
    if (params?.backlog_type) searchParams.set('backlog_type', params.backlog_type)
    if (params?.item_type) searchParams.set('item_type', params.item_type)
    const query = searchParams.toString()
    const res = await fetch(`${API_BASE}/ideas${query ? `?${query}` : ''}`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to fetch ideas')
    return res.json()
  },

  async getCategories(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/ideas/categories`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to fetch categories')
    return res.json()
  },

  async create(data: IdeaCreate): Promise<Idea> {
    const res = await fetch(`${API_BASE}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to create idea')
    return res.json()
  },

  async update(id: string, data: Partial<Idea>): Promise<Idea> {
    const res = await fetch(`${API_BASE}/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to update idea')
    return res.json()
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/ideas/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to delete idea')
  },

  async toggleVote(id: string, userEmail: string): Promise<{ idea_id: string; vote_count: number; user_voted: boolean }> {
    const res = await fetch(`${API_BASE}/ideas/${id}/vote?user_email=${encodeURIComponent(userEmail)}`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to toggle vote')
    return res.json()
  },

  async getComments(ideaId: string): Promise<IdeaComment[]> {
    const res = await fetch(`${API_BASE}/ideas/${ideaId}/comments`, {
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to fetch comments')
    return res.json()
  },

  async addComment(ideaId: string, content: string, authorEmail: string): Promise<IdeaComment> {
    const res = await fetch(`${API_BASE}/ideas/${ideaId}/comments?author_email=${encodeURIComponent(authorEmail)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to add comment')
    return res.json()
  },

  async deleteComment(ideaId: string, commentId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/ideas/${ideaId}/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Failed to delete comment')
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
  onVote,
  isSelected,
  onToggleSelect,
  selectMode,
  userEmail,
  onCommentCountChange,
}: {
  idea: Idea
  onEdit: () => void
  onUpdateStatus: (status: Idea['status']) => void
  onVote?: () => void
  isSelected?: boolean
  onToggleSelect?: () => void
  selectMode?: boolean
  userEmail?: string
  onCommentCountChange?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<IdeaComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const ProductIcon = getProductIcon(idea.product)

  const loadComments = useCallback(async () => {
    if (loadingComments) return
    setLoadingComments(true)
    try {
      const data = await ideasApi.getComments(idea.id)
      setComments(data)
    } catch (error) {
      console.error('Failed to load comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }, [idea.id, loadingComments])

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !userEmail || submittingComment) return
    setSubmittingComment(true)
    try {
      const comment = await ideasApi.addComment(idea.id, newComment.trim(), userEmail)
      setComments([...comments, comment])
      setNewComment('')
      onCommentCountChange?.()
    } catch (error) {
      console.error('Failed to add comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await ideasApi.deleteComment(idea.id, commentId)
      setComments(comments.filter(c => c.id !== commentId))
      onCommentCountChange?.()
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const handleToggleComments = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!showComments) {
      loadComments()
    }
    setShowComments(!showComments)
    if (!expanded) {
      setExpanded(true)
    }
  }

  return (
    <div className={`bg-theme-bg-surface rounded-xl border overflow-hidden ${isSelected ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-theme-border'}`}>
      <div
        className="px-4 py-2.5 cursor-pointer hover:bg-theme-bg-elevated transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          {selectMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect?.()
              }}
              className="mt-0.5 p-1 text-theme-text-secondary hover:text-primary-500 transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-primary-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(idea.status)}`}>
                {formatStatus(idea.status)}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(idea.priority)}`}>
                {idea.priority}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-theme-bg-elevated rounded text-theme-text-secondary">
                {ProductIcon && <ProductIcon className="w-3 h-3" />}
                {getProductDisplayName(idea.product)}
              </span>
              {idea.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                  {idea.category}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-theme-text-primary">{idea.title}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-theme-text-muted whitespace-nowrap">
                {formatDate(idea.created_at)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="p-1 text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-elevated rounded transition-colors"
                aria-label="Edit idea"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-theme-text-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-theme-text-muted" />
              )}
            </div>
            {/* Vote and comment counts */}
            <div className="flex items-center gap-3">
              {onVote && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onVote()
                  }}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    idea.user_voted
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-theme-text-muted hover:text-red-500'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${idea.user_voted ? 'fill-current' : ''}`} />
                  <span>{idea.vote_count || 0}</span>
                </button>
              )}
              {idea.comment_count !== undefined && (
                <button
                  onClick={handleToggleComments}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    showComments
                      ? 'text-primary-500 hover:text-primary-600'
                      : 'text-theme-text-muted hover:text-primary-500'
                  }`}
                >
                  <MessageCircle className={`w-3.5 h-3.5 ${showComments ? 'fill-current' : ''}`} />
                  <span>{idea.comment_count}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-theme-border pt-4 space-y-4">
          {idea.description && (
            <div>
              <h4 className="text-sm font-medium text-theme-text-primary mb-2">Description</h4>
              <div className="text-sm text-theme-text-secondary prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{idea.description}</ReactMarkdown>
              </div>
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

          <div className="flex flex-wrap gap-2 pt-2">
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
            {idea.status !== 'archived' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateStatus('archived')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateStatus('new')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/70 transition-colors"
              >
                <ArchiveRestore className="w-4 h-4" />
                Unarchive
              </button>
            )}
          </div>

          {/* Comments Section */}
          {showComments && (
            <div className="border-t border-theme-border pt-4">
              <h4 className="text-sm font-medium text-theme-text-primary mb-3 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Comments ({comments.length})
              </h4>

              {loadingComments ? (
                <div className="text-sm text-theme-text-muted flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading comments...
                </div>
              ) : (
                <>
                  {comments.length === 0 ? (
                    <p className="text-sm text-theme-text-muted mb-3">No comments yet. Be the first to comment!</p>
                  ) : (
                    <div className="space-y-3 mb-4">
                      {comments.map((comment) => (
                        <div key={comment.id} className="bg-theme-bg-elevated rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-theme-text-primary">
                                  {comment.author_email}
                                </span>
                                <span className="text-xs text-theme-text-muted">
                                  {formatDate(comment.created_at)}
                                </span>
                              </div>
                              <div className="text-sm text-theme-text-secondary prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{comment.content}</ReactMarkdown>
                              </div>
                            </div>
                            {userEmail === comment.author_email && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-theme-text-muted hover:text-red-500 rounded transition-colors"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {userEmail && (
                    <form onSubmit={handleSubmitComment} className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary placeholder-theme-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="submit"
                        disabled={!newComment.trim() || submittingComment}
                        className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreateIdeaModal({
  idea,
  defaultProduct,
  organizationId,
  defaultItemType,
  onClose,
  onSave,
}: {
  idea?: Idea
  defaultProduct?: string
  organizationId?: string
  defaultItemType?: string
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
    category: idea?.category || '',
    item_type: idea?.item_type || defaultItemType || 'idea',
  })
  const [tagInput, setTagInput] = useState('')
  const [categoryInput, setCategoryInput] = useState(idea?.category || '')
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  // Fetch categories for typeahead
  const { data: categories = [] } = useQuery({
    queryKey: ['idea-categories'],
    queryFn: () => ideasApi.getCategories(),
    staleTime: 2 * 60 * 1000,
  })

  // Filter categories based on input
  const filteredCategories = useMemo(() => {
    if (!categoryInput.trim()) return categories
    return categories.filter(c =>
      c.toLowerCase().includes(categoryInput.toLowerCase())
    )
  }, [categories, categoryInput])

  // Close category suggestions when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategorySuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Get suggested tags for selected product
  const suggestedTags = PRODUCT_TAGS[form.product] || []

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitData = { ...form, category: categoryInput.trim() || undefined }
    onSave(submitData)
  }

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !form.tags?.includes(trimmedTag)) {
      setForm({ ...form, tags: [...(form.tags || []), trimmedTag] })
    }
    setTagInput('')
  }

  const removeTag = (tagToRemove: string) => {
    setForm({ ...form, tags: form.tags?.filter(t => t !== tagToRemove) || [] })
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
  }

  const isFeatureMode = form.item_type === 'feature'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-theme-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-text-primary">
            {idea
              ? (organizationId ? 'Edit Backlog Item' : isFeatureMode ? 'Edit Feature' : 'Edit Idea')
              : (organizationId ? 'Add Backlog Item' : isFeatureMode ? 'Add Feature' : 'Capture New Idea')}
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
              {EXPERTLY_PRODUCTS.map((product) => (
                <option key={product.code} value={product.code}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              {organizationId ? 'Title *' : "What's the idea? *"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                autoFocus
                className="flex-1 px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={organizationId ? "e.g., Implement user authentication" : "e.g., AI-powered task suggestions"}
              />
              <InlineVoiceTranscription
                tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                onTranscribe={(text) => setForm({ ...form, title: form.title ? form.title + ' ' + text : text })}
                size="md"
                className="self-center"
              />
            </div>
          </div>

          {/* Category field with typeahead */}
          <div ref={categoryRef} className="relative">
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              Category
            </label>
            <input
              type="text"
              value={categoryInput}
              onChange={(e) => {
                setCategoryInput(e.target.value)
                setShowCategorySuggestions(true)
              }}
              onFocus={() => setShowCategorySuggestions(true)}
              className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              placeholder="e.g., Platform & Support, AI Features"
            />
            {showCategorySuggestions && filteredCategories.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-theme-bg-surface border border-theme-border rounded-lg shadow-lg max-h-48 overflow-auto">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoryInput(cat)
                      setShowCategorySuggestions(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-theme-text-primary hover:bg-theme-bg-elevated transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              {organizationId ? 'Description (optional)' : 'Tell me more (optional)'}
            </label>
            <div className="flex gap-2">
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="flex-1 px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder={organizationId ? "Describe the work item..." : "Why is this idea valuable? What problem does it solve?"}
              />
              <InlineVoiceTranscription
                tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                onTranscribe={(text) => setForm({ ...form, description: form.description ? form.description + ' ' + text : text })}
                size="md"
                className="self-start mt-1"
              />
            </div>
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

          {/* Tags section */}
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">
              Tags
            </label>
            <div className="space-y-2">
              {/* Current tags */}
              {form.tags && form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-primary-900 dark:hover:text-primary-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Tag input */}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput && addTag(tagInput)}
                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Type a tag and press Enter"
              />
              {/* Suggested tags */}
              {suggestedTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-theme-text-muted mr-1">Suggestions:</span>
                  {suggestedTags
                    .filter(tag => !form.tags?.includes(tag))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="text-xs px-2 py-0.5 bg-theme-bg-elevated text-theme-text-secondary hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900/50 dark:hover:text-primary-300 rounded transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              {idea ? 'Save Changes' : (organizationId ? 'Add Item' : isFeatureMode ? 'Add Feature' : 'Capture Idea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function IdeaBacklog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const queryClient = useQueryClient()

  // Get filters from URL
  const productFilter = searchParams.get('product') || ''
  const organizationId = searchParams.get('organization_id') || ''
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [includeArchived, setIncludeArchived] = useState(false)

  // Determine mode based on URL path
  const isIdeaCatalogMode = location.pathname === '/idea-catalog' || location.pathname === '/idea-backlog'
  const isDevBacklogMode = location.pathname === '/dev-backlog'
  const isWorkBacklogMode = location.pathname === '/work-backlog'

  // Default sort and group per mode
  const [sortBy, setSortBy] = useState<SortOption>(isIdeaCatalogMode ? 'loves' : isDevBacklogMode ? 'priority' : 'priority')
  const [groupBy, setGroupBy] = useState<GroupByOption>(isIdeaCatalogMode ? 'category' : 'none')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)

  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Current user email for voting
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => usersApi.me(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
  const userEmail = currentUser?.email

  // Determine item_type for API query
  const itemType = isIdeaCatalogMode ? 'idea' : isDevBacklogMode ? 'feature' : undefined

  // Fetch ideas - don't wait for user email, it's only needed for vote status
  const { data: ideas = [], isLoading: isIdeasLoading, refetch } = useQuery({
    queryKey: ['ideas', productFilter, statusFilter, priorityFilter, includeArchived, userEmail, organizationId, isWorkBacklogMode, itemType],
    queryFn: () => ideasApi.list({
      product: productFilter || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      include_archived: includeArchived,
      user_email: userEmail || undefined,
      organization_id: organizationId || undefined,
      backlog_type: isWorkBacklogMode ? 'work' : undefined,
      item_type: itemType,
    }),
  })

  // Combined loading state
  const isLoading = isUserLoading || isIdeasLoading

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: IdeaCreate) => ideasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      queryClient.invalidateQueries({ queryKey: ['idea-categories'] })
      setShowCreateModal(false)
    },
    onError: (error: Error) => {
      console.error('Failed to create idea:', error)
      alert(`Failed to create: ${error.message}`)
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Idea> }) =>
      ideasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      queryClient.invalidateQueries({ queryKey: ['idea-categories'] })
      setEditingIdea(null)
    },
  })

  // Vote mutation with optimistic update
  const voteMutation = useMutation({
    mutationFn: (ideaId: string) => ideasApi.toggleVote(ideaId, userEmail!),
    onMutate: async (ideaId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['ideas'] })

      // Snapshot previous value
      const previousIdeas = queryClient.getQueryData(['ideas', productFilter, statusFilter, priorityFilter, includeArchived, userEmail, organizationId, isWorkBacklogMode, itemType])

      // Optimistically update
      queryClient.setQueryData(
        ['ideas', productFilter, statusFilter, priorityFilter, includeArchived, userEmail, organizationId, isWorkBacklogMode, itemType],
        (old: Idea[] | undefined) => old?.map(idea => {
          if (idea.id === ideaId) {
            const newVoted = !idea.user_voted
            return {
              ...idea,
              user_voted: newVoted,
              vote_count: (idea.vote_count || 0) + (newVoted ? 1 : -1),
            }
          }
          return idea
        })
      )

      return { previousIdeas }
    },
    onError: (_err, _ideaId, context) => {
      // Rollback on error
      if (context?.previousIdeas) {
        queryClient.setQueryData(
          ['ideas', productFilter, statusFilter, priorityFilter, includeArchived, userEmail, organizationId, isWorkBacklogMode, itemType],
          context.previousIdeas
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
    },
  })

  // Stats
  const newCount = ideas.filter((i) => i.status === 'new').length
  const exploringCount = ideas.filter((i) => i.status === 'in_progress').length
  const implementedCount = ideas.filter((i) => i.status === 'done').length

  // Sort ideas
  const sortedIdeas = useMemo(() => {
    return [...ideas].sort((a, b) => {
      if (sortBy === 'loves') {
        const loveDiff = (b.vote_count || 0) - (a.vote_count || 0)
        if (loveDiff !== 0) return loveDiff
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else if (sortBy === 'priority') {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        // Same priority, sort by date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else {
        // Sort by date only (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [ideas, sortBy])

  // Group ideas by category
  const groupedIdeas = useMemo(() => {
    if (groupBy !== 'category') return null

    const groups: Record<string, Idea[]> = {}
    for (const idea of sortedIdeas) {
      const key = idea.category || 'Uncategorized'
      if (!groups[key]) groups[key] = []
      groups[key].push(idea)
    }

    // Sort groups alphabetically, with Uncategorized at the end
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })

    return sortedKeys.map(key => ({ category: key, ideas: groups[key] }))
  }, [sortedIdeas, groupBy])

  // Update URL when product filter changes
  const handleProductFilterChange = useCallback((product: string) => {
    if (product) {
      setSearchParams({ product })
    } else {
      setSearchParams({})
    }
  }, [setSearchParams])

  // Bulk selection handlers
  const toggleSelectMode = useCallback(() => {
    setSelectMode(!selectMode)
    setSelectedIds(new Set())
  }, [selectMode])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sortedIdeas.map(i => i.id)))
  }, [sortedIdeas])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: { status?: string; priority?: string; tags_to_add?: string[] } }) => {
      const res = await fetch(`${API_BASE}/ideas/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to bulk update ideas')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] })
      setSelectedIds(new Set())
    },
  })

  const handleBulkStatusChange = useCallback((status: string) => {
    bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status } })
  }, [selectedIds, bulkUpdateMutation])

  const handleBulkPriorityChange = useCallback((priority: string) => {
    bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { priority } })
  }, [selectedIds, bulkUpdateMutation])

  // Dynamic header based on mode
  const HeaderIcon = isDevBacklogMode ? Code : Lightbulb
  const headerIconColor = isDevBacklogMode ? 'text-blue-500' : 'text-yellow-500'

  const headerTitle = isWorkBacklogMode
    ? productFilter
      ? `Work Backlog - Expertly ${getProductDisplayName(productFilter)}`
      : 'Work Backlog'
    : isDevBacklogMode
      ? productFilter
        ? `Dev Backlog - Expertly ${getProductDisplayName(productFilter)}`
        : 'Dev Backlog'
      : productFilter
        ? `Idea Catalog - Expertly ${getProductDisplayName(productFilter)}`
        : 'Idea Catalog'

  const headerDescription = isWorkBacklogMode
    ? 'Track work items and tasks for your organization'
    : isDevBacklogMode
      ? 'Track development features and improvements'
      : 'Capture and nurture ideas across all Expertly products'

  const defaultItemType = isDevBacklogMode ? 'feature' : 'idea'

  // Render a list of idea cards (reused in flat and grouped views)
  const renderIdeaCards = (ideaList: Idea[]) => (
    ideaList.map((idea) => (
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
        onVote={userEmail ? () => voteMutation.mutate(idea.id) : undefined}
        selectMode={selectMode}
        isSelected={selectedIds.has(idea.id)}
        onToggleSelect={() => toggleSelect(idea.id)}
        userEmail={userEmail}
        onCommentCountChange={() => refetch()}
      />
    ))
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeaderIcon className={`h-8 w-8 ${headerIconColor}`} />
          <div>
            <h1 className="text-2xl font-bold text-theme-text-primary">{headerTitle}</h1>
            <p className="text-theme-text-secondary mt-1">
              {headerDescription}
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
            onClick={toggleSelectMode}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectMode
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                : 'text-theme-text-secondary hover:bg-theme-bg-elevated'
            }`}
          >
            {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectMode ? 'Exit Select' : 'Select'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isWorkBacklogMode ? 'New Item' : isDevBacklogMode ? 'New Feature' : 'New Idea'}
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
              <p className="text-sm text-theme-text-secondary">{isWorkBacklogMode ? 'New Items' : isDevBacklogMode ? 'New Features' : 'New Ideas'}</p>
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

      {/* Bulk Actions Toolbar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800 p-4">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {selectedIds.size} selected
          </span>
          <div className="h-4 w-px bg-primary-200 dark:bg-primary-700" />
          <button
            onClick={selectAll}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Select All
          </button>
          <button
            onClick={clearSelection}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Clear Selection
          </button>
          <div className="h-4 w-px bg-primary-200 dark:bg-primary-700" />
          <div>
            <select
              onChange={(e) => e.target.value && handleBulkStatusChange(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-600 rounded-lg text-sm text-theme-text-primary"
              defaultValue=""
            >
              <option value="" disabled>Change Status...</option>
              <option value="new">New</option>
              <option value="in_progress">Exploring</option>
              <option value="done">Implemented</option>
              <option value="archived">Archive</option>
            </select>
          </div>
          <div>
            <select
              onChange={(e) => e.target.value && handleBulkPriorityChange(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-primary-300 dark:border-primary-600 rounded-lg text-sm text-theme-text-primary"
              defaultValue=""
            >
              <option value="" disabled>Change Priority...</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

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
            {EXPERTLY_PRODUCTS.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
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

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="loves">Loves</option>
            <option value="priority">Priority</option>
            <option value="date">Date</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-theme-text-muted mb-1">Group By</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            className="px-3 py-1.5 bg-theme-bg-elevated border border-theme-border rounded-lg text-sm text-theme-text-primary"
          >
            <option value="none">None</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div className="flex items-center">
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
            className="px-3 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Ideas list */}
      {isLoading ? (
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-8 text-center text-theme-text-muted">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : sortedIdeas.length === 0 ? (
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-8 text-center text-theme-text-muted">
          <HeaderIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-lg font-medium text-theme-text-primary mb-1">
            {isWorkBacklogMode ? 'No work items yet' : isDevBacklogMode ? 'No features yet' : 'No ideas yet'}
          </p>
          <p className="text-sm">
            {isWorkBacklogMode
              ? productFilter
                ? `No work items for ${getProductDisplayName(productFilter)}.`
                : 'No work items found.'
              : isDevBacklogMode
                ? productFilter
                  ? `No features for ${getProductDisplayName(productFilter)} yet.`
                  : 'No features found. Add one to get started!'
                : productFilter
                  ? `No ideas for ${productFilter}. Got a spark of inspiration? Capture it!`
                  : "Got a spark of inspiration? Capture it here!"}
          </p>
        </div>
      ) : groupedIdeas ? (
        // Grouped view
        <div className="space-y-6">
          {groupedIdeas.map(({ category, ideas: groupIdeas }) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                  {category}
                </span>
                <span className="text-sm text-theme-text-muted">
                  ({groupIdeas.length})
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {renderIdeaCards(groupIdeas)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat view
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
          {renderIdeaCards(sortedIdeas)}
        </div>
      )}

      {/* Create/Edit modal */}
      {(showCreateModal || editingIdea) && (
        <CreateIdeaModal
          idea={editingIdea || undefined}
          defaultProduct={productFilter || undefined}
          organizationId={organizationId || undefined}
          defaultItemType={defaultItemType}
          onClose={() => {
            setShowCreateModal(false)
            setEditingIdea(null)
          }}
          onSave={(data) => {
            if (editingIdea) {
              updateMutation.mutate({ id: editingIdea.id, data })
            } else {
              // Include organization_id and created_by_email when creating
              const createData = {
                ...data,
                organization_id: organizationId || undefined,
                created_by_email: userEmail || undefined,
              } as IdeaCreate
              createMutation.mutate(createData)
            }
          }}
        />
      )}
    </div>
  )
}

export default IdeaBacklog
