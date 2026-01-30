import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Modal, ModalFooter } from '@expertly/ui'
import {
  api,
  Project,
  Task,
  RecurringTask,
  Queue,
  Team,
  User,
  Playbook,
  CreateTaskRequest,
  CreateRecurringTaskRequest,
  RecurrenceType,
  ProjectStatus,
} from '../services/api'
import TaskDetailModal from '../components/TaskDetailModal'
import Breadcrumbs, { buildProjectBreadcrumbs } from '../components/Breadcrumbs'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-800',
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
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('tasks')

  // Modal states
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false)
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Task form state
  const [taskForm, setTaskForm] = useState<{
    title: string
    description: string
    playbook_id: string
    queue_id: string
    team_id: string
    user_id: string
    assignment_type: 'queue' | 'team' | 'user'
    is_recurring: boolean
    recurrence_type: RecurrenceType
    interval: number
    days_of_week: number[]
    day_of_month: number
  }>({
    title: '',
    description: '',
    playbook_id: '',
    queue_id: '',
    team_id: '',
    user_id: '',
    assignment_type: 'queue',
    is_recurring: false,
    recurrence_type: 'daily',
    interval: 1,
    days_of_week: [],
    day_of_month: 1,
  })

  // Playbook typeahead state
  const [playbookSearch, setPlaybookSearch] = useState('')
  const [showPlaybookDropdown, setShowPlaybookDropdown] = useState(false)

  // Project edit form
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
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
        teamsData,
        usersData,
        playbooksData,
      ] = await Promise.all([
        api.getProject(id),
        api.getProjectChildren(id),
        api.getProjects(), // Fetch all projects for breadcrumbs and typeahead
        api.getProjectTasks(id, { status: undefined }), // Get non-completed tasks
        api.getProjectTasks(id, { status: 'completed' }),
        api.getProjectRecurringTasks(id),
        api.getQueues(),
        api.getTeams(),
        api.getUsers(),
        api.getPlaybooks({ active_only: true }),
      ])

      setProject(projectData)
      setSubprojects(subprojectsData)
      setAllProjects(allProjectsData)
      // Filter out completed tasks from the main tasks list
      setTasks(tasksData.filter((t) => t.status !== 'completed'))
      setCompletedTasks(completedTasksData)
      setRecurringTasks(recurringTasksData)
      setQueues(queuesData)
      setTeams(teamsData)
      setUsers(usersData)
      setPlaybooks(playbooksData)

      // Initialize project form
      setProjectForm({
        name: projectData.name,
        description: projectData.description || '',
        status: projectData.status,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Filtered playbooks for typeahead
  const filteredPlaybooks = useMemo(() => {
    if (!playbookSearch.trim()) return playbooks.slice(0, 10)
    const search = playbookSearch.toLowerCase()
    return playbooks.filter((p) => p.name.toLowerCase().includes(search)).slice(0, 10)
  }, [playbooks, playbookSearch])

  const selectedPlaybook = useMemo(() => {
    return playbooks.find((p) => (p.id || (p as { _id?: string })._id) === taskForm.playbook_id)
  }, [playbooks, taskForm.playbook_id])

  const getQueueName = (queueId: string): string => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || 'Unknown Queue'
  }

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      playbook_id: '',
      queue_id: queues[0]?._id || queues[0]?.id || '',
      team_id: '',
      user_id: '',
      assignment_type: 'queue',
      is_recurring: false,
      recurrence_type: 'daily',
      interval: 1,
      days_of_week: [],
      day_of_month: 1,
    })
    setPlaybookSearch('')
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.title.trim() || !id) return

    // Determine queue_id - use selected queue, or create/get unassigned queue
    let queueId = taskForm.queue_id
    if (!queueId && queues.length > 0) {
      // Use first available queue if none selected
      queueId = queues[0]._id || queues[0].id
    }

    if (!queueId) {
      alert('Please select a queue')
      return
    }

    setSaving(true)
    try {
      if (taskForm.is_recurring) {
        const recurringData: CreateRecurringTaskRequest = {
          queue_id: queueId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          project_id: id,
          recurrence_type: taskForm.recurrence_type,
          interval: taskForm.interval,
          days_of_week:
            taskForm.recurrence_type === 'weekly' ? taskForm.days_of_week : undefined,
          day_of_month:
            taskForm.recurrence_type === 'monthly' ? taskForm.day_of_month : undefined,
        }
        await api.createRecurringTask(recurringData)
      } else {
        const taskData: CreateTaskRequest = {
          queue_id: queueId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          project_id: id,
        }
        await api.createTask(taskData)
      }

      await loadData()
      setShowCreateTaskModal(false)
      resetTaskForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task'
      alert(message)
    } finally {
      setSaving(false)
    }
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

  const toggleDayOfWeek = (day: number) => {
    const days = taskForm.days_of_week || []
    if (days.includes(day)) {
      setTaskForm({ ...taskForm, days_of_week: days.filter((d) => d !== day) })
    } else {
      setTaskForm({ ...taskForm, days_of_week: [...days, day].sort() })
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

  const activeTasks = tasks.filter((t) => t.status !== 'completed')

  // Build breadcrumb items
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

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      {breadcrumbItems.length > 0 && (
        <Breadcrumbs items={breadcrumbItems} className="mb-2" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
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
            onClick={() => {
              resetTaskForm()
              setShowCreateTaskModal(true)
            }}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* Subprojects Section */}
      {(subprojects.length > 0 || true) && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Subprojects</h3>
            <Link
              to={`/projects?parent=${id}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Add subproject
            </Link>
          </div>
          {subprojects.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {subprojects.map((sub) => (
                <li key={sub._id || sub.id} className="py-2">
                  <Link
                    to={`/projects/${sub._id || sub.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {sub.name}
                  </Link>
                  <span
                    className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getProjectStatusBadgeColor(sub.status)}`}
                  >
                    {formatProjectStatus(sub.status)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No subprojects yet</p>
          )}
        </div>
      )}

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
            Tasks ({activeTasks.length})
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
                  Task
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
                    No active tasks. Create one to get started.
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
                  Task
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
                    No completed tasks yet.
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
                  Task
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
                </tr>
              ))}
              {recurringTasks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No recurring tasks. Create one to automate task creation.
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

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        title="Create Task"
        size="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Task title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Task description"
            />
          </div>

          {/* Playbook Typeahead */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Playbook (optional)
            </label>
            {selectedPlaybook ? (
              <div className="flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                <span className="text-gray-900">{selectedPlaybook.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTaskForm({ ...taskForm, playbook_id: '' })
                    setPlaybookSearch('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={playbookSearch}
                  onChange={(e) => {
                    setPlaybookSearch(e.target.value)
                    setShowPlaybookDropdown(true)
                  }}
                  onFocus={() => setShowPlaybookDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPlaybookDropdown(false), 200)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Search playbooks..."
                />
                {showPlaybookDropdown && filteredPlaybooks.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                    {filteredPlaybooks.map((playbook) => (
                      <li
                        key={playbook.id || (playbook as { _id?: string })._id}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onMouseDown={() => {
                          setTaskForm({
                            ...taskForm,
                            playbook_id: playbook.id || (playbook as { _id?: string })._id || '',
                          })
                          setPlaybookSearch('')
                          setShowPlaybookDropdown(false)
                        }}
                      >
                        <p className="font-medium text-gray-900">{playbook.name}</p>
                        {playbook.description && (
                          <p className="text-xs text-gray-500 truncate">{playbook.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Assignment Section */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment</label>
            <div className="space-y-3">
              {/* Assignment Type Radio */}
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="queue"
                    checked={taskForm.assignment_type === 'queue'}
                    onChange={() => setTaskForm({ ...taskForm, assignment_type: 'queue' })}
                    className="mr-2"
                  />
                  Queue
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="team"
                    checked={taskForm.assignment_type === 'team'}
                    onChange={() => setTaskForm({ ...taskForm, assignment_type: 'team' })}
                    className="mr-2"
                  />
                  Team
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="assignment_type"
                    value="user"
                    checked={taskForm.assignment_type === 'user'}
                    onChange={() => setTaskForm({ ...taskForm, assignment_type: 'user' })}
                    className="mr-2"
                  />
                  User
                </label>
              </div>

              {/* Assignment Dropdown based on type */}
              {taskForm.assignment_type === 'queue' && (
                <select
                  value={taskForm.queue_id}
                  onChange={(e) => setTaskForm({ ...taskForm, queue_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a queue (optional)</option>
                  {queues.map((queue) => (
                    <option key={queue._id || queue.id} value={queue._id || queue.id}>
                      {queue.purpose}
                    </option>
                  ))}
                </select>
              )}

              {taskForm.assignment_type === 'team' && (
                <select
                  value={taskForm.team_id}
                  onChange={(e) => setTaskForm({ ...taskForm, team_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team._id || team.id} value={team._id || team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}

              {taskForm.assignment_type === 'user' && (
                <select
                  value={taskForm.user_id}
                  onChange={(e) => setTaskForm({ ...taskForm, user_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a user</option>
                  {users.map((user) => (
                    <option key={user._id || user.id} value={user._id || user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Make Recurring Toggle */}
          <div className="border-t pt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={taskForm.is_recurring}
                onChange={(e) => setTaskForm({ ...taskForm, is_recurring: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Make this a recurring task</span>
            </label>

            {taskForm.is_recurring && (
              <div className="mt-4 space-y-3 pl-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recurrence Type
                  </label>
                  <select
                    value={taskForm.recurrence_type}
                    onChange={(e) =>
                      setTaskForm({
                        ...taskForm,
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
                      value={taskForm.interval}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, interval: parseInt(e.target.value) || 1 })
                      }
                      className="w-20 border border-gray-300 rounded-md px-3 py-2"
                      min={1}
                    />
                    <span className="text-gray-700">
                      {taskForm.recurrence_type === 'daily'
                        ? 'day(s)'
                        : taskForm.recurrence_type === 'weekly'
                          ? 'week(s)'
                          : 'month(s)'}
                    </span>
                  </div>
                </div>

                {taskForm.recurrence_type === 'weekly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">On days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDayOfWeek(index)}
                          className={`px-3 py-1 rounded-md text-sm ${
                            taskForm.days_of_week?.includes(index)
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

                {taskForm.recurrence_type === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      On day of month
                    </label>
                    <input
                      type="number"
                      value={taskForm.day_of_month}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, day_of_month: parseInt(e.target.value) || 1 })
                      }
                      className="w-20 border border-gray-300 rounded-md px-3 py-2"
                      min={1}
                      max={31}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => setShowCreateTaskModal(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : taskForm.is_recurring ? 'Create Recurring Task' : 'Create Task'}
            </button>
          </ModalFooter>
        </form>
      </Modal>

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
    </div>
  )
}
