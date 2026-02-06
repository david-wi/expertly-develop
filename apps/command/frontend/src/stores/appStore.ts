import { create } from 'zustand'
import { api, Queue, Task, User } from '../services/api'

interface AppState {
  // Data
  user: User | null
  queues: Queue[]
  tasks: Task[]
  selectedQueueId: string | null
  viewingUserId: string | null // For viewing another user's tasks

  // Loading states
  loading: {
    user: boolean
    queues: boolean
    tasks: boolean
  }

  // WebSocket
  wsConnected: boolean

  // Actions
  setUser: (user: User | null) => void
  setQueues: (queues: Queue[]) => void
  setTasks: (tasks: Task[]) => void
  setSelectedQueueId: (queueId: string | null) => void
  setViewingUserId: (userId: string | null) => void
  setWsConnected: (connected: boolean) => void

  // Async actions
  fetchUser: () => Promise<void>
  fetchQueues: () => Promise<void>
  fetchTasks: (queueId?: string, userId?: string) => Promise<void>
  createTask: (data: { queue_id: string; title: string; description?: string }) => Promise<Task>

  // WebSocket event handlers
  handleTaskEvent: (event: { type: string; data: Task }) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  queues: [],
  tasks: [],
  selectedQueueId: null,
  viewingUserId: null,
  loading: {
    user: false,
    queues: false,
    tasks: false,
  },
  wsConnected: false,

  setUser: (user) => set({ user }),
  setQueues: (queues) => set({ queues }),
  setTasks: (tasks) => set({ tasks }),
  setSelectedQueueId: (queueId) => set({ selectedQueueId: queueId }),
  setViewingUserId: (userId) => set({ viewingUserId: userId }),
  setWsConnected: (connected) => set({ wsConnected: connected }),

  fetchUser: async () => {
    set((state) => ({ loading: { ...state.loading, user: true } }))
    try {
      const user = await api.getCurrentUser()
      set({ user })
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, user: false } }))
    }
  },

  fetchQueues: async () => {
    set((state) => ({ loading: { ...state.loading, queues: true } }))
    try {
      const queues = await api.getQueues()
      set({ queues })
    } catch (error) {
      console.error('Failed to fetch queues:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, queues: false } }))
    }
  },

  fetchTasks: async (queueId?: string, userId?: string) => {
    // Only show loading indicator on initial fetch (no existing data).
    // Background refreshes keep existing tasks visible to avoid flicker.
    if (get().tasks.length === 0) {
      set((state) => ({ loading: { ...state.loading, tasks: true } }))
    }
    try {
      const tasks = await api.getTasks({ queue_id: queueId, user_id: userId })
      set({ tasks })
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      set((state) => ({ loading: { ...state.loading, tasks: false } }))
    }
  },

  createTask: async (data) => {
    const task = await api.createTask(data)
    set((state) => ({ tasks: [task, ...state.tasks] }))
    return task
  },

  handleTaskEvent: (event) => {
    const { type, data: task } = event

    set((state) => {
      let tasks = [...state.tasks]

      switch (type) {
        case 'task.created':
          // Add if not already present
          if (!tasks.find((t) => t.id === task.id || t._id === task._id)) {
            tasks = [task, ...tasks]
          }
          break

        case 'task.updated':
        case 'task.progress':
        case 'task.completed':
        case 'task.failed':
          // Update existing task
          tasks = tasks.map((t) => (t.id === task.id || t._id === task._id ? task : t))
          break

        case 'task.deleted':
          // Remove deleted task from list
          tasks = tasks.filter((t) => t.id !== task.id && t._id !== task._id)
          break
      }

      return { tasks }
    })
  },
}))
