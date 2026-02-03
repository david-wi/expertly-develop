import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, User as UserType, Team, TaskReorderItem, Project } from '../../../services/api'
import TaskDetailModal from '../../../components/TaskDetailModal'
import ProjectTypeahead from '../../../components/ProjectTypeahead'

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
  const { user, tasks, queues, loading, fetchTasks, viewingUserId, setViewingUserId } = useAppStore()
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
  // Edit panel state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editProjectId, setEditProjectId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPlaybookId, setEditPlaybookId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  // Refs
  const topTitleRef = useRef<HTMLInputElement>(null)
  const topProjectRef = useRef<HTMLInputElement>(null)
  const topInstructionsRef = useRef<HTMLTextAreaElement>(null)
  const bottomTitleRef = useRef<HTMLInputElement>(null)
  const bottomProjectRef = useRef<HTMLInputElement>(null)
  const bottomInstructionsRef = useRef<HTMLTextAreaElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)
  const editInstructionsRef = useRef<HTMLTextAreaElement>(null)
  const editPlaybookRef = useRef<HTMLSelectElement>(null)
  const editDoneRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

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

  // Sort by sequence (ascending), then by created_at for tasks without sequence
  const sortedActiveTasks = [...allActiveTasks].sort((a, b) => {
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

    // Update via API
    const items: TaskReorderItem[] = [{ id: draggedTaskId, sequence: newSequence }]
    try {
      await api.reorderTasks(items)
      // Refresh tasks
      fetchTasks()
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
    }

    setDraggedTaskId(null)
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

      await api.createTask({
        queue_id: defaultQueue._id || defaultQueue.id,
        title: topTaskTitle.trim(),
        description: topTaskInstructions.trim() || undefined,
        project_id: topTaskProjectId || undefined,
      })
      // Reorder to put at top
      const newTasks = await api.getTasks()
      const createdTask = newTasks.find(t => t.title === topTaskTitle.trim())
      if (createdTask) {
        await api.reorderTasks([{ id: createdTask._id || createdTask.id, sequence: topSequence }])
      }

      setTopTaskTitle('')
      setTopTaskProjectId('')
      setTopTaskProjectQuery('')
      setTopTaskInstructions('')
      fetchTasks()
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
      await api.createTask({
        queue_id: defaultQueue._id || defaultQueue.id,
        title: bottomTaskTitle.trim(),
        description: bottomTaskInstructions.trim() || undefined,
        project_id: bottomTaskProjectId || undefined,
      })
      setBottomTaskTitle('')
      setBottomTaskProjectId('')
      setBottomTaskProjectQuery('')
      setBottomTaskInstructions('')
      fetchTasks()
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
      setTimeout(() => editTitleRef.current?.focus(), 0)
    }
  }

  // Save edited task
  const saveEditedTask = async () => {
    if (!editingTaskId || isSaving) return

    const originalTask = activeTasks.find(t => (t._id || t.id) === editingTaskId)
    if (!originalTask) return

    // Only save if something changed
    const titleChanged = editTitle !== originalTask.title
    const projectChanged = editProjectId !== (originalTask.project_id || '')
    const descChanged = editDescription !== (originalTask.description || '')
    const playbookChanged = editPlaybookId !== (originalTask.playbook_id || '')

    if (!titleChanged && !projectChanged && !descChanged && !playbookChanged) {
      return
    }

    if (!editTitle.trim()) return

    setIsSaving(true)
    try {
      await api.updateTask(editingTaskId, {
        title: editTitle.trim(),
        project_id: editProjectId || undefined,
        description: editDescription.trim() || undefined,
        playbook_id: editPlaybookId || undefined,
      })
      fetchTasks()
    } catch (err) {
      console.error('Failed to update task:', err)
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
                      <div className="relative w-28 flex-shrink-0">
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
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto">
                            {projects
                              .filter(p => getProjectDisplayName(p, projects).toLowerCase().includes(topTaskProjectQuery.toLowerCase()))
                              .slice(0, 5)
                              .map(project => (
                                <div
                                  key={project._id || project.id}
                                  className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer truncate"
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
              <div className="divide-y divide-gray-100">
                {activeTasks.map((task) => {
                  const taskId = task._id || task.id
                  const queue = queues.find((q) => (q._id || q.id) === task.queue_id)
                  const queueName = queue ? getQueueDisplayName(queue) : 'Unknown'
                  const isDragging = draggedTaskId === taskId
                  const isDragOver = dragOverTaskId === taskId
                  const isSelected = editingTaskId === taskId
                  const taskProject = task.project_id ? projects.find(p => (p._id || p.id) === task.project_id) : null

                  return (
                    <div
                      key={taskId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, taskId)}
                      onDragOver={(e) => handleDragOver(e, taskId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, taskId)}
                      onDragEnd={handleDragEnd}
                      onClick={() => startEditing(taskId)}
                      className={`flex items-center gap-1.5 px-2 py-1 hover:bg-gray-50 transition-colors cursor-pointer ${
                        isDragging ? 'opacity-50 bg-gray-100' : ''
                      } ${isDragOver ? 'border-t-2 border-primary-500' : ''} ${isSelected ? 'bg-primary-50 border-l-2 border-primary-500' : ''}`}
                      title={queueName}
                    >
                      {/* Drag handle */}
                      <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                        </svg>
                      </div>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-primary-700' : 'text-gray-900'}`}>
                          {task.title}
                        </p>
                      </div>

                      {/* Project column */}
                      {taskProject && (
                        <div className="flex-shrink-0 w-24">
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate block">
                            {taskProject.name}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
                      <div className="relative w-28 flex-shrink-0">
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
                          <div className="absolute z-10 bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-auto">
                            {projects
                              .filter(p => getProjectDisplayName(p, projects).toLowerCase().includes(bottomTaskProjectQuery.toLowerCase()))
                              .slice(0, 5)
                              .map(project => (
                                <div
                                  key={project._id || project.id}
                                  className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer truncate"
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
                          editInstructionsRef.current?.focus()
                        }
                      }}
                      disabled={isSaving}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
                      placeholder="Task title"
                    />
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
                        setTimeout(() => saveEditedTask(), 0)
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

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <button
                      onClick={() => setSelectedTaskId(editingTaskId)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      More options...
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
                      className="px-3 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded"
                    >
                      Done
                    </button>
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

    {selectedTaskId && (
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={() => fetchTasks()}
      />
    )}
  </>
  )
}
