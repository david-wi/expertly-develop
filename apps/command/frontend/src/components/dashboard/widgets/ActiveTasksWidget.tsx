import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { useAppStore } from '../../../stores/appStore'
import { api, TaskReorderItem, Project } from '../../../services/api'
import TaskDetailModal from '../../../components/TaskDetailModal'
import TaskList from '../../../components/TaskList'
import UndoToast from '../../../components/UndoToast'
import { useToggleStar } from '../../../hooks/useToggleStar'

interface Playbook {
  _id?: string
  id: string
  name: string
}

export function ActiveTasksWidget({ widgetId, config }: WidgetProps) {
  const { user, tasks, queues, loading, fetchTasks, updateTaskLocally } = useAppStore()
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [undoInfo, setUndoInfo] = useState<{ taskId: string; title: string } | null>(null)

  useEffect(() => {
    api.getPlaybooks({ active_only: true }).then(setPlaybooks).catch(console.error)
    api.getProjects({ status: 'active' }).then(setProjects).catch(console.error)
  }, [])

  // Re-fetch tasks when user changes
  useEffect(() => {
    if (user?.id) {
      fetchTasks(undefined, user.id)
    }
  }, [user?.id, fetchTasks])

  // Get all active tasks
  const allActiveTasks = tasks.filter((t) => ['queued', 'checked_out', 'in_progress'].includes(t.status))

  // Apply filters based on config
  let filteredTasks = allActiveTasks

  // Filter by project(s)
  if (config.projectIds && config.projectIds.length > 0) {
    filteredTasks = filteredTasks.filter(t => t.project_id && config.projectIds!.includes(t.project_id))
  }

  // Filter by playbook
  if (config.playbookId) {
    filteredTasks = filteredTasks.filter(t => t.playbook_id === config.playbookId)
  }

  // Sort: starred first, then by sequence (ascending), then by created_at
  const activeTasks = [...filteredTasks].sort((a, b) => {
    const starA = a.is_starred ? 0 : 1
    const starB = b.is_starred ? 0 : 1
    if (starA !== starB) return starA - starB
    const seqA = a.sequence ?? Number.MAX_VALUE
    const seqB = b.sequence ?? Number.MAX_VALUE
    if (seqA !== seqB) return seqA - seqB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  // Generate widget title based on config
  const getWidgetTitle = (): string => {
    if (config.widgetTitle) return config.widgetTitle

    if (config.playbookId) {
      const playbook = playbooks.find(p => (p._id || p.id) === config.playbookId)
      return playbook ? `${playbook.name} Tasks` : 'Playbook Tasks'
    }

    if (config.projectIds && config.projectIds.length > 0) {
      if (config.projectIds.length === 1) {
        const project = projects.find(p => (p._id || p.id) === config.projectIds![0])
        return project ? `${project.name} Tasks` : 'Project Tasks'
      }
      return `${config.projectIds.length} Projects Tasks`
    }

    return 'Active Tasks'
  }

  const headerAction = (
    <span className="text-xs text-gray-500">{activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}</span>
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
      // Moving down - place after target
      const nextTask = activeTasks[targetIndex + 1]
      if (nextTask) {
        const nextSeq = nextTask.sequence ?? targetSeq + 2
        newSequence = (targetSeq + nextSeq) / 2
      } else {
        newSequence = targetSeq + 1
      }
    } else {
      // Moving up - place before target
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

  // Quick complete a task
  const handleQuickComplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    if (completingTaskId) return

    const task = activeTasks.find(t => (t._id || t.id) === taskId)
    const taskTitle = task?.title || 'Task'

    setCompletingTaskId(taskId)
    try {
      await api.quickCompleteTask(taskId)
      // Optimistically remove from local state
      const { tasks: currentTasks, setTasks } = useAppStore.getState()
      setTasks(currentTasks.filter(t => (t._id || t.id) !== taskId))
      setUndoInfo({ taskId, title: taskTitle })
    } catch (err) {
      console.error('Failed to complete task:', err)
      fetchTasks() // Revert on error
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleToggleStar = useToggleStar()

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

  // Build the "View All" link with appropriate filters
  const getViewAllLink = (): string => {
    const params = new URLSearchParams()
    if (config.projectIds && config.projectIds.length > 0) {
      params.set('project', config.projectIds[0])
    }
    if (config.playbookId) {
      params.set('playbook', config.playbookId)
    }
    const query = params.toString()
    return query ? `/queues?${query}` : '/queues'
  }

  return (
    <>
      <WidgetWrapper widgetId={widgetId} title={getWidgetTitle()} headerAction={headerAction}>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            {loading.tasks ? (
              <div className="p-3 text-xs text-gray-500">Loading...</div>
            ) : (
              <TaskList
                tasks={activeTasks}
                projects={projects}
                queues={queues}
                playbooks={playbooks}
                columns={{
                  showProject: !!config.playbookId,
                  showPlaybook: !!(config.projectIds && config.projectIds.length > 0),
                }}
                completingTaskId={completingTaskId}
                onTaskClick={setSelectedTaskId}
                onQuickComplete={handleQuickComplete}
                onToggleStar={handleToggleStar}
                draggable
                dragState={{ draggedTaskId, dragOverTaskId }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e, taskId) => handleDrop(e, taskId)}
                onDragEnd={handleDragEnd}
                emptyMessage="No active tasks"
              />
            )}
          </div>

          {activeTasks.length > 10 && (
            <div className="px-3 py-2 border-t border-gray-200 flex-shrink-0">
              <Link to={getViewAllLink()} className="text-primary-600 hover:text-primary-700 text-xs font-medium">
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

      {undoInfo && (
        <UndoToast
          message={`"${undoInfo.title}" completed`}
          onUndo={handleUndo}
          onDismiss={() => setUndoInfo(null)}
        />
      )}
    </>
  )
}
