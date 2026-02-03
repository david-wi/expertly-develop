import { useEffect, useState, useMemo } from 'react'
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

// Default custom fields for new projects
const DEFAULT_CUSTOM_FIELDS: ProjectCustomField[] = [
  { label: 'URL', value: '' },
  { label: 'Contact Name', value: '' },
  { label: 'Contact Email', value: '' },
]

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

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('tasks')

  // Modal states
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [showEditRecurringModal, setShowEditRecurringModal] = useState(false)
  const [showDeleteRecurringConfirm, setShowDeleteRecurringConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedRecurringTask, setSelectedRecurringTask] = useState<RecurringTask | null>(null)

  // Right panel edit states
  const [editingResources, setEditingResources] = useState(false)
  const [editingFields, setEditingFields] = useState(false)
  const [editingNextSteps, setEditingNextSteps] = useState(false)
  const [localResources, setLocalResources] = useState<ProjectResource[]>([])
  const [localFields, setLocalFields] = useState<ProjectCustomField[]>([])
  const [localNextSteps, setLocalNextSteps] = useState('')
  const [newResourceTitle, setNewResourceTitle] = useState('')
  const [newResourceUrl, setNewResourceUrl] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')

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
        api.getProjects(), // Fetch all projects for breadcrumbs and typeahead
        api.getProjectTasks(id, { status: undefined, include_subtasks: true }), // Get non-completed tasks including subprojects
        api.getProjectTasks(id, { status: 'completed', include_subtasks: true }), // Include completed tasks from subprojects
        api.getProjectRecurringTasks(id),
        api.getQueues(),
      ])

      setProject(projectData)
      setSubprojects(subprojectsData)
      setAllProjects(allProjectsData)
      // Filter out completed tasks from the main tasks list
      setTasks(tasksData.filter((t) => t.status !== 'completed'))
      setCompletedTasks(completedTasksData)
      setRecurringTasks(recurringTasksData)
      setQueues(queuesData)

      // Initialize project form
      setProjectForm({
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status,
        parent_project_id: projectData.parent_project_id || null,
      })

      // Initialize right panel local states
      setLocalResources(projectData.resources || [])
      // Use existing custom fields or populate with defaults if empty
      const existingFields = projectData.custom_fields || []
      if (existingFields.length === 0) {
        setLocalFields(DEFAULT_CUSTOM_FIELDS)
      } else {
        setLocalFields(existingFields)
      }
      setLocalNextSteps(projectData.next_steps || '')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const getQueueName = (queueId: string): string => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || 'Unknown Queue'
  }

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

  // Save resources
  const handleSaveResources = async () => {
    if (!id) return
    setSaving(true)
    try {
      await api.updateProject(id, { resources: localResources })
      await loadData()
      setEditingResources(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save resources'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  // Save custom fields
  const handleSaveFields = async () => {
    if (!id) return
    setSaving(true)
    try {
      await api.updateProject(id, { custom_fields: localFields })
      await loadData()
      setEditingFields(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save fields'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  // Save next steps
  const handleSaveNextSteps = async () => {
    if (!id) return
    setSaving(true)
    try {
      await api.updateProject(id, { next_steps: localNextSteps })
      await loadData()
      setEditingNextSteps(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save next steps'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  // Add resource
  const handleAddResource = () => {
    if (!newResourceTitle.trim() || !newResourceUrl.trim()) return
    setLocalResources([
      ...localResources,
      { title: newResourceTitle.trim(), url: newResourceUrl.trim(), type: 'link' },
    ])
    setNewResourceTitle('')
    setNewResourceUrl('')
  }

  // Remove resource
  const handleRemoveResource = (index: number) => {
    setLocalResources(localResources.filter((_, i) => i !== index))
  }

  // Add custom field
  const handleAddField = () => {
    if (!newFieldLabel.trim()) return
    setLocalFields([...localFields, { label: newFieldLabel.trim(), value: newFieldValue }])
    setNewFieldLabel('')
    setNewFieldValue('')
  }

  // Remove custom field
  const handleRemoveField = (index: number) => {
    setLocalFields(localFields.filter((_, i) => i !== index))
  }

  // Update custom field value
  const handleUpdateFieldValue = (index: number, value: string) => {
    const updated = [...localFields]
    updated[index] = { ...updated[index], value }
    setLocalFields(updated)
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

  // Build breadcrumb items - must be before early returns to follow rules of hooks
  const breadcrumbItems = useMemo(() => {
    if (!project) return []
    const projectForBreadcrumb = {
      ...project,
      id: project._id || project.id,
    }
    const allProjectsForBreadcrumb = allProjects.map((p) => ({
      ...p,
      id: p._id || p.id,
    }))
    return buildProjectBreadcrumbs(projectForBreadcrumb, allProjectsForBreadcrumb)
  }, [project, allProjects])

  // Convert projects to format expected by ProjectTypeahead
  const typeaheadProjects = useMemo(() => {
    return allProjects.map((p) => ({
      id: p._id || p.id,
      name: p.name,
      parent_project_id: p.parent_project_id,
    }))
  }, [allProjects])

  // Get current project ID for exclusion
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
      {/* Breadcrumbs */}
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
      <div className="flex gap-4">
        {/* Left Column - Subprojects (narrower) */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Subprojects
              </h3>
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
        </div>

        {/* Right Column - Project Details */}
        <div className="flex-1 space-y-4">
          {/* Resources Section */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Resources
              </h3>
              {!editingResources ? (
                <button
                  onClick={() => setEditingResources(true)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLocalResources(project.resources || [])
                      setEditingResources(false)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveResources}
                    disabled={saving}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {editingResources ? (
              <div className="space-y-2">
                {localResources.map((res, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
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
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Title"
                    value={newResourceTitle}
                    onChange={(e) => setNewResourceTitle(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="url"
                    placeholder="URL"
                    value={newResourceUrl}
                    onChange={(e) => setNewResourceUrl(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <button
                    onClick={handleAddResource}
                    className="text-blue-600 hover:text-blue-800 text-xs px-2"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ) : localResources.length > 0 ? (
              <ul className="space-y-1">
                {localResources.map((res, idx) => (
                  <li key={idx} className="text-xs">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {res.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No resources added</p>
            )}
          </div>

          {/* Fields & Values Section */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Fields & Values
              </h3>
              {!editingFields ? (
                <button
                  onClick={() => setEditingFields(true)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const existingFields = project.custom_fields || []
                      setLocalFields(existingFields.length === 0 ? DEFAULT_CUSTOM_FIELDS : existingFields)
                      setEditingFields(false)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFields}
                    disabled={saving}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {editingFields ? (
              <div className="space-y-2">
                {localFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 flex-shrink-0">{field.label}:</span>
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => handleUpdateFieldValue(idx, e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => handleRemoveField(idx)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <button
                    onClick={handleAddField}
                    className="text-blue-600 hover:text-blue-800 text-xs px-2"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ) : localFields.length > 0 ? (
              <div className="space-y-1">
                {localFields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600 w-24 flex-shrink-0">{field.label}:</span>
                    <span className="text-gray-900 truncate">{field.value || '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No custom fields</p>
            )}
          </div>

          {/* Next Steps Section */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Next Steps
              </h3>
              {!editingNextSteps ? (
                <button
                  onClick={() => setEditingNextSteps(true)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLocalNextSteps(project.next_steps || '')
                      setEditingNextSteps(false)
                    }}
                    className="text-gray-500 hover:text-gray-700 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNextSteps}
                    disabled={saving}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            {editingNextSteps ? (
              <textarea
                value={localNextSteps}
                onChange={(e) => setLocalNextSteps(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs min-h-[80px]"
                placeholder="Write your next steps here..."
              />
            ) : localNextSteps ? (
              <div className="relative group">
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{localNextSteps}</p>
                <button
                  onClick={() => handleCopy(localNextSteps)}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs transition-opacity"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No next steps defined</p>
            )}
          </div>

          {/* AI Suggestions Section */}
          <div className="bg-white shadow rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                AI Suggestions
              </h3>
            </div>
            {project.ai_suggestions ? (
              <div className="relative group">
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{project.ai_suggestions}</p>
                <button
                  onClick={() => handleCopy(project.ai_suggestions || '')}
                  className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs transition-opacity"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No AI suggestions available</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tasks'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Assignments ({activeTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'completed'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Completed ({completedTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('recurring')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'recurring'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Recurring ({recurringTasks.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {activeTab === 'tasks' && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignment
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queue
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeTasks.map((task) => (
                <tr
                  key={task._id || task.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedTaskId(task._id || task.id)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {getQueueName(task.queue_id)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">P{task.priority}</td>
                </tr>
              ))}
              {activeTasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No active assignments. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'completed' && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignment
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queue
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {completedTasks.map((task) => (
                <tr
                  key={task._id || task.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedTaskId(task._id || task.id)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {getQueueName(task.queue_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(task.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {completedTasks.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    No completed assignments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'recurring' && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignment
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Queue
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recurringTasks.map((task) => (
                <tr
                  key={task._id || task.id}
                  className={`hover:bg-gray-50 ${!task.is_active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {getQueueName(task.queue_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    {formatRecurrence(task)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        task.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {task.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleTriggerRecurring(task)}
                      className="text-green-600 hover:text-green-800 text-sm mr-2"
                      title="Create assignment now"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => handleToggleRecurringActive(task)}
                      className={`text-sm mr-2 ${
                        task.is_active
                          ? 'text-yellow-600 hover:text-yellow-800'
                          : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {task.is_active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => openEditRecurringModal(task)}
                      className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRecurringTask(task)
                        setShowDeleteRecurringConfirm(true)
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {recurringTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No recurring assignments. Create one to automate assignment creation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              onChange={(parentId) => setProjectForm({ ...projectForm, parent_project_id: parentId })}
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

          {/* Recurrence Settings */}
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
                      setRecurringForm({ ...recurringForm, interval: parseInt(e.target.value) || 1 })
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
                      setRecurringForm({ ...recurringForm, day_of_month: parseInt(e.target.value) || 1 })
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
