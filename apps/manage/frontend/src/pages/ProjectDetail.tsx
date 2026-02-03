import { useEffect, useState, useMemo, useRef, DragEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import {
  api,
  Project,
  Task,
  RecurringTask,
  Queue,
  RecurrenceType,
  ProjectStatus,
  ProjectResource,
  ProjectCustomField,
  ProjectComment,
} from '../services/api'
import TaskDetailModal from '../components/TaskDetailModal'
import CreateAssignmentModal from '../components/CreateAssignmentModal'
import Breadcrumbs, { buildProjectBreadcrumbs } from '../components/Breadcrumbs'
import ProjectTypeahead from '../components/ProjectTypeahead'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-800',
  blocked: 'bg-orange-100 text-orange-800',
  checked_out: 'bg-primary-100 text-primary-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function getProjectStatusBadgeColor(status: ProjectStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'on_hold':
      return 'bg-yellow-100 text-yellow-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatProjectStatus(status: ProjectStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'on_hold':
      return 'On Hold'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

type TabType = 'tasks' | 'completed' | 'recurring'

const DEFAULT_CUSTOM_FIELDS: ProjectCustomField[] = [
  { label: 'URL', value: '' },
  { label: 'Contact Name', value: '' },
  { label: 'Contact Email', value: '' },
]

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()

  // Data states
  const [project, setProject] = useState<Project | null>(null)
  const [subprojects, setSubprojects] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [queues, setQueues] = useState<Queue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab state for assignments
  const [activeTab, setActiveTab] = useState<TabType>('tasks')

  // Modal states
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [showEditRecurringModal, setShowEditRecurringModal] = useState(false)
  const [showDeleteRecurringConfirm, setShowDeleteRecurringConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedRecurringTask, setSelectedRecurringTask] = useState<RecurringTask | null>(null)

  // Local states for inline editing
  const [localResources, setLocalResources] = useState<ProjectResource[]>([])
  const [localFields, setLocalFields] = useState<ProjectCustomField[]>([])
  const [localNextSteps, setLocalNextSteps] = useState('')
  const [localComments, setLocalComments] = useState<ProjectComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Inline add states
  const [newResourceTitle, setNewResourceTitle] = useState('')
  const [newResourceUrl, setNewResourceUrl] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recurring task edit form state
  const [recurringForm, setRecurringForm] = useState<{
    title: string
    description: string
    queue_id: string
    priority: number
    recurrence_type: RecurrenceType
    interval: number
    days_of_week: number[]
    day_of_month: number
  }>({
    title: '',
    description: '',
    queue_id: '',
    priority: 5,
    recurrence_type: 'daily',
    interval: 1,
    days_of_week: [],
    day_of_month: 1,
  })

  // Project edit form
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
    parent_project_id: null as string | null,
  })

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    if (!id) return

    setLoading(true)
    setError(null)
    try {
      const [
        projectData,
        subprojectsData,
        allProjectsData,
        tasksData,
        completedTasksData,
        recurringTasksData,
        queuesData,
      ] = await Promise.all([
        api.getProject(id),
        api.getProjectChildren(id),
        api.getProjects(),
        api.getProjectTasks(id, { status: undefined, include_subtasks: true }),
        api.getProjectTasks(id, { status: 'completed', include_subtasks: true }),
        api.getProjectRecurringTasks(id),
        api.getQueues(),
      ])

      setProject(projectData)
      setSubprojects(subprojectsData)
      setAllProjects(allProjectsData)
      setTasks(tasksData.filter((t) => t.status !== 'completed'))
      setCompletedTasks(completedTasksData)
      setRecurringTasks(recurringTasksData)
      setQueues(queuesData)

      setProjectForm({
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status,
        parent_project_id: projectData.parent_project_id || null,
      })

      setLocalResources(projectData.resources || [])
      const existingFields = projectData.custom_fields || []
      setLocalFields(existingFields.length === 0 ? DEFAULT_CUSTOM_FIELDS : existingFields)
      setLocalNextSteps(projectData.next_steps || '')
      setLocalComments(projectData.comments || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const _getQueueName = (queueId: string): string => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || 'Unknown Queue'
  }
  void _getQueueName // Silences unused warning - available for future use

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project || !id) return

    setSaving(true)
    try {
      await api.updateProject(id, {
        name: projectForm.name.trim(),
        description: projectForm.description.trim() || undefined,
        status: projectForm.status,
        parent_project_id: projectForm.parent_project_id || undefined,
      })
      await loadData()
      setShowEditProjectModal(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  // Auto-save helpers
  const saveResources = async (resources: ProjectResource[]) => {
    if (!id) return
    try {
      await api.updateProject(id, { resources })
    } catch (err) {
      console.error('Failed to save resources:', err)
    }
  }

  const saveFields = async (fields: ProjectCustomField[]) => {
    if (!id) return
    try {
      await api.updateProject(id, { custom_fields: fields })
    } catch (err) {
      console.error('Failed to save fields:', err)
    }
  }

  const saveNextSteps = async (nextSteps: string) => {
    if (!id) return
    try {
      await api.updateProject(id, { next_steps: nextSteps })
    } catch (err) {
      console.error('Failed to save next steps:', err)
    }
  }

  const saveComments = async (comments: ProjectComment[]) => {
    if (!id) return
    try {
      await api.updateProject(id, { comments })
    } catch (err) {
      console.error('Failed to save comments:', err)
    }
  }

  // Resource handlers
  const handleAddResource = () => {
    if (!newResourceTitle.trim() || !newResourceUrl.trim()) return
    const updated = [
      ...localResources,
      { title: newResourceTitle.trim(), url: newResourceUrl.trim(), type: 'link' as const },
    ]
    setLocalResources(updated)
    setNewResourceTitle('')
    setNewResourceUrl('')
    saveResources(updated)
  }

  const handleRemoveResource = (index: number) => {
    const updated = localResources.filter((_, i) => i !== index)
    setLocalResources(updated)
    saveResources(updated)
  }

  // File drag & drop
  const handleFileDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(true)
  }

  const handleFileDragLeave = () => {
    setIsDraggingFile(false)
  }

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files)
    handleFileUpload(files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(Array.from(e.target.files))
    }
  }

  const handleFileUpload = (files: File[]) => {
    // For now, add as file entries (in production, would upload to storage)
    const newResources: ProjectResource[] = files.map((file) => ({
      title: file.name,
      url: `file://${file.name}`,
      type: 'file' as const,
    }))
    const updated = [...localResources, ...newResources]
    setLocalResources(updated)
    saveResources(updated)
  }

  // Field handlers
  const handleAddField = () => {
    if (!newFieldLabel.trim()) return
    const updated = [...localFields, { label: newFieldLabel.trim(), value: '' }]
    setLocalFields(updated)
    setNewFieldLabel('')
    saveFields(updated)
  }

  const handleRemoveField = (index: number) => {
    const updated = localFields.filter((_, i) => i !== index)
    setLocalFields(updated)
    saveFields(updated)
  }

  const handleUpdateFieldValue = (index: number, value: string) => {
    const updated = [...localFields]
    updated[index] = { ...updated[index], value }
    setLocalFields(updated)
  }

  const handleFieldBlur = () => {
    saveFields(localFields)
  }

  // Next steps handlers
  const handleNextStepsBlur = () => {
    saveNextSteps(localNextSteps)
  }

  // Comment handlers
  const handleAddComment = () => {
    if (!newComment.trim()) return
    const comment: ProjectComment = {
      id: crypto.randomUUID(),
      content: newComment.trim(),
      author_id: 'current-user', // Would come from auth context
      author_name: 'David', // Would come from auth context
      created_at: new Date().toISOString(),
    }
    const updated = [comment, ...localComments] // Newest first
    setLocalComments(updated)
    setNewComment('')
    saveComments(updated)
  }

  const handleDeleteComment = (commentId: string) => {
    const updated = localComments.filter((c) => c.id !== commentId)
    setLocalComments(updated)
    saveComments(updated)
  }

  // Copy text to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleRecurringDayOfWeek = (day: number) => {
    const days = recurringForm.days_of_week || []
    if (days.includes(day)) {
      setRecurringForm({ ...recurringForm, days_of_week: days.filter((d) => d !== day) })
    } else {
      setRecurringForm({ ...recurringForm, days_of_week: [...days, day].sort() })
    }
  }

  const handleTriggerRecurring = async (task: RecurringTask) => {
    const taskId = task._id || task.id
    try {
      await api.triggerRecurringTask(taskId)
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger recurring assignment'
      alert(message)
    }
  }

  const handleToggleRecurringActive = async (task: RecurringTask) => {
    const taskId = task._id || task.id
    try {
      await api.updateRecurringTask(taskId, { is_active: !task.is_active })
      await loadData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update recurring assignment'
      alert(message)
    }
  }

  const openEditRecurringModal = (task: RecurringTask) => {
    setSelectedRecurringTask(task)
    setRecurringForm({
      title: task.title,
      description: task.description || '',
      queue_id: task.queue_id,
      priority: task.priority,
      recurrence_type: task.recurrence_type,
      interval: task.interval,
      days_of_week: task.days_of_week || [],
      day_of_month: task.day_of_month || 1,
    })
    setShowEditRecurringModal(true)
  }

  const handleEditRecurring = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRecurringTask) return

    const taskId = selectedRecurringTask._id || selectedRecurringTask.id
    setSaving(true)
    try {
      await api.updateRecurringTask(taskId, {
        title: recurringForm.title.trim(),
        description: recurringForm.description.trim() || undefined,
        queue_id: recurringForm.queue_id,
        priority: recurringForm.priority,
        recurrence_type: recurringForm.recurrence_type,
        interval: recurringForm.interval,
        days_of_week:
          recurringForm.recurrence_type === 'weekly' ? recurringForm.days_of_week : undefined,
        day_of_month:
          recurringForm.recurrence_type === 'monthly' ? recurringForm.day_of_month : undefined,
      })
      await loadData()
      setShowEditRecurringModal(false)
      setSelectedRecurringTask(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update recurring assignment'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRecurring = async () => {
    if (!selectedRecurringTask) return

    const taskId = selectedRecurringTask._id || selectedRecurringTask.id
    setSaving(true)
    try {
      await api.deleteRecurringTask(taskId)
      await loadData()
      setShowDeleteRecurringConfirm(false)
      setSelectedRecurringTask(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete recurring assignment'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const formatRecurrence = (task: RecurringTask): string => {
    const interval = task.interval > 1 ? `every ${task.interval} ` : ''
    switch (task.recurrence_type) {
      case 'daily':
        return `${interval}day${task.interval > 1 ? 's' : ''}`
      case 'weekly':
        const days = task.days_of_week?.map((d) => DAYS_OF_WEEK[d]).join(', ')
        return `${interval}week${task.interval > 1 ? 's' : ''}${days ? ` on ${days}` : ''}`
      case 'monthly':
        return `${interval}month${task.interval > 1 ? 's' : ''} on day ${task.day_of_month}`
      case 'custom':
        return task.cron_expression || 'custom'
      default:
        return task.recurrence_type
    }
  }

  const activeTasks = tasks.filter((t) => t.status !== 'completed')

  const breadcrumbItems = useMemo(() => {
    if (!project) return []
    const projectForBreadcrumb = { ...project, id: project._id || project.id }
    const allProjectsForBreadcrumb = allProjects.map((p) => ({ ...p, id: p._id || p.id }))
    return buildProjectBreadcrumbs(projectForBreadcrumb, allProjectsForBreadcrumb)
  }, [project, allProjects])

  const typeaheadProjects = useMemo(() => {
    return allProjects.map((p) => ({
      id: p._id || p.id,
      name: p.name,
      parent_project_id: p.parent_project_id,
    }))
  }, [allProjects])

  const currentProjectId = project ? project._id || project.id : undefined

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-gray-500">Loading project...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Project not found'}</p>
          <Link to="/projects" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {breadcrumbItems.length > 0 && <Breadcrumbs items={breadcrumbItems} className="mb-2" />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">{project.name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProjectStatusBadgeColor(project.status)}`}
            >
              {formatProjectStatus(project.status)}
            </span>
          </div>
          {project.description && (
            <p className="text-gray-500 mt-1 ml-8">{project.description}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowEditProjectModal(true)}
            className="text-gray-600 hover:text-gray-800 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            Add Assignment
          </button>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex gap-6">
        {/* Left Column - Subprojects + Assignments */}
        <div className="w-1/2 space-y-3">
          {/* Subprojects */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Subprojects</h3>
              <Link
                to={`/projects?parent=${id}`}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                + Add
              </Link>
            </div>
            {subprojects.length > 0 ? (
              <ul className="space-y-0.5">
                {subprojects.map((sub) => (
                  <li
                    key={sub._id || sub.id}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 rounded transition-colors"
                  >
                    <Link
                      to={`/projects/${sub._id || sub.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 truncate flex-1"
                    >
                      {sub.name}
                    </Link>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${getProjectStatusBadgeColor(sub.status)}`}
                    >
                      {formatProjectStatus(sub.status)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 px-2">No subprojects</p>
            )}
          </div>

          {/* Assignments */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Assignments</h3>
              <span className="text-[10px] text-gray-400">{activeTasks.length} active</span>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 mb-2 border-b border-gray-100 pb-2">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  activeTab === 'tasks'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active ({activeTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  activeTab === 'completed'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Done ({completedTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('recurring')}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  activeTab === 'recurring'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Recurring ({recurringTasks.length})
              </button>
            </div>

            {activeTab === 'tasks' && (
              <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                {activeTasks.map((task) => (
                  <li
                    key={task._id || task.id}
                    onClick={() => setSelectedTaskId(task._id || task.id)}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  >
                    <span className="text-xs text-gray-900 truncate flex-1">{task.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
                {activeTasks.length === 0 && (
                  <p className="text-xs text-gray-400 px-2">No active assignments</p>
                )}
              </ul>
            )}

            {activeTab === 'completed' && (
              <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                {completedTasks.map((task) => (
                  <li
                    key={task._id || task.id}
                    onClick={() => setSelectedTaskId(task._id || task.id)}
                    className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer transition-colors"
                  >
                    <span className="text-xs text-gray-500 truncate flex-1 line-through">
                      {task.title}
                    </span>
                  </li>
                ))}
                {completedTasks.length === 0 && (
                  <p className="text-xs text-gray-400 px-2">No completed assignments</p>
                )}
              </ul>
            )}

            {activeTab === 'recurring' && (
              <ul className="space-y-0.5 max-h-64 overflow-y-auto">
                {recurringTasks.map((task) => (
                  <li
                    key={task._id || task.id}
                    className={`flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 rounded transition-colors group ${!task.is_active ? 'opacity-50' : ''}`}
                  >
                    <span
                      onClick={() => openEditRecurringModal(task)}
                      className="text-xs text-gray-900 truncate flex-1 cursor-pointer"
                    >
                      {task.title}
                    </span>
                    <span className="text-[10px] text-gray-400 group-hover:hidden">
                      {formatRecurrence(task)}
                    </span>
                    <div className="hidden group-hover:flex gap-1">
                      <button
                        onClick={() => handleTriggerRecurring(task)}
                        className="text-[10px] text-green-600 hover:text-green-800"
                        title="Run now"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleToggleRecurringActive(task)}
                        className={`text-[10px] ${task.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {task.is_active ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                  </li>
                ))}
                {recurringTasks.length === 0 && (
                  <p className="text-xs text-gray-400 px-2">No recurring assignments</p>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column - Project Details (half width) */}
        <div className="w-1/2 space-y-3">
          {/* Next Steps */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Next Steps</h3>
              {localNextSteps && (
                <button
                  onClick={() => handleCopy(localNextSteps)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  Copy
                </button>
              )}
            </div>
            <textarea
              value={localNextSteps}
              onChange={(e) => setLocalNextSteps(e.target.value)}
              onBlur={handleNextStepsBlur}
              placeholder="Write next steps..."
              className="w-full text-xs text-gray-700 border-0 bg-transparent px-0 py-1 outline-none resize-none min-h-[60px] placeholder-gray-300"
            />
          </div>

          {/* Resources */}
          <div
            className={`bg-white shadow rounded-lg p-3 transition-colors ${
              isDraggingFile ? 'ring-2 ring-blue-400 bg-blue-50' : ''
            }`}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Resources</h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 hover:text-blue-800 text-xs"
              >
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            {localResources.length > 0 && (
              <ul className="space-y-1 mb-2">
                {localResources.map((res, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs group">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 truncate flex-1"
                    >
                      {res.title}
                    </a>
                    <button
                      onClick={() => handleRemoveResource(idx)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Title..."
                value={newResourceTitle}
                onChange={(e) => setNewResourceTitle(e.target.value)}
                className="flex-1 text-xs border-0 border-b border-transparent focus:border-gray-300 bg-transparent px-0 py-1 outline-none placeholder-gray-300"
              />
              <input
                type="url"
                placeholder="URL..."
                value={newResourceUrl}
                onChange={(e) => setNewResourceUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddResource()}
                className="flex-1 text-xs border-0 border-b border-transparent focus:border-gray-300 bg-transparent px-0 py-1 outline-none placeholder-gray-300"
              />
            </div>
            {isDraggingFile && (
              <p className="text-xs text-blue-500 mt-2 text-center">Drop files here</p>
            )}
          </div>

          {/* Fields & Values */}
          <div className="bg-white shadow rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Fields & Values</h3>

            <div className="space-y-1">
              {localFields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">{field.label}:</span>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => handleUpdateFieldValue(idx, e.target.value)}
                    onBlur={handleFieldBlur}
                    placeholder="—"
                    className="flex-1 text-xs text-gray-900 border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-300 bg-transparent px-0 py-1 outline-none"
                  />
                  <button
                    onClick={() => handleRemoveField(idx)}
                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-2 pt-2 border-t border-gray-100">
              <input
                type="text"
                placeholder="Add field..."
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                className="w-full text-xs text-gray-500 border-0 bg-transparent px-0 py-1 outline-none placeholder-gray-300"
              />
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">AI Suggestions</h3>
              {project.ai_suggestions && (
                <button
                  onClick={() => handleCopy(project.ai_suggestions || '')}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  Copy
                </button>
              )}
            </div>
            {project.ai_suggestions ? (
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{project.ai_suggestions}</p>
            ) : (
              <p className="text-xs text-gray-300 italic">No AI suggestions available</p>
            )}
          </div>
        </div>
      </div>

      {/* Discussion - Full Width */}
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Discussion</h3>

        {/* Add comment */}
        <div className="flex gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium">D</span>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-300 resize-none min-h-[80px] placeholder-gray-400"
            />
            {newComment.trim() && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddComment}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Post Comment
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comments list (newest first) */}
        {localComments.length > 0 ? (
          <div className="space-y-4 divide-y divide-gray-100">
            {localComments.map((comment) => (
              <div key={comment.id} className="group pt-4 first:pt-0">
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">
                      {comment.author_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{comment.author_name}</span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                    <div
                      className="text-sm text-gray-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: comment.content }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No comments yet. Start the discussion!</p>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => loadData()}
        />
      )}

      {/* Create Assignment Modal */}
      <CreateAssignmentModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onCreated={() => loadData()}
        projectId={id}
      />

      {/* Edit Project Modal */}
      <Modal
        isOpen={showEditProjectModal}
        onClose={() => setShowEditProjectModal(false)}
        title="Edit Project"
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={projectForm.description}
              onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={projectForm.status}
              onChange={(e) =>
                setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Project</label>
            <ProjectTypeahead
              projects={typeaheadProjects}
              selectedProjectId={projectForm.parent_project_id}
              onChange={(parentId) =>
                setProjectForm({ ...projectForm, parent_project_id: parentId })
              }
              excludeIds={currentProjectId ? [currentProjectId] : []}
              placeholder="Search for parent project..."
            />
          </div>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowEditProjectModal(false)}
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

      {/* Edit Recurring Assignment Modal */}
      <Modal
        isOpen={showEditRecurringModal && !!selectedRecurringTask}
        onClose={() => setShowEditRecurringModal(false)}
        title="Edit Recurring Assignment"
      >
        <form onSubmit={handleEditRecurring} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Queue</label>
            <select
              value={recurringForm.queue_id}
              onChange={(e) => setRecurringForm({ ...recurringForm, queue_id: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              {queues.map((queue) => (
                <option key={queue._id || queue.id} value={queue._id || queue.id}>
                  {queue.purpose}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={recurringForm.title}
              onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={recurringForm.description}
              onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              value={recurringForm.priority}
              onChange={(e) =>
                setRecurringForm({ ...recurringForm, priority: parseInt(e.target.value) || 5 })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min={1}
              max={10}
            />
            <p className="text-xs text-gray-500 mt-1">1 = highest, 10 = lowest</p>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Schedule</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recurrence Type
                </label>
                <select
                  value={recurringForm.recurrence_type}
                  onChange={(e) =>
                    setRecurringForm({
                      ...recurringForm,
                      recurrence_type: e.target.value as RecurrenceType,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={recurringForm.interval}
                    onChange={(e) =>
                      setRecurringForm({
                        ...recurringForm,
                        interval: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 border border-gray-300 rounded-md px-3 py-2"
                    min={1}
                  />
                  <span className="text-gray-700">
                    {recurringForm.recurrence_type === 'daily'
                      ? 'day(s)'
                      : recurringForm.recurrence_type === 'weekly'
                        ? 'week(s)'
                        : 'month(s)'}
                  </span>
                </div>
              </div>
              {recurringForm.recurrence_type === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">On days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleRecurringDayOfWeek(index)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          recurringForm.days_of_week?.includes(index)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {recurringForm.recurrence_type === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On day of month
                  </label>
                  <input
                    type="number"
                    value={recurringForm.day_of_month}
                    onChange={(e) =>
                      setRecurringForm({
                        ...recurringForm,
                        day_of_month: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 border border-gray-300 rounded-md px-3 py-2"
                    min={1}
                    max={31}
                  />
                </div>
              )}
            </div>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowEditRecurringModal(false)}
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

      {/* Delete Recurring Assignment Confirmation */}
      <Modal
        isOpen={showDeleteRecurringConfirm && !!selectedRecurringTask}
        onClose={() => setShowDeleteRecurringConfirm(false)}
        title="Delete Recurring Assignment?"
        size="sm"
      >
        <p className="text-gray-500 mb-4">
          Are you sure you want to delete "{selectedRecurringTask?.title}"? This will not delete
          already-created assignments.
        </p>
        <ModalFooter>
          <button
            onClick={() => setShowDeleteRecurringConfirm(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteRecurring}
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
