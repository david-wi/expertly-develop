import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Paperclip,
  Link as LinkIcon,
  MessageSquare,
  Download,
  Trash2,
  ExternalLink,
  Save,
  FileText,
  Image,
  Film,
  Music,
} from 'lucide-react'
import { api, Task, Queue, Playbook, TaskAttachment, TaskComment, UpdateTaskRequest } from '../services/api'
import MarkdownEditor from './MarkdownEditor'
import FileUploadZone from './FileUploadZone'
import ApproverSelector, { ApproverType } from './ApproverSelector'

interface TaskDetailModalProps {
  taskId: string
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-primary-100 text-primary-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return FileText
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.startsWith('audio/')) return Music
  return FileText
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TaskDetailModal({ taskId, isOpen, onClose, onUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [queues, setQueues] = useState<Queue[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editedTitle, setEditedTitle] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedQueueId, setEditedQueueId] = useState('')
  const [editedPriority, setEditedPriority] = useState(5)
  const [editedPlaybookId, setEditedPlaybookId] = useState<string | null>(null)
  const [editedApproverType, setEditedApproverType] = useState<ApproverType | null>(null)
  const [editedApproverId, setEditedApproverId] = useState<string | null>(null)
  const [editedApproverQueueId, setEditedApproverQueueId] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Attachment state
  const [showAddAttachment, setShowAddAttachment] = useState(false)
  const [attachmentType, setAttachmentType] = useState<'file' | 'link'>('file')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)

  // Comment state
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  const fetchData = useCallback(async () => {
    if (!taskId) return

    setLoading(true)
    setError(null)

    try {
      const [taskData, queuesData, playbooksData, attachmentsData, commentsData] = await Promise.all([
        api.getTask(taskId),
        api.getQueues(),
        api.getPlaybooks(),
        api.getTaskAttachments(taskId),
        api.getTaskComments(taskId),
      ])

      setTask(taskData)
      setQueues(queuesData)
      setPlaybooks(playbooksData)
      setAttachments(attachmentsData)
      setComments(commentsData)

      // Initialize edit state
      setEditedTitle(taskData.title)
      setEditedDescription(taskData.description || '')
      setEditedQueueId(taskData.queue_id)
      setEditedPriority(taskData.priority)
      setEditedPlaybookId(taskData.sop_id || null)
      setEditedApproverType(taskData.approver_type as ApproverType || null)
      setEditedApproverId(taskData.approver_id || null)
      setEditedApproverQueueId(taskData.approver_queue_id || null)
      setHasChanges(false)
    } catch (err) {
      console.error('Failed to fetch task details:', err)
      setError('Failed to load task details')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, fetchData])

  // Track changes
  useEffect(() => {
    if (!task) return
    const changed =
      editedTitle !== task.title ||
      editedDescription !== (task.description || '') ||
      editedQueueId !== task.queue_id ||
      editedPriority !== task.priority ||
      editedPlaybookId !== (task.sop_id || null) ||
      editedApproverType !== (task.approver_type as ApproverType || null) ||
      editedApproverId !== (task.approver_id || null)
    setHasChanges(changed)
  }, [task, editedTitle, editedDescription, editedQueueId, editedPriority, editedPlaybookId, editedApproverType, editedApproverId])

  const handleSave = async () => {
    if (!task || !hasChanges) return

    setSaving(true)
    try {
      const updateData: UpdateTaskRequest = {
        title: editedTitle,
        description: editedDescription || undefined,
        queue_id: editedQueueId,
        priority: editedPriority,
        sop_id: editedPlaybookId || undefined,
        approver_type: editedApproverType || undefined,
        approver_id: editedApproverId || undefined,
        approver_queue_id: editedApproverQueueId || undefined,
        approval_required: editedApproverType !== null,
      }
      await api.updateTask(taskId, updateData)
      setHasChanges(false)
      onUpdate?.()
      fetchData()
    } catch (err) {
      console.error('Failed to save task:', err)
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await api.deleteTask(taskId)
      onUpdate?.()
      onClose()
    } catch (err) {
      console.error('Failed to delete task:', err)
      setError('Failed to delete task')
    }
  }

  const handleUploadFile = async (file: File) => {
    setUploadingFile(true)
    try {
      const attachment = await api.uploadTaskAttachment(taskId, file)
      setAttachments((prev) => [attachment, ...prev])
      setShowAddAttachment(false)
    } catch (err) {
      console.error('Failed to upload file:', err)
      setError('Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleAddLink = async () => {
    if (!linkUrl) return

    try {
      const attachment = await api.addTaskLink(taskId, {
        url: linkUrl,
        link_title: linkTitle || undefined,
      })
      setAttachments((prev) => [attachment, ...prev])
      setLinkUrl('')
      setLinkTitle('')
      setShowAddAttachment(false)
    } catch (err) {
      console.error('Failed to add link:', err)
      setError('Failed to add link')
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return

    try {
      await api.deleteAttachment(attachmentId)
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    } catch (err) {
      console.error('Failed to delete attachment:', err)
      setError('Failed to delete attachment')
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setAddingComment(true)
    try {
      const comment = await api.createTaskComment(taskId, { content: newComment })
      setComments((prev) => [...prev, comment])
      setNewComment('')
    } catch (err) {
      console.error('Failed to add comment:', err)
      setError('Failed to add comment')
    } finally {
      setAddingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return

    try {
      await api.deleteTaskComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err)
      setError('Failed to delete comment')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-theme-bg-surface shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {task && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}`}>
                {task.status.replace('_', ' ')}
              </span>
            )}
            <h2 className="text-lg font-semibold text-theme-text-primary">Task Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-theme-bg-elevated transition-colors"
          >
            <X className="w-5 h-5 text-theme-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-theme-text-secondary">Loading...</div>
            </div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : task ? (
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">Title</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">Description</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Add a description..."
                />
              </div>

              {/* Queue & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-2">Queue</label>
                  <select
                    value={editedQueueId}
                    onChange={(e) => setEditedQueueId(e.target.value)}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {queues.map((queue) => (
                      <option key={queue.id || queue._id} value={queue.id || queue._id}>
                        {queue.purpose}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text-secondary mb-2">Priority</label>
                  <select
                    value={editedPriority}
                    onChange={(e) => setEditedPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                      <option key={p} value={p}>
                        {p} {p === 1 ? '(Highest)' : p === 10 ? '(Lowest)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Playbook */}
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">Playbook</label>
                <select
                  value={editedPlaybookId || ''}
                  onChange={(e) => setEditedPlaybookId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">No playbook</option>
                  {playbooks.map((playbook) => (
                    <option key={playbook.id} value={playbook.id}>
                      {playbook.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Approver */}
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">Approval</label>
                <ApproverSelector
                  approverType={editedApproverType}
                  approverId={editedApproverId}
                  approverQueueId={editedApproverQueueId}
                  onChange={(type, id, queueId) => {
                    setEditedApproverType(type)
                    setEditedApproverId(id)
                    setEditedApproverQueueId(queueId)
                  }}
                />
              </div>

              {/* Attachments Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-theme-text-secondary flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({attachments.length})
                  </label>
                  <button
                    onClick={() => setShowAddAttachment(!showAddAttachment)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    {showAddAttachment ? 'Cancel' : 'Add'}
                  </button>
                </div>

                {showAddAttachment && (
                  <div className="mb-4 p-4 bg-theme-bg-elevated rounded-lg border border-theme-border">
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => setAttachmentType('file')}
                        className={`flex-1 py-2 text-sm rounded-lg ${attachmentType === 'file' ? 'bg-primary-100 text-primary-700' : 'bg-theme-bg-surface text-theme-text-secondary'}`}
                      >
                        File
                      </button>
                      <button
                        onClick={() => setAttachmentType('link')}
                        className={`flex-1 py-2 text-sm rounded-lg ${attachmentType === 'link' ? 'bg-primary-100 text-primary-700' : 'bg-theme-bg-surface text-theme-text-secondary'}`}
                      >
                        Link
                      </button>
                    </div>

                    {attachmentType === 'file' ? (
                      <FileUploadZone
                        onFileSelect={handleUploadFile}
                        disabled={uploadingFile}
                      />
                    ) : (
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary"
                        />
                        <input
                          type="text"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          placeholder="Link title (optional)"
                          className="w-full px-3 py-2 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary"
                        />
                        <button
                          onClick={handleAddLink}
                          disabled={!linkUrl}
                          className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                          Add Link
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((attachment) => {
                      const FileIcon = getFileIcon(attachment.mime_type)
                      const isFile = attachment.attachment_type === 'file'

                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-3 p-3 bg-theme-bg-elevated rounded-lg"
                        >
                          {isFile ? (
                            <FileIcon className="w-5 h-5 text-theme-text-secondary flex-shrink-0" />
                          ) : (
                            <LinkIcon className="w-5 h-5 text-theme-text-secondary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-theme-text-primary truncate">
                              {isFile ? attachment.original_filename : attachment.link_title || attachment.url}
                            </p>
                            {isFile && attachment.size_bytes && (
                              <p className="text-xs text-theme-text-secondary">
                                {formatFileSize(attachment.size_bytes)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isFile ? (
                              <a
                                href={api.getAttachmentDownloadUrl(attachment.id)}
                                className="p-1.5 rounded hover:bg-theme-bg-surface transition-colors"
                                download
                              >
                                <Download className="w-4 h-4 text-theme-text-secondary" />
                              </a>
                            ) : (
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded hover:bg-theme-bg-surface transition-colors"
                              >
                                <ExternalLink className="w-4 h-4 text-theme-text-secondary" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              className="p-1.5 rounded hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-theme-text-secondary">No attachments yet</p>
                )}
              </div>

              {/* Comments Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-theme-text-secondary" />
                  <label className="text-sm font-medium text-theme-text-secondary">
                    Comments ({comments.length})
                  </label>
                </div>

                {/* Add comment */}
                <div className="mb-4">
                  <MarkdownEditor
                    value={newComment}
                    onChange={setNewComment}
                    placeholder="Add a comment..."
                    rows={3}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || addingComment}
                    className="mt-2 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {addingComment ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>

                {/* Comments list */}
                {comments.length > 0 ? (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-theme-bg-elevated rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-primary-700">
                                {comment.user_name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-theme-text-primary">
                              {comment.user_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-theme-text-secondary">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 rounded hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </div>
                        <div className="text-sm text-theme-text-primary whitespace-pre-wrap">
                          {comment.content}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-theme-text-secondary">No comments yet</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-theme-border flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            Delete Task
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
