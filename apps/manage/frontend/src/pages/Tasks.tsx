import { useEffect, useState, useMemo } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { api, Task, User, Project, Playbook } from '../services/api'
import TaskDetailModal from '../components/TaskDetailModal'
import CreateAssignmentModal from '../components/CreateAssignmentModal'

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-800',
  blocked: 'bg-orange-100 text-orange-800',
  checked_out: 'bg-primary-100 text-primary-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const PHASE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  planning: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Planning' },
  ready: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ready' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Progress' },
  pending_review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Pending Review' },
  in_review: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'In Review' },
  changes_requested: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Changes Requested' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  waiting_on_subplaybook: { bg: 'bg-cyan-100', text: 'text-cyan-700', label: 'Waiting' },
}

type GroupByOption = 'none' | 'project' | 'queue' | 'assignee' | 'status' | 'phase' | 'playbook'

// Format seconds to H:MM display
function formatDuration(seconds: number | undefined): string {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}:${minutes.toString().padStart(2, '0')}`
}

export default function Tasks() {
  const { tasks, queues, loading, fetchTasks, fetchQueues } = useAppStore()

  // Filters
  const [filterQueue, setFilterQueue] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPhase, setFilterPhase] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterPlaybook, setFilterPlaybook] = useState<string>('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterApprover, setFilterApprover] = useState<string>('')

  // Grouping
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Data
  const [users, setUsers] = useState<User[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)

  useEffect(() => {
    fetchQueues()
    fetchTasks()
    api.getUsers().then(setUsers).catch(console.error)
    api.getProjects().then(setProjects).catch(console.error)
    api.getPlaybooks({ active_only: true }).then(setPlaybooks).catch(console.error)
  }, [fetchQueues, fetchTasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterQueue && task.queue_id !== filterQueue) return false
      if (filterStatus && task.status !== filterStatus) return false
      if (filterPhase && task.phase !== filterPhase) return false
      if (filterProject && task.project_id !== filterProject) return false
      if (filterPlaybook && task.playbook_id !== filterPlaybook) return false
      if (filterAssignee && task.assigned_to_id !== filterAssignee) return false
      if (filterApprover && task.approver_id !== filterApprover) return false
      return true
    })
  }, [tasks, filterQueue, filterStatus, filterPhase, filterProject, filterPlaybook, filterAssignee, filterApprover])

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return { '': filteredTasks }
    }

    const groups: Record<string, Task[]> = {}

    filteredTasks.forEach((task) => {
      let groupKey = ''

      switch (groupBy) {
        case 'project':
          groupKey = task.project_id || '_none'
          break
        case 'queue':
          groupKey = task.queue_id || '_none'
          break
        case 'assignee':
          groupKey = task.assigned_to_id || '_none'
          break
        case 'status':
          groupKey = task.status || '_none'
          break
        case 'phase':
          groupKey = task.phase || '_none'
          break
        case 'playbook':
          groupKey = task.playbook_id || '_none'
          break
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(task)
    })

    return groups
  }, [filteredTasks, groupBy])

  // Helper functions
  const getQueueName = (queueId: string) => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || 'Unknown'
  }

  const getProjectName = (projectId: string | undefined) => {
    if (!projectId || projectId === '_none') return 'No Project'
    const project = projects.find((p) => (p._id || p.id) === projectId)
    return project?.name || 'Unknown'
  }

  const getPlaybookName = (playbookId: string | undefined) => {
    if (!playbookId || playbookId === '_none') return 'No Playbook'
    const playbook = playbooks.find((p) => p.id === playbookId)
    return playbook?.name || 'Unknown'
  }

  const getUserName = (userId: string | undefined) => {
    if (!userId || userId === '_none') return 'Unassigned'
    const user = users.find((u) => (u._id || u.id) === userId)
    return user?.name || 'Unknown'
  }

  const getGroupLabel = (groupKey: string): string => {
    if (groupKey === '_none') {
      switch (groupBy) {
        case 'project': return 'No Project'
        case 'queue': return 'No Queue'
        case 'assignee': return 'Unassigned'
        case 'playbook': return 'No Playbook'
        default: return 'Other'
      }
    }

    switch (groupBy) {
      case 'project': return getProjectName(groupKey)
      case 'queue': return getQueueName(groupKey)
      case 'assignee': return getUserName(groupKey)
      case 'status': return groupKey.replace('_', ' ')
      case 'phase': return PHASE_CONFIG[groupKey]?.label || groupKey
      case 'playbook': return getPlaybookName(groupKey)
      default: return groupKey
    }
  }

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey)
      } else {
        newSet.add(groupKey)
      }
      return newSet
    })
  }

  const handleQuickComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    if (completingTaskId) return

    setCompletingTaskId(taskId)
    try {
      await api.quickCompleteTask(taskId)
      fetchTasks()
    } catch (err) {
      console.error('Failed to complete task:', err)
    } finally {
      setCompletingTaskId(null)
    }
  }

  const clearFilters = () => {
    setFilterQueue('')
    setFilterStatus('')
    setFilterPhase('')
    setFilterProject('')
    setFilterPlaybook('')
    setFilterAssignee('')
    setFilterApprover('')
  }

  const hasFilters = filterQueue || filterStatus || filterPhase || filterProject || filterPlaybook || filterAssignee || filterApprover

  // Sort groups - put "_none" at the end
  const sortedGroupKeys = Object.keys(groupedTasks).sort((a, b) => {
    if (a === '_none') return 1
    if (b === '_none') return -1
    if (a === '') return -1
    if (b === '') return 1
    return getGroupLabel(a).localeCompare(getGroupLabel(b))
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Assignments</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          New Assignment
        </button>
      </div>

      {/* Filters Row */}
      <div className="bg-white shadow rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Filter */}
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project._id || project.id} value={project._id || project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {/* Playbook Filter */}
          <select
            value={filterPlaybook}
            onChange={(e) => setFilterPlaybook(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Playbooks</option>
            {playbooks.map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                {playbook.name}
              </option>
            ))}
          </select>

          {/* Queue Filter */}
          <select
            value={filterQueue}
            onChange={(e) => setFilterQueue(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Queues</option>
            {queues.map((queue) => (
              <option key={queue._id || queue.id} value={queue._id || queue.id}>
                {queue.purpose}
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Assignees</option>
            {users.map((user) => (
              <option key={user._id || user.id} value={user._id || user.id}>
                {user.name}
              </option>
            ))}
          </select>

          {/* Approver Filter */}
          <select
            value={filterApprover}
            onChange={(e) => setFilterApprover(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Approvers</option>
            {users.map((user) => (
              <option key={user._id || user.id} value={user._id || user.id}>
                {user.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="checked_out">Checked Out</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Phase Filter */}
          <select
            value={filterPhase}
            onChange={(e) => setFilterPhase(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">All Phases</option>
            {Object.entries(PHASE_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          )}

          <div className="flex-1" />

          {/* Group By */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Group by:</span>
            <select
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as GroupByOption)
                setCollapsedGroups(new Set())
              }}
              className="border border-gray-300 rounded px-2 py-1.5 text-xs"
            >
              <option value="none">None</option>
              <option value="project">Project</option>
              <option value="queue">Queue</option>
              <option value="assignee">Assignee</option>
              <option value="status">Status</option>
              <option value="phase">Phase</option>
              <option value="playbook">Playbook</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task Count */}
      <div className="text-xs text-gray-500">
        {filteredTasks.length} assignment{filteredTasks.length !== 1 ? 's' : ''}
        {hasFilters && ` (filtered from ${tasks.length})`}
      </div>

      {/* Tasks Display */}
      {loading.tasks ? (
        <div className="bg-white shadow rounded-lg p-4 text-gray-500 text-sm">Loading...</div>
      ) : groupBy === 'none' ? (
        // Flat list view
        <div className="bg-white shadow rounded-lg">
          <TaskList
            tasks={filteredTasks}
            projects={projects}
            queues={queues}
            completingTaskId={completingTaskId}
            onTaskClick={setSelectedTaskId}
            onQuickComplete={handleQuickComplete}
          />
        </div>
      ) : (
        // Grouped widget view
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedGroupKeys.map((groupKey) => {
            const groupTasks = groupedTasks[groupKey]
            const isCollapsed = collapsedGroups.has(groupKey)

            return (
              <div key={groupKey} className="bg-white shadow rounded-lg overflow-hidden">
                {/* Group Header */}
                <div
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {getGroupLabel(groupKey)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                    {groupTasks.length}
                  </span>
                </div>

                {/* Group Tasks */}
                {!isCollapsed && (
                  <TaskList
                    tasks={groupTasks}
                    projects={projects}
                    queues={queues}
                    completingTaskId={completingTaskId}
                    onTaskClick={setSelectedTaskId}
                    onQuickComplete={handleQuickComplete}
                    compact
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {filteredTasks.length === 0 && !loading.tasks && (
        <div className="bg-white shadow rounded-lg p-4 text-gray-500 text-sm text-center">
          No assignments found
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={() => fetchTasks()}
        />
      )}

      {/* Create Assignment Modal */}
      <CreateAssignmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchTasks()}
      />
    </div>
  )
}

// Compact task list component
interface TaskListProps {
  tasks: Task[]
  projects: Project[]
  queues: { _id?: string; id: string; purpose: string }[]
  completingTaskId: string | null
  onTaskClick: (taskId: string) => void
  onQuickComplete: (e: React.MouseEvent, taskId: string) => void
  compact?: boolean
}

function TaskList({
  tasks,
  projects,
  queues,
  completingTaskId,
  onTaskClick,
  onQuickComplete,
  compact = false,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="p-3 text-xs text-gray-500">No tasks</div>
  }

  const getProjectName = (projectId: string | undefined) => {
    if (!projectId) return null
    const project = projects.find((p) => (p._id || p.id) === projectId)
    return project?.name
  }

  const getQueueName = (queueId: string) => {
    const queue = queues.find((q) => (q._id || q.id) === queueId)
    return queue?.purpose || ''
  }

  return (
    <div className={`divide-y divide-gray-100 ${compact ? 'max-h-80 overflow-auto' : ''}`}>
      {tasks.map((task) => {
        const taskId = task._id || task.id
        const projectName = getProjectName(task.project_id)
        const queueName = getQueueName(task.queue_id)

        return (
          <div
            key={taskId}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onTaskClick(taskId)}
            title={queueName}
          >
            {/* Complete checkmark */}
            <button
              onClick={(e) => onQuickComplete(e, taskId)}
              disabled={completingTaskId === taskId}
              className={`flex-shrink-0 p-0.5 rounded transition-colors ${
                completingTaskId === taskId
                  ? 'text-gray-300 cursor-wait'
                  : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
              }`}
              title="Mark as complete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>

            {/* Task title */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{task.title}</p>
            </div>

            {/* Duration */}
            {task.estimated_duration && (
              <div className="flex-shrink-0 w-10">
                <span className="text-[10px] text-gray-500 font-mono" title="Estimated duration">
                  {formatDuration(task.estimated_duration)}
                </span>
              </div>
            )}

            {/* Project badge */}
            {projectName && (
              <div className="flex-shrink-0 max-w-20">
                <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate block">
                  {projectName}
                </span>
              </div>
            )}

            {/* Phase & Status badges */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {task.phase && PHASE_CONFIG[task.phase] && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${PHASE_CONFIG[task.phase].bg} ${PHASE_CONFIG[task.phase].text}`}
                >
                  {PHASE_CONFIG[task.phase].label}
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {task.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
