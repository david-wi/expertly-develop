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
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  PlayCircle,
  PauseCircle,
  XCircle,
  Send,
  Eye,
  RotateCcw,
  Check,
} from 'lucide-react'
import { api, Task, Queue, Playbook, TaskAttachment, TaskComment, UpdateTaskRequest, TaskPhase } from '../services/api'
import RichTextEditor, { isRichTextEmpty } from './RichTextEditor'
import FileUploadZone from './FileUploadZone'
import ApproverSelector, { ApproverType } from './ApproverSelector'
import PlaybookStepExecutor from './PlaybookStepExecutor'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'

interface TaskDetailModalProps {
  taskId: string
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof Clock }> = {
  queued: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500', icon: Clock },
  blocked: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-l-orange-500', icon: PauseCircle },
  checked_out: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-l-purple-500', icon: PlayCircle },
  in_progress: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-l-yellow-500', icon: PlayCircle },
  completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-l-green-500', icon: CheckCircle },
  failed: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500', icon: XCircle },
}

const PHASE_CONFIG: Record<TaskPhase, { bg: string; text: string; label: string }> = {
  planning: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Planning' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ready' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Progress' },
  pending_review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pending Review' },
  in_review: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In Review' },
  changes_requested: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Changes Requested' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  waiting_on_subplaybook: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Waiting' },
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

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

const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
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

  // Scheduling state
  const [scheduledStartDate, setScheduledStartDate] = useState('')
  const [scheduledStartTime, setScheduledStartTime] = useState('')
  const [scheduledEndDate, setScheduledEndDate] = useState('')
  const [scheduledEndTime, setScheduledEndTime] = useState('')
  const [scheduleTimezone, setScheduleTimezone] = useState('')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Attachment state
  const [showAddAttachment, setShowAddAttachment] = useState(false)
  const [attachmentType, setAttachmentType] = useState<'file' | 'link'>('file')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)

  // Comment state
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  // Phase transition state
  const [transitioning, setTransitioning] = useState(false)

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

      // Initialize scheduling state
      if (taskData.scheduled_start) {
        const startDate = new Date(taskData.scheduled_start)
        setScheduledStartDate(startDate.toISOString().split('T')[0])
        setScheduledStartTime(startDate.toTimeString().slice(0, 5))
        setShowAdvancedSettings(true)
      } else {
        setScheduledStartDate('')
        setScheduledStartTime('')
      }
      if (taskData.scheduled_end) {
        const endDate = new Date(taskData.scheduled_end)
        setScheduledEndDate(endDate.toISOString().split('T')[0])
        setScheduledEndTime(endDate.toTimeString().slice(0, 5))
        setShowAdvancedSettings(true)
      } else {
        setScheduledEndDate('')
        setScheduledEndTime('')
      }
      setScheduleTimezone(taskData.schedule_timezone || '')

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

  // Build scheduled datetime strings
  const buildScheduledStart = () => {
    if (scheduledStartDate && scheduledStartTime) {
      return `${scheduledStartDate}T${scheduledStartTime}:00`
    }
    return null
  }

  const buildScheduledEnd = () => {
    if (scheduledEndDate && scheduledEndTime) {
      return `${scheduledEndDate}T${scheduledEndTime}:00`
    }
    return null
  }

  // Track changes
  useEffect(() => {
    if (!task) return

    const newScheduledStart = buildScheduledStart()
    const newScheduledEnd = buildScheduledEnd()
    const originalScheduledStart = task.scheduled_start ? new Date(task.scheduled_start).toISOString().slice(0, 19) : null
    const originalScheduledEnd = task.scheduled_end ? new Date(task.scheduled_end).toISOString().slice(0, 19) : null

    const changed =
      editedTitle !== task.title ||
      editedDescription !== (task.description || '') ||
      editedQueueId !== task.queue_id ||
      editedPriority !== task.priority ||
      editedPlaybookId !== (task.sop_id || null) ||
      editedApproverType !== (task.approver_type as ApproverType || null) ||
      editedApproverId !== (task.approver_id || null) ||
      newScheduledStart !== originalScheduledStart ||
      newScheduledEnd !== originalScheduledEnd ||
      scheduleTimezone !== (task.schedule_timezone || '')
    setHasChanges(changed)
  }, [task, editedTitle, editedDescription, editedQueueId, editedPriority, editedPlaybookId, editedApproverType, editedApproverId, scheduledStartDate, scheduledStartTime, scheduledEndDate, scheduledEndTime, scheduleTimezone])

  // Hook for unsaved changes warning
  const { confirmClose } = useUnsavedChanges(hasChanges)

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
        scheduled_start: buildScheduledStart(),
        scheduled_end: buildScheduledEnd(),
        schedule_timezone: scheduleTimezone || null,
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

  // Phase transition handlers
  const handlePhaseTransition = async (action: () => Promise<Task>) => {
    setTransitioning(true)
    try {
      await action()
      onUpdate?.()
      fetchData()
    } catch (err) {
      console.error('Failed to transition phase:', err)
      setError('Failed to change phase')
    } finally {
      setTransitioning(false)
    }
  }

  const handleMarkReady = () => handlePhaseTransition(() => api.markTaskReady(taskId))
  const handleSubmitForReview = () => handlePhaseTransition(() => api.submitForReview(taskId))
  const handleStartReview = () => handlePhaseTransition(() => api.startReview(taskId))
  const handleRequestChanges = () => handlePhaseTransition(() => api.requestChanges(taskId))
  const handleApprove = () => handlePhaseTransition(() => api.approveTask(taskId))
  const handleResumeWork = () => handlePhaseTransition(() => api.resumeWork(taskId))

  if (!isOpen) return null

  const statusConfig = task ? STATUS_CONFIG[task.status] || STATUS_CONFIG.queued : STATUS_CONFIG.queued
  const StatusIcon = statusConfig.icon
  const phaseConfig = task?.phase ? PHASE_CONFIG[task.phase] : PHASE_CONFIG.planning

  // Wrap onClose to check for unsaved changes
  const handleClose = confirmClose(onClose)

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-theme-bg-surface shadow-xl flex flex-col">
        {/* Header with status accent */}
        <div className={`px-4 py-3 border-b border-theme-border flex items-center justify-between border-l-4 ${statusConfig.border}`}>
          <div className="flex items-center gap-2">
            {task && (
              <>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${phaseConfig.bg} ${phaseConfig.text}`}>
                  {phaseConfig.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                  <StatusIcon className="w-3 h-3" />
                  {task.status.replace('_', ' ')}
                </span>
              </>
            )}
            <h2 className="text-base font-semibold text-theme-text-primary">Assignment Details</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-theme-bg-elevated transition-colors"
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
            <div className="p-4 text-red-600">{error}</div>
          ) : task ? (
            <div className="p-4 space-y-4">
              {/* Playbook Step Executor - shown when task has playbook and is being worked on */}
              {(() => {
                const activePlaybook = task.sop_id ? playbooks.find(p => p.id === task.sop_id) : null
                const isWorkingOnTask = task.status === 'checked_out' || task.status === 'in_progress'

                if (activePlaybook && isWorkingOnTask && activePlaybook.steps?.length > 0) {
                  return (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-theme-text-secondary">Playbook:</span>
                        <span className="text-sm font-medium text-theme-text-primary">{activePlaybook.name}</span>
                      </div>
                      <PlaybookStepExecutor
                        taskId={taskId}
                        playbook={activePlaybook}
                        onStepComplete={() => {
                          // Could show a notification or update UI
                        }}
                        onAllStepsComplete={() => {
                          // Refresh task data when all steps complete
                          fetchData()
                        }}
                      />
                    </div>
                  )
                }
                return null
              })()}

              {/* Title and Priority */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-theme-text-secondary mb-1">Title</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-3 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-theme-text-secondary mb-1">Priority</label>
                  <select
                    value={editedPriority}
                    onChange={(e) => setEditedPriority(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                      <option key={p} value={p}>
                        {p} {p === 1 ? '(High)' : p === 10 ? '(Low)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-theme-text-secondary mb-1">Description</label>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                  placeholder="Add a description..."
                />
              </div>

              {/* Playbook and Queue - 2 column */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-theme-text-secondary mb-1">Playbook</label>
                  <select
                    value={editedPlaybookId || ''}
                    onChange={(e) => setEditedPlaybookId(e.target.value || null)}
                    className="w-full px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="">None</option>
                    {playbooks.map((playbook) => (
                      <option key={playbook.id} value={playbook.id}>
                        {playbook.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-theme-text-secondary mb-1">Queue</label>
                  <select
                    value={editedQueueId}
                    onChange={(e) => setEditedQueueId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    {queues.map((queue) => (
                      <option key={queue.id || queue._id} value={queue.id || queue._id}>
                        {queue.purpose}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Approval Section - hidden if playbook defines approval */}
              {(() => {
                const selectedPlaybook = editedPlaybookId
                  ? playbooks.find(p => p.id === editedPlaybookId)
                  : null
                const playbookHasApproval = selectedPlaybook?.steps?.some(s => s.approval_required)

                if (playbookHasApproval) {
                  return null // Approval managed by playbook
                }

                return (
                  <div className="flex items-start gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap pt-0.5">
                      <input
                        type="checkbox"
                        checked={editedApproverType !== null}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditedApproverType('anyone')
                          } else {
                            setEditedApproverType(null)
                            setEditedApproverId(null)
                            setEditedApproverQueueId(null)
                          }
                        }}
                        className="rounded border-theme-border text-primary-600"
                      />
                      <span className="text-xs font-medium text-theme-text-secondary">Requires approval</span>
                    </label>
                    {editedApproverType !== null && (
                      <div className="flex-1">
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
                    )}
                  </div>
                )
              })()}

              {/* Advanced Settings - Collapsible */}
              <div className="border border-theme-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full px-3 py-2 flex items-center justify-between bg-theme-bg-elevated hover:bg-theme-bg-surface transition-colors"
                >
                  <span className="text-xs font-medium text-theme-text-secondary flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Advanced Settings
                    {(scheduledStartDate || scheduledEndDate) && (
                      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded text-[10px]">
                        Scheduled
                      </span>
                    )}
                  </span>
                  {showAdvancedSettings ? (
                    <ChevronDown className="w-4 h-4 text-theme-text-secondary" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-theme-text-secondary" />
                  )}
                </button>

                {showAdvancedSettings && (
                  <div className="p-3 space-y-3 border-t border-theme-border bg-theme-bg-surface">
                    {/* Scheduled Start */}
                    <div>
                      <label className="block text-xs font-medium text-theme-text-secondary mb-1">
                        Don't start before
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={scheduledStartDate}
                          onChange={(e) => setScheduledStartDate(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                        <input
                          type="time"
                          value={scheduledStartTime}
                          onChange={(e) => setScheduledStartTime(e.target.value)}
                          className="w-28 px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                    </div>

                    {/* Scheduled End */}
                    <div>
                      <label className="block text-xs font-medium text-theme-text-secondary mb-1">
                        Work window closes (optional)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={scheduledEndDate}
                          onChange={(e) => setScheduledEndDate(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                        <input
                          type="time"
                          value={scheduledEndTime}
                          onChange={(e) => setScheduledEndTime(e.target.value)}
                          className="w-28 px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        />
                      </div>
                    </div>

                    {/* Timezone */}
                    <div>
                      <label className="block text-xs font-medium text-theme-text-secondary mb-1">
                        Timezone
                      </label>
                      <select
                        value={scheduleTimezone}
                        onChange={(e) => setScheduleTimezone(e.target.value)}
                        className="w-full px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      >
                        <option value="">Browser default</option>
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Clear scheduling button */}
                    {(scheduledStartDate || scheduledEndDate) && (
                      <button
                        onClick={() => {
                          setScheduledStartDate('')
                          setScheduledStartTime('')
                          setScheduledEndDate('')
                          setScheduledEndTime('')
                          setScheduleTimezone('')
                        }}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Clear scheduling
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div className="border-t border-theme-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-theme-text-secondary flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachments ({attachments.length})
                  </label>
                  <button
                    onClick={() => setShowAddAttachment(!showAddAttachment)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {showAddAttachment ? 'Cancel' : 'Add'}
                  </button>
                </div>

                {showAddAttachment && (
                  <div className="mb-3 p-3 bg-theme-bg-elevated rounded-lg border border-theme-border">
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setAttachmentType('file')}
                        className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${attachmentType === 'file' ? 'bg-primary-100 text-primary-700' : 'bg-theme-bg-surface text-theme-text-secondary hover:bg-theme-bg-elevated'}`}
                      >
                        File
                      </button>
                      <button
                        onClick={() => setAttachmentType('link')}
                        className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${attachmentType === 'link' ? 'bg-primary-100 text-primary-700' : 'bg-theme-bg-surface text-theme-text-secondary hover:bg-theme-bg-elevated'}`}
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
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary text-sm"
                        />
                        <input
                          type="text"
                          value={linkTitle}
                          onChange={(e) => setLinkTitle(e.target.value)}
                          placeholder="Link title (optional)"
                          className="w-full px-3 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary text-sm"
                        />
                        <button
                          onClick={handleAddLink}
                          disabled={!linkUrl}
                          className="w-full py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
                        >
                          Add Link
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {attachments.map((attachment) => {
                      const FileIcon = getFileIcon(attachment.mime_type)
                      const isFile = attachment.attachment_type === 'file'

                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-2 p-2 bg-theme-bg-elevated rounded-lg"
                        >
                          {isFile ? (
                            <FileIcon className="w-4 h-4 text-theme-text-secondary flex-shrink-0" />
                          ) : (
                            <LinkIcon className="w-4 h-4 text-theme-text-secondary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-theme-text-primary truncate">
                              {isFile ? attachment.original_filename : attachment.link_title || attachment.url}
                            </p>
                            {isFile && attachment.size_bytes && (
                              <p className="text-[10px] text-theme-text-secondary">
                                {formatFileSize(attachment.size_bytes)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            {isFile ? (
                              <a
                                href={api.getAttachmentDownloadUrl(attachment.id)}
                                className="p-1 rounded hover:bg-theme-bg-surface transition-colors"
                                download
                              >
                                <Download className="w-3.5 h-3.5 text-theme-text-secondary" />
                              </a>
                            ) : (
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-theme-bg-surface transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-theme-text-secondary" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              className="p-1 rounded hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-theme-text-secondary">No attachments</p>
                )}
              </div>

              {/* Comments Section */}
              <div className="border-t border-theme-border pt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-theme-text-secondary" />
                  <label className="text-xs font-medium text-theme-text-secondary">
                    Comments ({comments.length})
                  </label>
                </div>

                {/* Add comment - compact compose area */}
                <div className="mb-3">
                  <RichTextEditor
                    value={newComment}
                    onChange={setNewComment}
                    placeholder="Add a comment..."
                    minHeight={36}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddComment}
                      disabled={isRichTextEmpty(newComment) || addingComment}
                      className="px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      {addingComment ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>

                {/* Comments list - scrollable */}
                {comments.length > 0 ? (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="relative pl-3 border-l-2 border-theme-border hover:border-primary-300 transition-colors"
                      >
                        <div className="p-2 bg-theme-bg-elevated rounded-r-lg">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                                <span className="text-[10px] font-medium text-white">
                                  {comment.user_name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-theme-text-primary">
                                {comment.user_name || 'Unknown'}
                              </span>
                              <span
                                className="text-[10px] text-theme-text-secondary cursor-help"
                                title={new Date(comment.created_at).toLocaleString()}
                              >
                                {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-0.5 rounded hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                          <div className="text-xs text-theme-text-primary whitespace-pre-wrap leading-relaxed">
                            {comment.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-theme-text-secondary text-center py-4">No comments yet. Start the conversation!</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-theme-border flex items-center justify-between bg-theme-bg-elevated">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
          >
            Delete
          </button>
          <div className="flex items-center gap-2">
            {/* Phase-aware action buttons */}
            {task?.phase === 'planning' && (
              <button
                onClick={handleMarkReady}
                disabled={transitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                {transitioning ? 'Updating...' : 'Ready for Assignment'}
              </button>
            )}
            {task?.phase === 'in_progress' && task.approval_required && (
              <button
                onClick={handleSubmitForReview}
                disabled={transitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-xs font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                {transitioning ? 'Updating...' : 'Submit for Review'}
              </button>
            )}
            {task?.phase === 'in_progress' && !task.approval_required && (
              <button
                onClick={handleApprove}
                disabled={transitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs font-medium"
              >
                <Check className="w-3.5 h-3.5" />
                {transitioning ? 'Updating...' : 'Complete'}
              </button>
            )}
            {task?.phase === 'pending_review' && (
              <button
                onClick={handleStartReview}
                disabled={transitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                {transitioning ? 'Updating...' : 'Start Review'}
              </button>
            )}
            {task?.phase === 'in_review' && (
              <>
                <button
                  onClick={handleRequestChanges}
                  disabled={transitioning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-xs font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {transitioning ? 'Updating...' : 'Request Changes'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={transitioning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs font-medium"
                >
                  <Check className="w-3.5 h-3.5" />
                  {transitioning ? 'Updating...' : 'Approve'}
                </button>
              </>
            )}
            {task?.phase === 'changes_requested' && (
              <button
                onClick={handleResumeWork}
                disabled={transitioning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-xs font-medium"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                {transitioning ? 'Updating...' : 'Resume Work'}
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-surface rounded-lg transition-colors text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-xs font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
