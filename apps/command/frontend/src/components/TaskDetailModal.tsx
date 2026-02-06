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
  Timer,
  Wand2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { InlineVoiceTranscription } from '@expertly/ui'
import { api, Task, Queue, Playbook, TaskAttachment, TaskComment, TaskSuggestion, UpdateTaskRequest, TaskPhase, RecurrenceType } from '../services/api'
import RichTextEditor, { isRichTextEmpty } from './RichTextEditor'
import FileUploadZone from './FileUploadZone'
import ApproverSelector, { ApproverType } from './ApproverSelector'
import PlaybookStepExecutor from './PlaybookStepExecutor'
import PlaybookSelector from './PlaybookSelector'
import StartTimerModal from './StartTimerModal'
import TaskSuggestions from './TaskSuggestions'
import MessageReviewTab from './MessageReviewTab'
import ProjectTypeahead, { ProjectOption } from './ProjectTypeahead'
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

const COMMENT_TRUNCATE_LENGTH = 500

// Format seconds to H:MM display (e.g., 600 -> "0:10" for 10 minutes)
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

// Parse H:MM string to seconds (e.g., "0:10" -> 600 for 10 minutes)
function parseDuration(value: string): number | null {
  if (!value.trim()) return null
  const parts = value.split(':')
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10) || 0
    const minutes = parseInt(parts[1], 10) || 0
    return hours * 3600 + minutes * 60
  }
  // If just a number, treat as minutes
  const mins = parseInt(value, 10)
  if (!isNaN(mins)) return mins * 60
  return null
}

// Calculate total logged time from time entries
function getTotalLoggedTime(task: Task | null): number {
  if (!task?.time_entries?.length) return 0
  return task.time_entries.reduce((sum, entry) => sum + entry.duration_seconds, 0)
}

function CommentContent({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const shouldTruncate = content.length > COMMENT_TRUNCATE_LENGTH

  const displayContent = shouldTruncate && !expanded
    ? `${content.slice(0, COMMENT_TRUNCATE_LENGTH)}...`
    : content

  return (
    <div className="text-xs text-theme-text-primary leading-relaxed">
      <div className="prose prose-xs max-w-none text-theme-text-primary [&_a]:text-primary-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-theme-border [&_blockquote]:pl-3 [&_blockquote]:text-theme-text-secondary [&_p]:my-1 [&_strong]:text-theme-text-primary">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ),
          }}
        >{displayContent}</ReactMarkdown>
      </div>
      {shouldTruncate && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary-600 hover:text-primary-700 font-medium mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export default function TaskDetailModal({ taskId, isOpen, onClose, onUpdate }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [queues, setQueues] = useState<Queue[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editedTitle, setEditedTitle] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedQueueId, setEditedQueueId] = useState('')
  const [editedPriority, setEditedPriority] = useState(5)
  const [editedPlaybookId, setEditedPlaybookId] = useState<string | null>(null)
  const [editedProjectId, setEditedProjectId] = useState<string | null>(null)
  const [editedApproverType, setEditedApproverType] = useState<ApproverType | null>(null)
  const [editedApproverId, setEditedApproverId] = useState<string | null>(null)
  const [editedApproverQueueId, setEditedApproverQueueId] = useState<string | null>(null)
  const [editedDuration, setEditedDuration] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Scheduling state
  const [scheduledStartDate, setScheduledStartDate] = useState('')
  const [scheduledStartTime, setScheduledStartTime] = useState('')
  const [scheduledEndDate, setScheduledEndDate] = useState('')
  const [scheduledEndTime, setScheduledEndTime] = useState('')
  const [scheduleTimezone, setScheduleTimezone] = useState('')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([])
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState(1)
  const [showRepeatSettings, setShowRepeatSettings] = useState(false)

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

  // Timer modal state
  const [showTimerModal, setShowTimerModal] = useState(false)

  // Regenerate description state
  const [regeneratingDescription, setRegeneratingDescription] = useState(false)

  // Tab state for monitor-imported tasks
  const [activeTab, setActiveTab] = useState<'details' | 'message'>('details')

  const fetchData = useCallback(async () => {
    if (!taskId) return

    setLoading(true)
    setError(null)

    try {
      const [taskData, queuesData, playbooksData, projectsData, attachmentsData, commentsData, suggestionsData] = await Promise.all([
        api.getTask(taskId),
        api.getQueues(),
        api.getPlaybooks(),
        api.getProjects(),
        api.getTaskAttachments(taskId),
        api.getTaskComments(taskId),
        api.getTaskSuggestions(taskId),
      ])

      setTask(taskData)
      setQueues(queuesData)
      setPlaybooks(playbooksData)
      setProjects(projectsData.map((p: { _id?: string; id: string; name: string; parent_project_id?: string | null }) => ({
        id: p._id || p.id,
        name: p.name,
        parent_project_id: p.parent_project_id,
      })))
      setAttachments(attachmentsData)
      setComments(commentsData)
      setSuggestions(suggestionsData)

      // Initialize edit state
      setEditedTitle(taskData.title)
      setEditedDescription(taskData.description || '')
      setEditedQueueId(taskData.queue_id)
      setEditedPriority(taskData.priority)
      setEditedPlaybookId(taskData.sop_id || null)
      setEditedProjectId(taskData.project_id || null)
      setEditedApproverType(taskData.approver_type as ApproverType || null)
      setEditedApproverId(taskData.approver_id || null)
      setEditedApproverQueueId(taskData.approver_queue_id || null)
      setEditedDuration(formatDuration(taskData.estimated_duration))

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

      // Initialize recurrence state
      setIsRecurring(taskData.is_recurring || false)
      setRecurrenceType(taskData.recurrence_type || 'daily')
      setRecurrenceInterval(taskData.recurrence_interval || 1)
      setRecurrenceDaysOfWeek(taskData.recurrence_days_of_week || [])
      setRecurrenceDayOfMonth(taskData.recurrence_day_of_month || 1)
      if (taskData.is_recurring) {
        setShowRepeatSettings(true)
      }

      setHasChanges(false)

      // Auto-select message tab for monitor-imported tasks
      if (taskData.source_monitor_id) {
        setActiveTab('message')
      } else {
        setActiveTab('details')
      }
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

    const parsedDuration = parseDuration(editedDuration)
    const durationChanged = parsedDuration !== (task.estimated_duration || null)

    // Check recurrence changes
    const originalDaysOfWeek = task.recurrence_days_of_week || []
    const daysOfWeekChanged = JSON.stringify(recurrenceDaysOfWeek.sort()) !== JSON.stringify(originalDaysOfWeek.sort())

    const changed =
      editedTitle !== task.title ||
      editedDescription !== (task.description || '') ||
      editedQueueId !== task.queue_id ||
      editedPriority !== task.priority ||
      editedPlaybookId !== (task.sop_id || null) ||
      editedProjectId !== (task.project_id || null) ||
      editedApproverType !== (task.approver_type as ApproverType || null) ||
      editedApproverId !== (task.approver_id || null) ||
      newScheduledStart !== originalScheduledStart ||
      newScheduledEnd !== originalScheduledEnd ||
      scheduleTimezone !== (task.schedule_timezone || '') ||
      durationChanged ||
      isRecurring !== (task.is_recurring || false) ||
      recurrenceType !== (task.recurrence_type || 'daily') ||
      recurrenceInterval !== (task.recurrence_interval || 1) ||
      daysOfWeekChanged ||
      recurrenceDayOfMonth !== (task.recurrence_day_of_month || 1)
    setHasChanges(changed)
  }, [task, editedTitle, editedDescription, editedQueueId, editedPriority, editedPlaybookId, editedProjectId, editedApproverType, editedApproverId, scheduledStartDate, scheduledStartTime, scheduledEndDate, scheduledEndTime, scheduleTimezone, editedDuration, isRecurring, recurrenceType, recurrenceInterval, recurrenceDaysOfWeek, recurrenceDayOfMonth])

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
        project_id: editedProjectId || undefined,
        approver_type: editedApproverType || undefined,
        approver_id: editedApproverId || undefined,
        approver_queue_id: editedApproverQueueId || undefined,
        approval_required: editedApproverType !== null,
        scheduled_start: buildScheduledStart(),
        scheduled_end: buildScheduledEnd(),
        schedule_timezone: scheduleTimezone || null,
        estimated_duration: parseDuration(editedDuration),
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : undefined,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
        recurrence_days_of_week: isRecurring && recurrenceType === 'weekly' ? recurrenceDaysOfWeek : null,
        recurrence_day_of_month: isRecurring && recurrenceType === 'monthly' ? recurrenceDayOfMonth : null,
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

  const handleRegenerateDescription = async () => {
    setRegeneratingDescription(true)
    try {
      const result = await api.regenerateTaskDescription(taskId)
      setEditedDescription(result.description)
    } catch (err) {
      console.error('Failed to regenerate description:', err)
      setError('Failed to rewrite description')
    } finally {
      setRegeneratingDescription(false)
    }
  }

  if (!isOpen) return null

  const statusConfig = task ? STATUS_CONFIG[task.status] || STATUS_CONFIG.queued : STATUS_CONFIG.queued
  const StatusIcon = statusConfig.icon
  const phaseConfig = task?.phase ? PHASE_CONFIG[task.phase] : PHASE_CONFIG.planning

  // Wrap onClose to check for unsaved changes
  const handleClose = confirmClose(onClose)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        confirmClose(onClose)()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, confirmClose, onClose])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Slide-over panel */}
      <div className={`absolute inset-y-0 right-0 w-full bg-theme-bg-surface shadow-2xl flex flex-col transition-all duration-200 ${task?.source_monitor_id && activeTab === 'message' ? 'max-w-4xl' : 'max-w-2xl'}`}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-theme-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task && (
              <>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${phaseConfig.bg} ${phaseConfig.text}`}>
                  {phaseConfig.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                  <StatusIcon className="w-3 h-3" />
                  {task.status.replace('_', ' ')}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowTimerModal(true)}
              className="p-2 rounded-lg hover:bg-theme-bg-elevated transition-colors group"
              title="Start timeboxed work session"
            >
              <Timer className="w-4 h-4 text-theme-text-secondary/60 group-hover:text-primary-600 transition-colors" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-theme-bg-elevated transition-colors"
            >
              <X className="w-4 h-4 text-theme-text-secondary/60" />
            </button>
          </div>
        </div>

        {/* Tab bar - only for monitor-imported tasks */}
        {task?.source_monitor_id && (
          <div className="px-5 border-b border-theme-border/50 flex gap-0">
            <button
              onClick={() => setActiveTab('message')}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'message'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary hover:border-theme-border'
              }`}
            >
              Message Review
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary hover:border-theme-border'
              }`}
            >
              Details
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-theme-text-secondary">Loading...</div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-600">{error}</div>
          ) : task ? (
            activeTab === 'message' && task.source_monitor_id ? (
              <MessageReviewTab
                task={task}
                suggestions={suggestions}
                onUpdate={fetchData}
                onRegenerateDescription={handleRegenerateDescription}
                regenerating={regeneratingDescription}
              />
            ) : (
            <div className="p-5 space-y-5">
              {/* Playbook Step Executor - shown when task has playbook and is being worked on */}
              {(() => {
                const activePlaybook = task.sop_id ? playbooks.find(p => p.id === task.sop_id) : null
                const isWorkingOnTask = task.status === 'checked_out' || task.status === 'in_progress'

                if (activePlaybook && isWorkingOnTask && activePlaybook.steps?.length > 0) {
                  return (
                    <div className="mb-2">
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

              {/* Title - hero element */}
              <div className="flex gap-2 items-start">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 text-xl font-semibold px-1 py-1.5 bg-transparent text-theme-text-primary border-b-2 border-transparent focus:border-primary-500 focus:outline-none transition-colors placeholder:text-theme-text-secondary/40"
                  placeholder="Task title..."
                />
                <InlineVoiceTranscription
                  tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                  onTranscribe={(text) => setEditedTitle(editedTitle ? editedTitle + ' ' + text : text)}
                  size="sm"
                />
              </div>

              {/* Description - prominent content area */}
              <div className="flex gap-2 items-start">
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={5}
                  className="flex-1 px-3 py-2.5 bg-theme-bg-elevated/50 border border-theme-border/50 rounded-xl text-theme-text-primary text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-y placeholder:text-theme-text-secondary/40 transition-all"
                  placeholder="Describe this task..."
                />
                <div className="flex flex-col gap-1 self-start mt-2">
                  {task.source_monitor_id && (
                    <button
                      onClick={handleRegenerateDescription}
                      disabled={regeneratingDescription}
                      className="p-1.5 rounded-lg hover:bg-theme-bg-elevated transition-colors group"
                      title="Rewrite description with AI"
                    >
                      <Wand2 className={`w-4 h-4 text-theme-text-secondary/60 group-hover:text-primary-600 transition-colors ${regeneratingDescription ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <InlineVoiceTranscription
                    tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                    onTranscribe={(text) => setEditedDescription(editedDescription ? editedDescription + ' ' + text : text)}
                    size="sm"
                  />
                </div>
              </div>

              {/* Compact metadata strip */}
              <div className="flex items-center gap-3 flex-wrap py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-theme-text-secondary/70 uppercase tracking-wider font-medium">Priority</span>
                  <select
                    value={editedPriority}
                    onChange={(e) => setEditedPriority(Number(e.target.value))}
                    className="text-xs border-0 bg-theme-bg-elevated rounded-full px-2.5 py-1 text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer appearance-none font-medium"
                    style={{ backgroundImage: 'none', paddingRight: '0.625rem' }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                      <option key={p} value={p}>
                        {p} {p === 1 ? '(High)' : p === 10 ? '(Low)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-4 bg-theme-border/50" />
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-theme-text-secondary/70" />
                  <input
                    type="text"
                    value={editedDuration}
                    onChange={(e) => setEditedDuration(e.target.value)}
                    placeholder="0:00"
                    className="w-12 text-xs border-0 bg-theme-bg-elevated rounded-full px-2.5 py-1 text-theme-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/30 text-center"
                    title="Estimated duration (H:MM)"
                  />
                </div>
                {getTotalLoggedTime(task) > 0 && (
                  <>
                    <div className="w-px h-4 bg-theme-border/50" />
                    <div
                      className="flex items-center gap-1.5 cursor-default"
                      title={`Total time logged: ${task?.time_entries?.length || 0} entries`}
                    >
                      <span className="text-[11px] text-theme-text-secondary/70 uppercase tracking-wider font-medium">Logged</span>
                      <span className="text-xs font-mono bg-green-100 text-green-700 rounded-full px-2.5 py-1 font-medium">
                        {formatDuration(getTotalLoggedTime(task))}
                      </span>
                    </div>
                  </>
                )}
                <div className="w-px h-4 bg-theme-border/50" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-theme-text-secondary/70 uppercase tracking-wider font-medium">Queue</span>
                  <select
                    value={editedQueueId}
                    onChange={(e) => setEditedQueueId(e.target.value)}
                    className="text-xs border-0 bg-theme-bg-elevated rounded-full px-2.5 py-1 text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500/30 cursor-pointer font-medium"
                  >
                    {queues.map((queue) => (
                      <option key={queue.id || queue._id} value={queue.id || queue._id}>
                        {queue.purpose}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-4 bg-theme-border/50" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-theme-text-secondary/70 uppercase tracking-wider font-medium">Playbook</span>
                  <PlaybookSelector
                    playbooks={playbooks}
                    selectedPlaybookId={editedPlaybookId}
                    onSelect={(playbook) => setEditedPlaybookId(playbook?.id || null)}
                    placeholder="None"
                    className="text-xs"
                  />
                </div>
                <div className="w-px h-4 bg-theme-border/50" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-theme-text-secondary/70 uppercase tracking-wider font-medium">Project</span>
                  <ProjectTypeahead
                    projects={projects}
                    selectedProjectId={editedProjectId}
                    onChange={(projectId) => setEditedProjectId(projectId)}
                    placeholder="None"
                    className="text-xs"
                    onProjectCreated={(newProject) => {
                      setProjects((prev) => [...prev, newProject])
                      setEditedProjectId(newProject.id)
                    }}
                  />
                </div>
                {/* Approval - hidden if playbook defines approval */}
                {(() => {
                  const selectedPlaybook = editedPlaybookId
                    ? playbooks.find(p => p.id === editedPlaybookId)
                    : null
                  const playbookHasApproval = selectedPlaybook?.steps?.some(s => s.approval_required)

                  if (playbookHasApproval) return null

                  return (
                    <>
                      <div className="w-px h-4 bg-theme-border/50" />
                      <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
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
                        <span className="text-[11px] text-theme-text-secondary/70 uppercase tracking-wider font-medium">Approval</span>
                      </label>
                      {editedApproverType !== null && (
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
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Schedule & Repeat - Side by side */}
              <div className="grid grid-cols-2 gap-3">
              {/* Schedule Task - Collapsible */}
              <div className="border border-theme-border/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-theme-bg-elevated/50 transition-colors"
                >
                  <span className="text-xs font-medium text-theme-text-secondary/80 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Schedule
                    {(scheduledStartDate || scheduledEndDate) && (
                      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded-full text-[10px] font-medium">
                        Active
                      </span>
                    )}
                  </span>
                  {showAdvancedSettings ? (
                    <ChevronDown className="w-3.5 h-3.5 text-theme-text-secondary/50" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-theme-text-secondary/50" />
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

              {/* Repeat Settings - Collapsible */}
              <div className="border border-theme-border/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    if (!isRecurring) {
                      setIsRecurring(true)
                      setShowRepeatSettings(true)
                    } else {
                      setShowRepeatSettings(!showRepeatSettings)
                    }
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-theme-bg-elevated/50 transition-colors"
                >
                  <span className="text-xs font-medium text-theme-text-secondary/80 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (!e.target.checked) {
                          setIsRecurring(false)
                          setShowRepeatSettings(false)
                        } else {
                          setIsRecurring(true)
                          setShowRepeatSettings(true)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Repeat
                    {isRecurring && (
                      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded-full text-[10px] font-medium">
                        {recurrenceType === 'daily' ? 'Daily' : recurrenceType === 'weekly' ? 'Weekly' : 'Monthly'}
                      </span>
                    )}
                  </span>
                  {showRepeatSettings ? (
                    <ChevronDown className="w-3.5 h-3.5 text-theme-text-secondary/50" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-theme-text-secondary/50" />
                  )}
                </button>

                {showRepeatSettings && (
                  <div className="p-3 space-y-3 border-t border-theme-border bg-theme-bg-surface relative">
                    {isRecurring && (
                      <button
                        onClick={() => {
                          setIsRecurring(false)
                          setRecurrenceType('daily')
                          setRecurrenceInterval(1)
                          setRecurrenceDaysOfWeek([])
                          setRecurrenceDayOfMonth(1)
                          setShowRepeatSettings(false)
                        }}
                        className="absolute top-2 right-2 text-xs text-theme-text-secondary hover:text-red-600 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}

                    {isRecurring && (
                      <>
                        {/* Recurrence Type */}
                        <div>
                          <label className="block text-xs font-medium text-theme-text-secondary mb-1">
                            Repeat every
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={recurrenceInterval}
                              onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-16 px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                            <select
                              value={recurrenceType}
                              onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                              className="flex-1 px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            >
                              <option value="daily">{recurrenceInterval === 1 ? 'day' : 'days'}</option>
                              <option value="weekly">{recurrenceInterval === 1 ? 'week' : 'weeks'}</option>
                              <option value="monthly">{recurrenceInterval === 1 ? 'month' : 'months'}</option>
                            </select>
                          </div>
                        </div>

                        {/* Days of Week (for weekly) */}
                        {recurrenceType === 'weekly' && (
                          <div>
                            <label className="block text-xs font-medium text-theme-text-secondary mb-2">
                              On these days
                            </label>
                            <div className="flex gap-1 flex-wrap">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    setRecurrenceDaysOfWeek(prev =>
                                      prev.includes(index)
                                        ? prev.filter(d => d !== index)
                                        : [...prev, index]
                                    )
                                  }}
                                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                    recurrenceDaysOfWeek.includes(index)
                                      ? 'bg-primary-600 text-white'
                                      : 'bg-theme-bg-elevated text-theme-text-secondary hover:bg-theme-bg-surface'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Day of Month (for monthly) */}
                        {recurrenceType === 'monthly' && (
                          <div>
                            <label className="block text-xs font-medium text-theme-text-secondary mb-1">
                              On day
                            </label>
                            <select
                              value={recurrenceDayOfMonth}
                              onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value))}
                              className="w-full px-2 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            >
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                <option key={day} value={day}>
                                  {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Summary */}
                        <div className="text-xs text-theme-text-secondary bg-theme-bg-elevated p-2 rounded">
                          {recurrenceType === 'daily' && (
                            <>Repeats every {recurrenceInterval === 1 ? 'day' : `${recurrenceInterval} days`}</>
                          )}
                          {recurrenceType === 'weekly' && (
                            <>
                              Repeats every {recurrenceInterval === 1 ? 'week' : `${recurrenceInterval} weeks`}
                              {recurrenceDaysOfWeek.length > 0 && (
                                <> on {recurrenceDaysOfWeek.sort().map(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ')}</>
                              )}
                            </>
                          )}
                          {recurrenceType === 'monthly' && (
                            <>Repeats every {recurrenceInterval === 1 ? 'month' : `${recurrenceInterval} months`} on day {recurrenceDayOfMonth}</>
                          )}
                        </div>
                      </>
                    )}

                  </div>
                )}
              </div>
              </div>

              {/* Attachments & Source Section */}
              <div className="border-t border-theme-border/30 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-theme-text-secondary/80 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      Attachments {attachments.length > 0 && <span className="text-[10px] bg-theme-bg-elevated rounded-full px-1.5 py-0.5">{attachments.length}</span>}
                    </label>
                    {task?.source_url && (
                      <>
                        <div className="w-px h-4 bg-theme-border/50" />
                        <a
                          href={task.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Source
                        </a>
                      </>
                    )}
                  </div>
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

              {/* AI Suggestions */}
              <TaskSuggestions suggestions={suggestions} onUpdate={fetchData} />

              {/* Timeline and Discussion Section */}
              <div className="border-t border-theme-border/30 pt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <MessageSquare className="w-3.5 h-3.5 text-theme-text-secondary/80" />
                  <label className="text-xs font-medium text-theme-text-secondary/80">
                    Discussion {comments.length > 0 && <span className="text-[10px] bg-theme-bg-elevated rounded-full px-1.5 py-0.5 ml-1">{comments.length}</span>}
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
                          <CommentContent content={comment.content} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-theme-text-secondary text-center py-4">No comments yet. Start the conversation!</p>
                )}
              </div>
            </div>
            )
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-theme-border/50 flex items-center justify-between bg-theme-bg-surface">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-red-500/70 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs font-medium"
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

      {/* Timer Modal */}
      <StartTimerModal
        isOpen={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        context={{
          type: 'task',
          taskId: taskId,
          taskTitle: task?.title || 'Task',
        }}
        defaultDuration={task?.estimated_duration}
      />
    </div>
  )
}
