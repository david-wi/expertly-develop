import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { api, Task, User, Project, Playbook } from '../services/api'
import TaskDetailModal from '../components/TaskDetailModal'
import CreateAssignmentModal from '../components/CreateAssignmentModal'
import UndoToast from '../components/UndoToast'
import TaskList from '../components/TaskList'
import { useToggleStar } from '../hooks/useToggleStar'
import { PHASE_CONFIG } from '../utils/taskDisplay'

// Build a display name with parent hierarchy
function getProjectDisplayName(project: Project, allProjects: Project[]): string {
  if (!project.parent_project_id) return project.name
  const parent = allProjects.find(p => (p._id || p.id) === project.parent_project_id)
  if (parent) {
    return `${getProjectDisplayName(parent, allProjects)} > ${project.name}`
  }
  return project.name
}

type GroupByOption = 'none' | 'project' | 'primary_project' | 'queue' | 'assignee' | 'status' | 'phase' | 'playbook'

// Find the root (first-level) project by walking up parent_project_id
function getRootProjectId(projectId: string, allProjects: Project[]): string {
  const projectMap = new Map<string, Project>()
  for (const p of allProjects) {
    projectMap.set(p._id || p.id, p)
  }

  let current = projectMap.get(projectId)
  while (current?.parent_project_id) {
    const parent = projectMap.get(current.parent_project_id)
    if (!parent) break
    current = parent
  }
  return current ? (current._id || current.id) : projectId
}

export default function Tasks() {
  const { tasks, queues, loading, fetchTasks, fetchQueues, updateTaskLocally } = useAppStore()

  // Filters
  const [filterQueue, setFilterQueue] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('active')
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
  const [undoInfo, setUndoInfo] = useState<{ taskId: string; title: string } | null>(null)

  // Inline add task state
  const [addingInGroup, setAddingInGroup] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskProjectId, setNewTaskProjectId] = useState('')
  const [newTaskProjectQuery, setNewTaskProjectQuery] = useState('')
  const [newTaskInstructions, setNewTaskInstructions] = useState('')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const newTaskTitleRef = useRef<HTMLInputElement>(null)
  const newTaskProjectRef = useRef<HTMLInputElement>(null)
  const newTaskInstructionsRef = useRef<HTMLTextAreaElement>(null)

  // Drag-to-reorder state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault()
    if (taskId !== draggedTaskId) {
      setDragOverTaskId(taskId)
    }
  }

  const handleDragLeave = () => {
    setDragOverTaskId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetTaskId: string, taskList: Task[]) => {
    e.preventDefault()
    setDragOverTaskId(null)

    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null)
      return
    }

    const draggedIndex = taskList.findIndex((t) => (t._id || t.id) === draggedTaskId)
    const targetIndex = taskList.findIndex((t) => (t._id || t.id) === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTaskId(null)
      return
    }

    const targetTask = taskList[targetIndex]
    const targetSeq = targetTask.sequence ?? 0
    let newSequence: number

    if (draggedIndex < targetIndex) {
      const nextTask = taskList[targetIndex + 1]
      newSequence = nextTask ? (targetSeq + (nextTask.sequence ?? targetSeq + 2)) / 2 : targetSeq + 1
    } else {
      const prevTask = taskList[targetIndex - 1]
      newSequence = prevTask ? ((prevTask.sequence ?? targetSeq - 2) + targetSeq) / 2 : targetSeq - 1
    }

    updateTaskLocally(draggedTaskId, { sequence: newSequence })
    setDraggedTaskId(null)

    try {
      await api.reorderTasks([{ id: draggedTaskId, sequence: newSequence }])
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      fetchTasks()
    }
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  useEffect(() => {
    fetchQueues()
    fetchTasks()
    api.getUsers().then(setUsers).catch(console.error)
    api.getProjects().then(setProjects).catch(console.error)
    api.getPlaybooks({ active_only: true }).then(setPlaybooks).catch(console.error)
  }, [fetchQueues, fetchTasks])

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (filterQueue && task.queue_id !== filterQueue) return false
      if (filterStatus === 'active' && (task.status === 'completed' || task.status === 'failed')) return false
      if (filterStatus && filterStatus !== 'active' && task.status !== filterStatus) return false
      if (filterPhase && task.phase !== filterPhase) return false
      if (filterProject && task.project_id !== filterProject) return false
      if (filterPlaybook && task.playbook_id !== filterPlaybook) return false
      if (filterAssignee && task.assigned_to_id !== filterAssignee) return false
      if (filterApprover && task.approver_id !== filterApprover) return false
      return true
    })
    // Sort: starred first, then by sequence (ascending), then by created_at — same as dashboard widgets
    return [...filtered].sort((a, b) => {
      const starA = a.is_starred ? 0 : 1
      const starB = b.is_starred ? 0 : 1
      if (starA !== starB) return starA - starB
      const seqA = a.sequence ?? Number.MAX_VALUE
      const seqB = b.sequence ?? Number.MAX_VALUE
      if (seqA !== seqB) return seqA - seqB
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
        case 'primary_project':
          groupKey = task.project_id ? getRootProjectId(task.project_id, projects) : '_none'
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
  }, [filteredTasks, groupBy, projects])

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
        case 'primary_project': return 'No Project'
        case 'queue': return 'No Queue'
        case 'assignee': return 'Unassigned'
        case 'playbook': return 'No Playbook'
        default: return 'Other'
      }
    }

    switch (groupBy) {
      case 'project': return getProjectName(groupKey)
      case 'primary_project': return getProjectName(groupKey)
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

  const handleToggleStar = useToggleStar()

  const handleQuickComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    if (completingTaskId) return

    const task = tasks.find(t => (t._id || t.id) === taskId)
    const taskTitle = task?.title || 'Task'

    setCompletingTaskId(taskId)
    try {
      await api.quickCompleteTask(taskId)
      fetchTasks()
      setUndoInfo({ taskId, title: taskTitle })
    } catch (err) {
      console.error('Failed to complete task:', err)
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleUndo = useCallback(async () => {
    if (!undoInfo) return
    try {
      await api.reopenTask(undoInfo.taskId)
      fetchTasks()
    } catch (err) {
      console.error('Failed to reopen task:', err)
    }
  }, [undoInfo, fetchTasks])

  const clearFilters = () => {
    setFilterQueue('')
    setFilterStatus('active')
    setFilterPhase('')
    setFilterProject('')
    setFilterPlaybook('')
    setFilterAssignee('')
    setFilterApprover('')
  }

  const hasFilters = filterQueue || (filterStatus && filterStatus !== 'active') || filterPhase || filterProject || filterPlaybook || filterAssignee || filterApprover

  // Get user's default queue for quick task creation
  const userQueues = queues.filter((q) => q.scope_type === 'user')
  const defaultQueue = userQueues[0]

  // Start adding a task in a group
  const startAddingInGroup = (groupKey: string) => {
    setAddingInGroup(groupKey)
    setNewTaskTitle('')
    setNewTaskProjectId('')
    setNewTaskProjectQuery('')
    setNewTaskInstructions('')
    // Pre-fill project if grouped by project or primary project
    if ((groupBy === 'project' || groupBy === 'primary_project') && groupKey !== '_none') {
      const project = projects.find((p) => (p._id || p.id) === groupKey)
      if (project) {
        setNewTaskProjectId(groupKey)
        setNewTaskProjectQuery(getProjectDisplayName(project, projects))
      }
    }
    setTimeout(() => newTaskTitleRef.current?.focus(), 0)
  }

  // Cancel adding task
  const cancelAddingTask = () => {
    setAddingInGroup(null)
    setNewTaskTitle('')
    setNewTaskProjectId('')
    setNewTaskProjectQuery('')
    setNewTaskInstructions('')
    setShowProjectDropdown(false)
  }

  // Create task with inferred parameters based on grouping
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !defaultQueue || isCreatingTask) return

    setIsCreatingTask(true)
    try {
      // Build task data with inferred parameters
      const taskData: {
        queue_id: string
        title: string
        description?: string
        project_id?: string
        playbook_id?: string
      } = {
        queue_id: defaultQueue._id || defaultQueue.id,
        title: newTaskTitle.trim(),
        description: newTaskInstructions.trim() || undefined,
      }

      // Infer parameters based on grouping
      if (addingInGroup && addingInGroup !== '_none') {
        switch (groupBy) {
          case 'project':
          case 'primary_project':
            taskData.project_id = addingInGroup
            break
          case 'queue':
            taskData.queue_id = addingInGroup
            break
          case 'playbook':
            taskData.playbook_id = addingInGroup
            break
          // For assignee, we'll update after creation
          // For status/phase, tasks start as queued/planning by default
        }
      }

      // Allow manual project override
      if (newTaskProjectId && groupBy !== 'project' && groupBy !== 'primary_project') {
        taskData.project_id = newTaskProjectId
      }

      const newTask = await api.createTask(taskData)
      const taskId = newTask._id || newTask.id

      // For assignee grouping, update the task with the assigned user
      if (groupBy === 'assignee' && addingInGroup && addingInGroup !== '_none' && taskId) {
        await api.updateTask(taskId, { assigned_to_id: addingInGroup })
      }

      cancelAddingTask()
      fetchTasks()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsCreatingTask(false)
    }
  }

  // Keyboard handlers for inline task creation
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newTaskTitle.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey && newTaskTitle.trim()) {
      // Only show project field if not grouped by project
      if (groupBy !== 'project' && groupBy !== 'primary_project') {
        e.preventDefault()
        newTaskProjectRef.current?.focus()
        setShowProjectDropdown(true)
      } else {
        e.preventDefault()
        newTaskInstructionsRef.current?.focus()
      }
    } else if (e.key === 'Escape') {
      cancelAddingTask()
    }
  }

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Auto-select if single match
      const filteredProjects = projects.filter(p =>
        getProjectDisplayName(p, projects).toLowerCase().includes(newTaskProjectQuery.toLowerCase())
      )
      if (filteredProjects.length === 1) {
        setNewTaskProjectId(filteredProjects[0]._id || filteredProjects[0].id)
        setNewTaskProjectQuery(getProjectDisplayName(filteredProjects[0], projects))
      }
      setShowProjectDropdown(false)
      if (newTaskTitle.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      setShowProjectDropdown(false)
      newTaskInstructionsRef.current?.focus()
    } else if (e.key === 'Escape') {
      setShowProjectDropdown(false)
    }
  }

  const handleInstructionsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (newTaskTitle.trim()) {
        handleCreateTask()
      }
    } else if (e.key === 'Escape') {
      cancelAddingTask()
    }
  }

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
            <option value="active">Active</option>
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
              <option value="primary_project">Project (Primary)</option>
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
          {/* Inline Add Task for flat list */}
          {defaultQueue && (
            addingInGroup === '' ? (
              <div className="px-3 py-2 border-b border-gray-100 bg-blue-50/30">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 text-blue-400 pt-0.5">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      ref={newTaskTitleRef}
                      type="text"
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={handleTitleKeyDown}
                      disabled={isCreatingTask}
                      className="w-full text-sm font-medium text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                    />
                    {newTaskTitle && (
                      <>
                        <div className="relative">
                          <input
                            ref={newTaskProjectRef}
                            type="text"
                            placeholder="Project (optional)..."
                            value={newTaskProjectQuery}
                            onChange={(e) => {
                              setNewTaskProjectQuery(e.target.value)
                              setShowProjectDropdown(true)
                              if (newTaskProjectId) {
                                const selectedProject = projects.find(p => (p._id || p.id) === newTaskProjectId)
                                if (selectedProject && getProjectDisplayName(selectedProject, projects) !== e.target.value) {
                                  setNewTaskProjectId('')
                                }
                              }
                            }}
                            onFocus={() => setShowProjectDropdown(true)}
                            onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                            onKeyDown={handleProjectKeyDown}
                            disabled={isCreatingTask}
                            className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                          />
                          {showProjectDropdown && newTaskProjectQuery && (
                            <div className="absolute z-10 top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto min-w-max">
                              {projects
                                .filter(p => getProjectDisplayName(p, projects).toLowerCase().includes(newTaskProjectQuery.toLowerCase()))
                                .slice(0, 5)
                                .map(project => (
                                  <div
                                    key={project._id || project.id}
                                    className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                                    onMouseDown={() => {
                                      setNewTaskProjectId(project._id || project.id)
                                      setNewTaskProjectQuery(getProjectDisplayName(project, projects))
                                      setShowProjectDropdown(false)
                                    }}
                                  >
                                    {getProjectDisplayName(project, projects)}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <textarea
                          ref={newTaskInstructionsRef}
                          placeholder="Instructions (optional)..."
                          value={newTaskInstructions}
                          onChange={(e) => setNewTaskInstructions(e.target.value)}
                          onKeyDown={handleInstructionsKeyDown}
                          disabled={isCreatingTask}
                          rows={2}
                          className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
                        />
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCreateTask}
                        disabled={!newTaskTitle.trim() || isCreatingTask}
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCreatingTask ? 'Adding...' : 'Add Task'}
                      </button>
                      <button
                        onClick={cancelAddingTask}
                        disabled={isCreatingTask}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="text-xs text-gray-400 ml-auto">Enter to save, Esc to cancel</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => startAddingInGroup('')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
              >
                <Plus className="w-4 h-4" />
                <span>Add task</span>
              </button>
            )
          )}
          <TaskList
            tasks={filteredTasks}
            projects={projects}
            queues={queues}
            users={users}
            columns={{ showAssignee: true, showDuration: true, showProject: true, showPhase: true, showStatus: true }}
            completingTaskId={completingTaskId}
            onTaskClick={setSelectedTaskId}
            onQuickComplete={handleQuickComplete}
            onToggleStar={handleToggleStar}
            draggable
            dragState={{ draggedTaskId, dragOverTaskId }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
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
                  <>
                    <TaskList
                      tasks={groupTasks}
                      projects={projects}
                      queues={queues}
                      users={users}
                      columns={{ showAssignee: true, showDuration: true, showProject: true, showPhase: true, showStatus: true }}
                      compact
                      completingTaskId={completingTaskId}
                      onTaskClick={setSelectedTaskId}
                      onQuickComplete={handleQuickComplete}
                      onToggleStar={handleToggleStar}
                      draggable
                      dragState={{ draggedTaskId, dragOverTaskId }}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                    />

                    {/* Inline Add Task */}
                    {defaultQueue && (
                      addingInGroup === groupKey ? (
                        <div className="px-2 py-2 border-t border-gray-100 bg-blue-50/30">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 text-blue-400 pt-0.5">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <input
                                ref={newTaskTitleRef}
                                type="text"
                                placeholder="Task title..."
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                onKeyDown={handleTitleKeyDown}
                                disabled={isCreatingTask}
                                className="w-full text-xs font-medium text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                              />
                              {newTaskTitle && groupBy !== 'project' && groupBy !== 'primary_project' && (
                                <div className="relative">
                                  <input
                                    ref={newTaskProjectRef}
                                    type="text"
                                    placeholder="Project (optional)..."
                                    value={newTaskProjectQuery}
                                    onChange={(e) => {
                                      setNewTaskProjectQuery(e.target.value)
                                      setShowProjectDropdown(true)
                                      if (newTaskProjectId) {
                                        const selectedProject = projects.find(p => (p._id || p.id) === newTaskProjectId)
                                        if (selectedProject && getProjectDisplayName(selectedProject, projects) !== e.target.value) {
                                          setNewTaskProjectId('')
                                        }
                                      }
                                    }}
                                    onFocus={() => setShowProjectDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                                    onKeyDown={handleProjectKeyDown}
                                    disabled={isCreatingTask}
                                    className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                                  />
                                  {showProjectDropdown && newTaskProjectQuery && (
                                    <div className="absolute z-10 top-full right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-auto min-w-max">
                                      {projects
                                        .filter(p => getProjectDisplayName(p, projects).toLowerCase().includes(newTaskProjectQuery.toLowerCase()))
                                        .slice(0, 5)
                                        .map(project => (
                                          <div
                                            key={project._id || project.id}
                                            className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                                            onMouseDown={() => {
                                              setNewTaskProjectId(project._id || project.id)
                                              setNewTaskProjectQuery(getProjectDisplayName(project, projects))
                                              setShowProjectDropdown(false)
                                            }}
                                          >
                                            {getProjectDisplayName(project, projects)}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              {newTaskTitle && (
                                <textarea
                                  ref={newTaskInstructionsRef}
                                  placeholder="Instructions (optional)..."
                                  value={newTaskInstructions}
                                  onChange={(e) => setNewTaskInstructions(e.target.value)}
                                  onKeyDown={handleInstructionsKeyDown}
                                  disabled={isCreatingTask}
                                  rows={2}
                                  className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
                                />
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={handleCreateTask}
                                  disabled={!newTaskTitle.trim() || isCreatingTask}
                                  className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {isCreatingTask ? 'Adding...' : 'Add'}
                                </button>
                                <button
                                  onClick={cancelAddingTask}
                                  disabled={isCreatingTask}
                                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                                <span className="text-[10px] text-gray-400 ml-auto">Enter to save, Esc to cancel</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startAddingInGroup(groupKey)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add task</span>
                        </button>
                      )
                    )}
                  </>
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

      {undoInfo && (
        <UndoToast
          message={`"${undoInfo.title}" completed`}
          onUndo={handleUndo}
          onDismiss={() => setUndoInfo(null)}
        />
      )}
    </div>
  )
}
