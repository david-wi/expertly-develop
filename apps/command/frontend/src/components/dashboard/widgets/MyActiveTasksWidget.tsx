import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Maximize2, Check, Plus, Timer, X, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, Task, User as UserType, Team, TaskReorderItem, Project } from '../../../services/api'
import TaskDetailModal from '../../../components/TaskDetailModal'
import TaskList from '../../../components/TaskList'
import ProjectTypeahead from '../../../components/ProjectTypeahead'
import StartTimerModal from '../../../components/StartTimerModal'
import UndoToast from '../../../components/UndoToast'
import { useToggleStar } from '../../../hooks/useToggleStar'
import { formatDuration, parseDuration } from '../../../utils/duration'

interface Playbook {
  _id?: string
  id: string
  name: string
}

// Build a display name with parent hierarchy
function getProjectDisplayName(project: Project, allProjects: Project[]): string {
  if (!project.parent_project_id) return project.name
  const parent = allProjects.find(p => (p._id || p.id) === project.parent_project_id)
  if (parent) {
    return `${getProjectDisplayName(parent, allProjects)} > ${project.name}`
  }
  return project.name
}

export function MyActiveTasksWidget({ widgetId }: WidgetProps) {
  const { user, tasks, queues, loading, fetchTasks, updateTaskLocally, viewingUserId, setViewingUserId } = useAppStore()
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all')
  const [users, setUsers] = useState<UserType[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Top add task (adds to top of list)
  const [topTaskTitle, setTopTaskTitle] = useState('')
  const [topTaskProjectId, setTopTaskProjectId] = useState('')
  const [topTaskProjectQuery, setTopTaskProjectQuery] = useState('')
  const [topTaskInstructions, setTopTaskInstructions] = useState('')
  const [isCreatingTop, setIsCreatingTop] = useState(false)
  const [showTopProjectDropdown, setShowTopProjectDropdown] = useState(false)
  // Bottom add task (adds to bottom of list)
  const [bottomTaskTitle, setBottomTaskTitle] = useState('')
  const [bottomTaskProjectId, setBottomTaskProjectId] = useState('')
  const [bottomTaskProjectQuery, setBottomTaskProjectQuery] = useState('')
  const [bottomTaskInstructions, setBottomTaskInstructions] = useState('')
  const [isCreatingBottom, setIsCreatingBottom] = useState(false)
  const [showBottomProjectDropdown, setShowBottomProjectDropdown] = useState(false)
  // Create project inline state
  const [showTopCreateProject, setShowTopCreateProject] = useState(false)
  const [topNewProjectName, setTopNewProjectName] = useState('')
  const [isCreatingTopProject, setIsCreatingTopProject] = useState(false)
  const [showBottomCreateProject, setShowBottomCreateProject] = useState(false)
  const [bottomNewProjectName, setBottomNewProjectName] = useState('')
  const [isCreatingBottomProject, setIsCreatingBottomProject] = useState(false)
  // Edit panel state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPlaybookId, setEditPlaybookId] = useState<string>('')
  const [editDuration, setEditDuration] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  // Timer modal state
  const [showTimerModal, setShowTimerModal] = useState(false)
  // Undo state
  const [undoInfo, setUndoInfo] = useState<{ taskId: string; title: string } | null>(null)
  // Suggestions state
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false)
  const [suggestionsResult, setSuggestionsResult] = useState<{ generated: number; tasks_analyzed: number } | null>(null)
  // Check completed state
  const [isCheckingCompleted, setIsCheckingCompleted] = useState(false)
  const [checkCompletedResult, setCheckCompletedResult] = useState<{ completed: number; updated: number; checked: number; total: number; skipped: number; errors: number } | null>(null)
  // Refs
  const topTitleRef = useRef<HTMLInputElement>(null)
  const topProjectRef = useRef<HTMLInputElement>(null)
  const topInstructionsRef = useRef<HTMLTextAreaElement>(null)
  const bottomTitleRef = useRef<HTMLInputElement>(null)
  const bottomProjectRef = useRef<HTMLInputElement>(null)
  const bottomInstructionsRef = useRef<HTMLTextAreaElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)
  const editDurationRef = useRef<HTMLInputElement>(null)
  const editInstructionsRef = useRef<HTMLTextAreaElement>(null)
  const editPlaybookRef = useRef<HTMLSelectElement>(null)
  const editDoneRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)
  const topNewProjectRef = useRef<HTMLInputElement>(null)
  const bottomNewProjectRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getUsers().then(setUsers).catch(console.error)
    api.getTeams().then(setTeams).catch(console.error)
    api.getPlaybooks({ active_only: true }).then(setPlaybooks).catch(console.error)
    api.getProjects({ status: 'active' }).then(setProjects).catch(console.error)
  }, [])

  // Re-fetch tasks when viewing user changes
  useEffect(() => {
    if (viewingUserId) {
      fetchTasks(undefined, viewingUserId)
    } else if (user?.id) {
      fetchTasks(undefined, user.id)
    }
  }, [viewingUserId, user?.id, fetchTasks])

  const getQueueDisplayName = (queue: { scope_type: string; scope_id?: string; purpose: string }): string => {
    if (queue.scope_type === 'user') {
      if (queue.scope_id === user?.id) {
        return `${user?.name || 'You'} > ${queue.purpose}`
      }
      const owner = users.find((u) => (u._id || u.id) === queue.scope_id)
      return owner ? `${owner.name} > ${queue.purpose}` : queue.purpose
    }
    if (queue.scope_type === 'team') {
      const team = teams.find((t) => (t._id || t.id) === queue.scope_id)
      return team ? `${team.name} > ${queue.purpose}` : queue.purpose
    }
    return `Everyone > ${queue.purpose}`
  }

  // Determine which user's tasks to show
  const displayUserId = viewingUserId || user?.id
  const displayUser = viewingUserId ? users.find(u => (u._id || u.id) === viewingUserId) : user
  const isViewingOther = viewingUserId && viewingUserId !== user?.id

  const allActiveTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))

  // Sort: starred first, then by sequence (ascending), then by created_at
  const sortedActiveTasks = [...allActiveTasks].sort((a, b) => {
    const starA = a.is_starred ? 0 : 1
    const starB = b.is_starred ? 0 : 1
    if (starA !== starB) return starA - starB
    const seqA = a.sequence ?? Number.MAX_VALUE
    const seqB = b.sequence ?? Number.MAX_VALUE
    if (seqA !== seqB) return seqA - seqB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const activeTasks = selectedQueueFilter === 'all'
    ? sortedActiveTasks
    : sortedActiveTasks.filter((t) => t.queue_id === selectedQueueFilter)

  const userQueues = queues.filter((q) => q.scope_type === 'user' && q.scope_id === displayUserId)
  const teamQueues = queues.filter((q) => q.scope_type === 'team')
  const orgQueues = queues.filter((q) => q.scope_type === 'organization')

  // Widget title changes based on whose tasks we're viewing
  const widgetTitle = isViewingOther
    ? `${displayUser?.name || 'User'}'s Active Tasks`
    : 'My Active Tasks'

  // Generate AI suggestions for tasks
  const handleGenerateSuggestions = async () => {
    if (isGeneratingSuggestions) return
    setIsGeneratingSuggestions(true)
    setSuggestionsResult(null)
    try {
      const result = await api.generateTaskSuggestions()
      setSuggestionsResult({ generated: result.generated, tasks_analyzed: result.tasks_analyzed })
      // Suggestions are saved to DB; users will see them when opening individual tasks
      setTimeout(() => setSuggestionsResult(null), 5000)
    } catch (err) {
      console.error('Failed to generate suggestions:', err)
      setSuggestionsResult({ generated: -1, tasks_analyzed: 0 })
      setTimeout(() => setSuggestionsResult(null), 5000)
    } finally {
      setIsGeneratingSuggestions(false)
    }
  }

  // Check for completed tasks via Slack thread resolution
  const handleCheckCompleted = async () => {
    if (isCheckingCompleted) return
    setIsCheckingCompleted(true)
    setCheckCompletedResult(null)
    try {
      const result = await api.checkCompletedTasks()
      setCheckCompletedResult({
        completed: result.tasks_completed,
        updated: result.tasks_updated,
        checked: result.tasks_checked,
        total: result.tasks_total,
        skipped: result.tasks_skipped,
        errors: result.errors,
      })
      if (result.tasks_completed > 0) {
        fetchTasks()
      }
      setTimeout(() => setCheckCompletedResult(null), 8000)
    } catch (err) {
      console.error('Failed to check completed tasks:', err)
      setCheckCompletedResult({ completed: -1, updated: 0, checked: 0, total: 0, skipped: 0, errors: 0 })
      setTimeout(() => setCheckCompletedResult(null), 8000)
    } finally {
      setIsCheckingCompleted(false)
    }
  }

  const headerAction = (
    <div className="flex items-center gap-2">
      {isViewingOther && (
        <button
          onClick={() => setViewingUserId(null)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          ← Back to mine
        </button>
      )}
      <button
        onClick={handleCheckCompleted}
        disabled={isCheckingCompleted || activeTasks.length === 0}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Check Slack threads for resolved tasks"
      >
        {isCheckingCompleted ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
        {isCheckingCompleted ? 'Checking...' : 'Check Resolved'}
      </button>
      <button
        onClick={handleGenerateSuggestions}
        disabled={isGeneratingSuggestions || activeTasks.length === 0}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="AI-analyze top tasks and suggest next actions"
      >
        {isGeneratingSuggestions ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {isGeneratingSuggestions ? 'Analyzing...' : 'Suggestions'}
      </button>
      <span className="text-xs text-gray-500">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
    </div>
  )

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

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault()
    setDragOverTaskId(null)

    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null)
      return
    }

    const draggedIndex = activeTasks.findIndex((t) => (t._id || t.id) === draggedTaskId)
    const targetIndex = activeTasks.findIndex((t) => (t._id || t.id) === targetTaskId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTaskId(null)
      return
    }

    // Calculate new sequence value
    let newSequence: number
    const targetTask = activeTasks[targetIndex]
    const targetSeq = targetTask.sequence ?? 0

    if (draggedIndex < targetIndex) {
      // Moving down - place after target (need LARGER sequence)
      const nextTask = activeTasks[targetIndex + 1]
      if (nextTask) {
        const nextSeq = nextTask.sequence ?? targetSeq + 2
        newSequence = (targetSeq + nextSeq) / 2
      } else {
        newSequence = targetSeq + 1
      }
    } else {
      // Moving up - place before target (need SMALLER sequence)
      const prevTask = activeTasks[targetIndex - 1]
      if (prevTask) {
        const prevSeq = prevTask.sequence ?? targetSeq - 2
        newSequence = (prevSeq + targetSeq) / 2
      } else {
        newSequence = targetSeq - 1
      }
    }

    // Optimistic local update for reorder
    updateTaskLocally(draggedTaskId, { sequence: newSequence })
    setDraggedTaskId(null)

    // Persist via API
    const items: TaskReorderItem[] = [{ id: draggedTaskId, sequence: newSequence }]
    try {
      await api.reorderTasks(items)
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      fetchTasks() // Revert on error
    }
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  // Get user's default queue for quick task creation
  const defaultQueue = userQueues[0]

  // Create task at top (low sequence number)
  const handleCreateTopTask = async () => {
    if (!topTaskTitle.trim() || !defaultQueue || isCreatingTop) return

    setIsCreatingTop(true)
    try {
      // Calculate sequence to put at top (lower than first task)
      const firstTask = activeTasks[0]
      const topSequence = firstTask?.sequence ? firstTask.sequence - 1 : 0

      // Create the task and use the returned ID directly (avoids race condition)
      const newTask = await api.createTask({
        queue_id: defaultQueue._id || defaultQueue.id,
        title: topTaskTitle.trim(),
        description: topTaskInstructions.trim() || undefined,
        project_id: topTaskProjectId || undefined,
      })

      // Reorder to put at top using the task ID from the response
      const taskId = newTask._id || newTask.id
      if (taskId) {
        await api.reorderTasks([{ id: taskId, sequence: topSequence }])
      }

      // Insert into store directly instead of re-fetching
      // Filter out any copy that WebSocket may have already added (race condition)
      const { tasks: currentTasks, setTasks } = useAppStore.getState()
      const newTaskId = newTask._id || newTask.id
      const deduped = currentTasks.filter(t => (t._id || t.id) !== newTaskId)
      setTasks([{ ...newTask, sequence: topSequence }, ...deduped])

      setTopTaskTitle('')
      setTopTaskProjectId('')
      setTopTaskProjectQuery('')
      setTopTaskInstructions('')
      setTimeout(() => topTitleRef.current?.focus(), 0)
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsCreatingTop(false)
    }
  }

  // Create task at bottom (high sequence number)
  const handleCreateBottomTask = async () => {
    if (!bottomTaskTitle.trim() || !defaultQueue || isCreatingBottom) return

    setIsCreatingBottom(true)
    try {
      const newTask = await api.createTask({
        queue_id: defaultQueue._id || defaultQueue.id,
        title: bottomTaskTitle.trim(),
        description: bottomTaskInstructions.trim() || undefined,
        project_id: bottomTaskProjectId || undefined,
      })
      // Insert into store directly instead of re-fetching
      // Filter out any copy that WebSocket may have already added (race condition)
      const { tasks: currentTasks, setTasks } = useAppStore.getState()
      const newTaskId = newTask._id || newTask.id
      const deduped = currentTasks.filter(t => (t._id || t.id) !== newTaskId)
      setTasks([...deduped, newTask])

      setBottomTaskTitle('')
      setBottomTaskProjectId('')
      setBottomTaskProjectQuery('')
      setBottomTaskInstructions('')
      setTimeout(() => bottomTitleRef.current?.focus(), 0)
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setIsCreatingBottom(false)
    }
  }

  // Top input handlers
  const handleTopTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (topTaskTitle.trim()) {
        handleCreateTopTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey && topTaskTitle.trim()) {
      e.preventDefault()
      topProjectRef.current?.focus()
      setShowTopProjectDropdown(true)
    }
  }

  const handleTopProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // If dropdown is showing and there's a matching project, select it
      const filteredProjects = projects.filter(p =>
        getProjectDisplayName(p, projects).toLowerCase().includes(topTaskProjectQuery.toLowerCase())
      )
      if (filteredProjects.length === 1) {
        setTopTaskProjectId(filteredProjects[0]._id || filteredProjects[0].id)
        setTopTaskProjectQuery(getProjectDisplayName(filteredProjects[0], projects))
      }
      setShowTopProjectDropdown(false)
      if (topTaskTitle.trim()) {
        handleCreateTopTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      setShowTopProjectDropdown(false)
      topInstructionsRef.current?.focus()
    } else if (e.key === 'Escape') {
      setShowTopProjectDropdown(false)
    }
  }

  const handleTopInstructionsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (topTaskTitle.trim()) {
        handleCreateTopTask()
      }
    }
  }

  // Bottom input handlers
  const handleBottomTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (bottomTaskTitle.trim()) {
        handleCreateBottomTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey && bottomTaskTitle.trim()) {
      e.preventDefault()
      bottomProjectRef.current?.focus()
      setShowBottomProjectDropdown(true)
    }
  }

  const handleBottomProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // If dropdown is showing and there's a matching project, select it
      const filteredProjects = projects.filter(p =>
        getProjectDisplayName(p, projects).toLowerCase().includes(bottomTaskProjectQuery.toLowerCase())
      )
      if (filteredProjects.length === 1) {
        setBottomTaskProjectId(filteredProjects[0]._id || filteredProjects[0].id)
        setBottomTaskProjectQuery(getProjectDisplayName(filteredProjects[0], projects))
      }
      setShowBottomProjectDropdown(false)
      if (bottomTaskTitle.trim()) {
        handleCreateBottomTask()
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      setShowBottomProjectDropdown(false)
      bottomInstructionsRef.current?.focus()
    } else if (e.key === 'Escape') {
      setShowBottomProjectDropdown(false)
    }
  }

  const handleBottomInstructionsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (bottomTaskTitle.trim()) {
        handleCreateBottomTask()
      }
    }
  }

  // Start editing a task in the side panel
  const startEditing = (taskId: string) => {
    const task = activeTasks.find(t => (t._id || t.id) === taskId)
    if (task) {
      setEditingTaskId(taskId)
      setEditTitle(task.title)
      setEditProjectId(task.project_id || '')
      setEditDescription(task.description || '')
      setEditPlaybookId(task.playbook_id || '')
      setEditDuration(formatDuration(task.estimated_duration))
      setTimeout(() => editTitleRef.current?.focus(), 0)
    }
  }

  // Save edited task
  const saveEditedTask = async () => {
    await saveEditedTaskImpl()
  }

  // Internal save implementation - accepts optional overrides for values that may not be in state yet
  const saveEditedTaskImpl = async (overrides?: { projectId?: string; duration?: string }) => {
    if (!editingTaskId || isSaving) return

    const originalTask = activeTasks.find(t => (t._id || t.id) === editingTaskId)
    if (!originalTask) return

    // Use override if provided, otherwise use state
    const projectIdToSave = overrides?.projectId !== undefined ? overrides.projectId : editProjectId
    const durationToSave = overrides?.duration !== undefined ? overrides.duration : editDuration
    const parsedDuration = parseDuration(durationToSave)

    // Only save if something changed
    const titleChanged = editTitle !== originalTask.title
    const projectChanged = projectIdToSave !== (originalTask.project_id || '')
    const descChanged = editDescription !== (originalTask.description || '')
    const playbookChanged = editPlaybookId !== (originalTask.playbook_id || '')
    const durationChanged = parsedDuration !== (originalTask.estimated_duration || null)

    if (!titleChanged && !projectChanged && !descChanged && !playbookChanged && !durationChanged) {
      return
    }

    if (!editTitle.trim()) return

    // Optimistic local update
    const updates: Partial<Task> = {
      title: editTitle.trim(),
      project_id: projectIdToSave || undefined,
      description: editDescription.trim() || undefined,
      playbook_id: editPlaybookId || undefined,
      estimated_duration: parsedDuration ?? undefined,
    }
    updateTaskLocally(editingTaskId, updates)

    setIsSaving(true)
    try {
      await api.updateTask(editingTaskId, {
        title: editTitle.trim(),
        project_id: projectIdToSave || undefined,
        description: editDescription.trim() || undefined,
        playbook_id: editPlaybookId || undefined,
        estimated_duration: parsedDuration,
      })
    } catch (err) {
      console.error('Failed to update task:', err)
      fetchTasks() // Revert on error
    } finally {
      setIsSaving(false)
    }
  }

  // Close the edit panel
  const closeEditPanel = async () => {
    if (editingTaskId) {
      await saveEditedTask()
    }
    setEditingTaskId(null)
    setEditTitle('')
    setEditProjectId('')
    setEditDescription('')
    setEditPlaybookId('')
    setEditDuration('')
  }

  // Quick complete a task
  const handleQuickComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation() // Don't trigger task selection
    if (completingTaskId) return

    const task = activeTasks.find(t => (t._id || t.id) === taskId)
    const taskTitle = task?.title || 'Task'

    setCompletingTaskId(taskId)
    try {
      await api.quickCompleteTask(taskId)
      // Optimistically remove from local state to preserve scroll position
      const { tasks: currentTasks, setTasks } = useAppStore.getState()
      setTasks(currentTasks.filter(t => (t._id || t.id) !== taskId))
      // Close edit panel if we completed the task being edited
      if (editingTaskId === taskId) {
        setEditingTaskId(null)
        setEditTitle('')
        setEditProjectId('')
        setEditDescription('')
        setEditPlaybookId('')
        setEditDuration('')
      }
      setUndoInfo({ taskId, title: taskTitle })
    } catch (err) {
      console.error('Failed to complete task:', err)
      fetchTasks() // Refetch on error to restore correct state
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleUndo = useCallback(async () => {
    if (!undoInfo) return
    try {
      const reopened = await api.reopenTask(undoInfo.taskId)
      // Insert reopened task back into store
      const { tasks: currentTasks, setTasks } = useAppStore.getState()
      if (!currentTasks.find(t => (t._id || t.id) === undoInfo.taskId)) {
        setTasks([reopened, ...currentTasks])
      }
    } catch (err) {
      console.error('Failed to reopen task:', err)
    }
  }, [undoInfo])

  const handleToggleStar = useToggleStar()

  // Handle inline duration save from TaskList component
  const handleDurationSave = async (taskId: string, newSeconds: number | null) => {
    // Optimistic local update
    updateTaskLocally(taskId, { estimated_duration: newSeconds ?? undefined })
    // Update edit panel if same task is being edited
    if (editingTaskId === taskId) {
      setEditDuration(formatDuration(newSeconds || undefined))
    }
    try {
      await api.updateTask(taskId, { estimated_duration: newSeconds })
    } catch (err) {
      console.error('Failed to update duration:', err)
      fetchTasks() // Revert on error
    }
  }

  const handleCreateTopProject = async () => {
    if (!topNewProjectName.trim() || isCreatingTopProject) return
    setIsCreatingTopProject(true)
    try {
      const created = await api.createProject({ name: topNewProjectName.trim() })
      const projectId = created._id || created.id
      // Refresh projects list and select the new one
      const updatedProjects = await api.getProjects({ status: 'active' })
      setProjects(updatedProjects)
      setTopTaskProjectId(projectId)
      setTopTaskProjectQuery(topNewProjectName.trim())
      setTopNewProjectName('')
      setShowTopCreateProject(false)
    } catch (err) {
      console.error('Failed to create project:', err)
    } finally {
      setIsCreatingTopProject(false)
    }
  }

  const handleCreateBottomProject = async () => {
    if (!bottomNewProjectName.trim() || isCreatingBottomProject) return
    setIsCreatingBottomProject(true)
    try {
      const created = await api.createProject({ name: bottomNewProjectName.trim() })
      const projectId = created._id || created.id
      // Refresh projects list and select the new one
      const updatedProjects = await api.getProjects({ status: 'active' })
      setProjects(updatedProjects)
      setBottomTaskProjectId(projectId)
      setBottomTaskProjectQuery(bottomNewProjectName.trim())
      setBottomNewProjectName('')
      setShowBottomCreateProject(false)
    } catch (err) {
      console.error('Failed to create project:', err)
    } finally {
      setIsCreatingBottomProject(false)
    }
  }

  return (
  <>
    <WidgetWrapper widgetId={widgetId} title={widgetTitle} headerAction={headerAction}>
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-gray-100">
          <button
            onClick={() => setSelectedQueueFilter('all')}
            className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedQueueFilter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({allActiveTasks.length})
          </button>
          {userQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
          {teamQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
          {orgQueues.map((queue) => {
            const count = allActiveTasks.filter((t) => t.queue_id === (queue._id || queue.id)).length
            return (
              <button
                key={queue._id || queue.id}
                onClick={() => setSelectedQueueFilter(queue._id || queue.id)}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                  selectedQueueFilter === (queue._id || queue.id)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getQueueDisplayName(queue)} ({count})
              </button>
            )
          })}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Task list (left side) */}
          <div className={`${editingTaskId ? 'w-1/2' : 'flex-1'} overflow-auto border-r border-gray-100 transition-all`} ref={dragRef}>
            {/* Top quick task creation (adds to top of list) */}
            {defaultQueue && (
              <div className="flex items-start gap-2 px-2 py-1.5 border-b border-gray-100 bg-blue-50/30">
                <div className="flex-shrink-0 text-blue-400 pt-0.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      ref={topTitleRef}
                      type="text"
                      placeholder="Add priority task..."
                      value={topTaskTitle}
                      onChange={(e) => setTopTaskTitle(e.target.value)}
                      onKeyDown={handleTopTitleKeyDown}
                      onFocus={() => setEditingTaskId(null)}
                      disabled={isCreatingTop}
                      className="flex-1 text-xs font-medium text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none focus:ring-0 p-0"
                    />
                    {topTaskTitle && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {showTopCreateProject ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={topNewProjectRef}
                              type="text"
                              placeholder="New project name..."
                              value={topNewProjectName}
                              onChange={(e) => setTopNewProjectName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && topNewProjectName.trim()) {
                                  e.preventDefault()
                                  handleCreateTopProject()
                                } else if (e.key === 'Escape') {
                                  setShowTopCreateProject(false)
                                  setTopNewProjectName('')
                                }
                              }}
                              disabled={isCreatingTopProject}
                              className="w-28 text-xs text-gray-600 placeholder-gray-400 bg-white border border-primary-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary-200"
                            />
                            <button
                              type="button"
                              onClick={handleCreateTopProject}
                              disabled={!topNewProjectName.trim() || isCreatingTopProject}
                              className="p-0.5 text-primary-600 hover:text-primary-700 disabled:opacity-50"
                              title="Create project"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowTopCreateProject(false)
                                setTopNewProjectName('')
                              }}
                              className="p-0.5 text-gray-400 hover:text-gray-600"
                              title="Cancel"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative w-24">
                              <input
                                ref={topProjectRef}
                                type="text"
                                placeholder="Project..."
                                value={topTaskProjectQuery}
                                onChange={(e) => {
                                  setTopTaskProjectQuery(e.target.value)
                                  setShowTopProjectDropdown(true)
                                  // Clear selection if typing
                                  if (topTaskProjectId) {
                                    const selectedProject = projects.find(p => (p._id || p.id) === topTaskProjectId)
                                    if (selectedProject && getProjectDisplayName(selectedProject, projects) !== e.target.value) {
                                      setTopTaskProjectId('')
                                    }
                                  }
                                }}
                                onFocus={() => setShowTopProjectDropdown(true)}
                                onBlur={() => setTimeout(() => setShowTopProjectDropdown(false), 200)}
                                onKeyDown={handleTopProjectKeyDown}
                                disabled={isCreatingTop}
                                className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                              />
                              {showTopProjectDropdown && topTaskProjectQuery && (
                                <div className="absolute z-10 top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto min-w-max">
                                  {projects
                                    .filter(p => getProjectDisplayName(p, projects).toLowerCase().includes(topTaskProjectQuery.toLowerCase()))
                                    .slice(0, 5)
                                    .map(project => (
                                      <div
                                        key={project._id || project.id}
                                        className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                                        onMouseDown={() => {
                                          setTopTaskProjectId(project._id || project.id)
                                          setTopTaskProjectQuery(getProjectDisplayName(project, projects))
                                          setShowTopProjectDropdown(false)
                                        }}
                                      >
                                        {getProjectDisplayName(project, projects)}
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowTopCreateProject(true)
                                setTimeout(() => topNewProjectRef.current?.focus(), 0)
                              }}
                              disabled={isCreatingTop}
                              className="p-1 text-gray-500 hover:text-primary-600 hover:bg-primary-50 border border-gray-200 rounded transition-colors"
                              title="Create new project"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {topTaskTitle && (
                    <textarea
                      ref={topInstructionsRef}
                      placeholder="Instructions (Tab to focus, Enter to save)"
                      value={topTaskInstructions}
                      onChange={(e) => setTopTaskInstructions(e.target.value)}
                      onKeyDown={handleTopInstructionsKeyDown}
                      disabled={isCreatingTop}
                      rows={2}
                      className="w-full mt-1 text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
                    />
                  )}
                </div>
              </div>
            )}

            {loading.tasks ? (
              <div className="p-3 text-xs text-gray-500">Loading...</div>
            ) : activeTasks.length === 0 && !topTaskTitle && !bottomTaskTitle ? (
              <div className="p-3 text-xs text-gray-500">No active tasks</div>
            ) : (
              <TaskList
                tasks={activeTasks}
                projects={projects}
                queues={queues}
                columns={{ showDuration: true, showProject: true, editableDuration: true }}
                selectedTaskId={editingTaskId}
                completingTaskId={completingTaskId}
                onTaskClick={startEditing}
                onQuickComplete={handleQuickComplete}
                onToggleStar={handleToggleStar}
                onTaskDoubleClick={setSelectedTaskId}
                draggable
                dragState={{ draggedTaskId, dragOverTaskId }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e, taskId) => handleDrop(e, taskId)}
                onDragEnd={handleDragEnd}
                onDurationSave={handleDurationSave}
                emptyMessage="No active tasks"
              />
            )}

            {/* Bottom quick task creation (adds to bottom of list) */}
            {defaultQueue && (
              <div className="flex items-start gap-2 px-2 py-1.5 border-t border-gray-100 bg-gray-50/30">
                <div className="flex-shrink-0 text-gray-400 pt-0.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      ref={bottomTitleRef}
                      type="text"
                      placeholder="Add task..."
                      value={bottomTaskTitle}
                      onChange={(e) => setBottomTaskTitle(e.target.value)}
                      onKeyDown={handleBottomTitleKeyDown}
                      onFocus={() => setEditingTaskId(null)}
                      disabled={isCreatingBottom}
                      className="flex-1 text-xs font-medium text-gray-900 placeholder-gray-400 bg-transparent border-none outline-none focus:ring-0 p-0"
                    />
                    {bottomTaskTitle && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {showBottomCreateProject ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={bottomNewProjectRef}
                              type="text"
                              placeholder="New project name..."
                              value={bottomNewProjectName}
                              onChange={(e) => setBottomNewProjectName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && bottomNewProjectName.trim()) {
                                  e.preventDefault()
                                  handleCreateBottomProject()
                                } else if (e.key === 'Escape') {
                                  setShowBottomCreateProject(false)
                                  setBottomNewProjectName('')
                                }
                              }}
                              disabled={isCreatingBottomProject}
                              className="w-28 text-xs text-gray-600 placeholder-gray-400 bg-white border border-primary-300 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary-200"
                            />
                            <button
                              type="button"
                              onClick={handleCreateBottomProject}
                              disabled={!bottomNewProjectName.trim() || isCreatingBottomProject}
                              className="p-0.5 text-primary-600 hover:text-primary-700 disabled:opacity-50"
                              title="Create project"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowBottomCreateProject(false)
                                setBottomNewProjectName('')
                              }}
                              className="p-0.5 text-gray-400 hover:text-gray-600"
                              title="Cancel"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="relative w-24">
                              <input
                                ref={bottomProjectRef}
                                type="text"
                                placeholder="Project..."
                                value={bottomTaskProjectQuery}
                                onChange={(e) => {
                                  setBottomTaskProjectQuery(e.target.value)
                                  setShowBottomProjectDropdown(true)
                                  // Clear selection if typing
                                  if (bottomTaskProjectId) {
                                    const selectedProject = projects.find(p => (p._id || p.id) === bottomTaskProjectId)
                                    if (selectedProject && getProjectDisplayName(selectedProject, projects) !== e.target.value) {
                                      setBottomTaskProjectId('')
                                    }
                                  }
                                }}
                                onFocus={() => setShowBottomProjectDropdown(true)}
                                onBlur={() => setTimeout(() => setShowBottomProjectDropdown(false), 200)}
                                onKeyDown={handleBottomProjectKeyDown}
                                disabled={isCreatingBottom}
                                className="w-full text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                              />
                              {showBottomProjectDropdown && bottomTaskProjectQuery && (
                                <div className="absolute z-10 bottom-full left-0 mb-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto min-w-max">
                                  {projects
                                    .filter(p => getProjectDisplayName(p, projects).toLowerCase().includes(bottomTaskProjectQuery.toLowerCase()))
                                    .slice(0, 5)
                                    .map(project => (
                                      <div
                                        key={project._id || project.id}
                                        className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                                        onMouseDown={() => {
                                          setBottomTaskProjectId(project._id || project.id)
                                          setBottomTaskProjectQuery(getProjectDisplayName(project, projects))
                                          setShowBottomProjectDropdown(false)
                                        }}
                                      >
                                        {getProjectDisplayName(project, projects)}
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowBottomCreateProject(true)
                                setTimeout(() => bottomNewProjectRef.current?.focus(), 0)
                              }}
                              disabled={isCreatingBottom}
                              className="p-1 text-gray-500 hover:text-primary-600 hover:bg-primary-50 border border-gray-200 rounded transition-colors"
                              title="Create new project"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {bottomTaskTitle && (
                    <textarea
                      ref={bottomInstructionsRef}
                      placeholder="Instructions (Tab to focus, Enter to save)"
                      value={bottomTaskInstructions}
                      onChange={(e) => setBottomTaskInstructions(e.target.value)}
                      onKeyDown={handleBottomInstructionsKeyDown}
                      disabled={isCreatingBottom}
                      rows={2}
                      className="w-full mt-1 text-xs text-gray-600 placeholder-gray-400 bg-white border border-gray-200 rounded px-2 py-1 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Editable detail panel (right side) - shows on click */}
          {editingTaskId && (() => {
            const editingTask = activeTasks.find(t => (t._id || t.id) === editingTaskId)
            if (!editingTask) return null
            return (
              <div className="w-1/2 p-3 overflow-auto bg-gray-50/50 border-l border-gray-200">
                <div className="space-y-3">
                  {/* Start Timer button and action icons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTimerModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
                    >
                      <Timer className="w-4 h-4" />
                      Start Focus
                    </button>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={(e) => handleQuickComplete(e, editingTaskId)}
                        disabled={completingTaskId === editingTaskId}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Mark as done"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowTimerModal(true)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Start timer"
                      >
                        <Timer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSelectedTaskId(editingTaskId)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Open full details"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        ref={editDoneRef}
                        onClick={closeEditPanel}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            closeEditPanel()
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Source URL link */}
                  {editingTask.source_url && (
                    <a
                      href={editingTask.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View original message
                    </a>
                  )}

                  {/* Editable title */}
                  <div>
                    <input
                      ref={editTitleRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={saveEditedTask}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          saveEditedTask()
                        } else if (e.key === 'Escape') {
                          closeEditPanel()
                        } else if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault()
                          editDurationRef.current?.focus()
                        }
                      }}
                      disabled={isSaving}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                      placeholder="Task title"
                    />
                  </div>

                  {/* Estimated duration */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                      Est. Duration (H:MM)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        ref={editDurationRef}
                        type="text"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        onBlur={saveEditedTask}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            saveEditedTask()
                          } else if (e.key === 'Escape') {
                            closeEditPanel()
                          } else if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault()
                            editInstructionsRef.current?.focus()
                          }
                        }}
                        disabled={isSaving}
                        placeholder="0:10"
                        className="w-16 text-xs text-gray-700 font-mono bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                      />
                    </div>
                  </div>

                  {/* Project selector */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                      Project
                    </label>
                    <ProjectTypeahead
                      projects={projects.map(p => ({ id: p._id || p.id, name: p.name, parent_project_id: p.parent_project_id }))}
                      selectedProjectId={editProjectId || null}
                      onChange={(projectId) => {
                        setEditProjectId(projectId || '')
                        // Pass projectId directly to avoid stale state
                        saveEditedTaskImpl({ projectId: projectId || '' })
                      }}
                      onProjectCreated={() => {
                        // Refresh projects list after creating a new one
                        api.getProjects({ status: 'active' }).then(setProjects).catch(console.error)
                      }}
                      placeholder="Search projects..."
                      disabled={isSaving}
                      className="text-xs"
                    />
                  </div>

                  {/* Editable instructions */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                      Instructions
                    </label>
                    <textarea
                      ref={editInstructionsRef}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      onBlur={saveEditedTask}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          closeEditPanel()
                        } else if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault()
                          editPlaybookRef.current?.focus()
                        }
                      }}
                      disabled={isSaving}
                      rows={4}
                      className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 resize-none"
                      placeholder="Add instructions..."
                    />
                  </div>

                  {/* Playbook selector */}
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                      Playbook
                    </label>
                    <select
                      ref={editPlaybookRef}
                      value={editPlaybookId}
                      onChange={(e) => setEditPlaybookId(e.target.value)}
                      onBlur={saveEditedTask}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          closeEditPanel()
                        } else if (e.key === 'Escape') {
                          closeEditPanel()
                        } else if (e.key === 'Tab' && !e.shiftKey) {
                          e.preventDefault()
                          editDoneRef.current?.focus()
                        }
                      }}
                      disabled={isSaving}
                      className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                    >
                      <option value="">No playbook</option>
                      {playbooks.map((pb) => (
                        <option key={pb._id || pb.id} value={pb._id || pb.id}>
                          {pb.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {activeTasks.length > 10 && (
          <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
            <Link to="/tasks" className="text-primary-600 hover:text-primary-700 text-xs font-medium">
              View all tasks
            </Link>
          </div>
        )}
      </div>
    </WidgetWrapper>

    {selectedTaskId && createPortal(
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={() => fetchTasks()}
      />,
      document.body
    )}

    {/* Timer Modal */}
    {editingTaskId && (() => {
      const editingTask = activeTasks.find(t => (t._id || t.id) === editingTaskId)
      return (
        <StartTimerModal
          isOpen={showTimerModal}
          onClose={() => setShowTimerModal(false)}
          context={{
            type: 'task',
            taskId: editingTaskId,
            taskTitle: editTitle || 'Task',
          }}
          defaultDuration={editingTask?.estimated_duration}
        />
      )
    })()}

    {undoInfo && (
      <UndoToast
        message={`"${undoInfo.title}" completed`}
        onUndo={handleUndo}
        onDismiss={() => setUndoInfo(null)}
      />
    )}

    {suggestionsResult && (
      <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 animate-in slide-in-from-bottom-2">
        {suggestionsResult.generated === -1 ? (
          <span className="text-sm text-red-600">Failed to generate suggestions. Try again.</span>
        ) : suggestionsResult.generated === 0 ? (
          <span className="text-sm text-gray-600">No suggestions found for {suggestionsResult.tasks_analyzed} task{suggestionsResult.tasks_analyzed !== 1 ? 's' : ''}.</span>
        ) : (
          <span className="text-sm text-green-700">
            <Sparkles className="w-4 h-4 inline mr-1" />
            Generated {suggestionsResult.generated} suggestion{suggestionsResult.generated !== 1 ? 's' : ''} across {suggestionsResult.tasks_analyzed} task{suggestionsResult.tasks_analyzed !== 1 ? 's' : ''}.
          </span>
        )}
        <button
          onClick={() => setSuggestionsResult(null)}
          className="p-0.5 text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    {checkCompletedResult && (
      <div className={`fixed ${suggestionsResult ? 'bottom-16' : 'bottom-4'} right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 animate-in slide-in-from-bottom-2`}>
        {checkCompletedResult.completed === -1 ? (
          <span className="text-sm text-red-600">Failed to check tasks. Try again.</span>
        ) : checkCompletedResult.completed === 0 && checkCompletedResult.updated === 0 ? (
          <span className="text-sm text-gray-600">
            Checked {checkCompletedResult.checked} Slack thread{checkCompletedResult.checked !== 1 ? 's' : ''} — no updates found.
            {checkCompletedResult.total > checkCompletedResult.checked && ` (${checkCompletedResult.total - checkCompletedResult.checked} task${checkCompletedResult.total - checkCompletedResult.checked !== 1 ? 's' : ''} without Slack threads skipped)`}
          </span>
        ) : (
          <span className="text-sm text-green-700">
            <Check className="w-4 h-4 inline mr-1" />
            {checkCompletedResult.completed > 0 && `Completed ${checkCompletedResult.completed} task${checkCompletedResult.completed !== 1 ? 's' : ''}`}
            {checkCompletedResult.completed > 0 && checkCompletedResult.updated > 0 && ', '}
            {checkCompletedResult.updated > 0 && `${checkCompletedResult.updated} updated with new messages`}
            {' '}({checkCompletedResult.checked} thread{checkCompletedResult.checked !== 1 ? 's' : ''} checked)
          </span>
        )}
        <button
          onClick={() => setCheckCompletedResult(null)}
          className="p-0.5 text-gray-400 hover:text-gray-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}
  </>
  )
}
