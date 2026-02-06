import { useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { api } from '../services/api'

/**
 * Shared hook for toggling the star/priority on a task.
 * Uses optimistic update with rollback on failure.
 */
export function useToggleStar() {
  return useCallback(async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    const { tasks, setTasks } = useAppStore.getState()
    const task = tasks.find(t => (t._id || t.id) === taskId)
    if (!task) return
    const newStarred = !task.is_starred
    // Optimistic update
    setTasks(tasks.map(t => (t._id || t.id) === taskId ? { ...t, is_starred: newStarred } : t))
    try {
      await api.updateTask(taskId, { is_starred: newStarred })
    } catch (err) {
      console.error('Failed to toggle star:', err)
      // Revert on error
      const { tasks: latest, setTasks: set } = useAppStore.getState()
      set(latest.map(t => (t._id || t.id) === taskId ? { ...t, is_starred: !newStarred } : t))
    }
  }, [])
}
