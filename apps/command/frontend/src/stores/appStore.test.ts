import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAppStore } from './appStore'
import { api } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getCurrentUser: vi.fn(),
    getQueues: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn()
  }
}))

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      user: null,
      queues: [],
      tasks: [],
      loading: { user: false, queues: false, tasks: false },
      wsConnected: false,
      selectedQueueId: null
    })
    vi.clearAllMocks()
  })

  describe('fetchUser', () => {
    it('should fetch and store user', async () => {
      const mockUser = {
        id: '123',
        organization_id: 'org1',
        name: 'David',
        email: 'david@example.com',
        role: 'owner' as const,
        user_type: 'human' as const,
        is_default: true,
        created_at: '2024-01-01'
      }
      vi.mocked(api.getCurrentUser).mockResolvedValueOnce(mockUser)

      await useAppStore.getState().fetchUser()

      expect(api.getCurrentUser).toHaveBeenCalled()
      expect(useAppStore.getState().user).toEqual(mockUser)
      expect(useAppStore.getState().loading.user).toBe(false)
    })

    it('should handle fetch error', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValueOnce(new Error('Network error'))

      await useAppStore.getState().fetchUser()

      // User should remain null on error
      expect(useAppStore.getState().user).toBeNull()
      // Loading should be false after error
      expect(useAppStore.getState().loading.user).toBe(false)
    })
  })

  describe('fetchQueues', () => {
    it('should fetch and store queues', async () => {
      const mockQueues = [
        {
          _id: '1',
          id: '1',
          organization_id: 'org1',
          purpose: 'Inbox',
          scope_type: 'organization' as const,
          is_system: true,
          priority_default: 5,
          allow_bots: true,
          created_at: '2024-01-01'
        }
      ]
      vi.mocked(api.getQueues).mockResolvedValueOnce(mockQueues)

      await useAppStore.getState().fetchQueues()

      expect(api.getQueues).toHaveBeenCalled()
      expect(useAppStore.getState().queues).toEqual(mockQueues)
    })
  })

  describe('fetchTasks', () => {
    it('should fetch and store tasks', async () => {
      const mockTasks = [
        {
          _id: '1',
          id: '1',
          queue_id: 'q1',
          title: 'Test Task',
          status: 'queued' as const,
          priority: 5,
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]
      vi.mocked(api.getTasks).mockResolvedValueOnce(mockTasks)

      await useAppStore.getState().fetchTasks()

      expect(api.getTasks).toHaveBeenCalled()
      expect(useAppStore.getState().tasks).toEqual(mockTasks)
    })
  })

  describe('createTask', () => {
    it('should create task and add to store', async () => {
      const newTaskData = { queue_id: 'q1', title: 'New Task' }
      const createdTask = {
        _id: '2',
        id: '2',
        queue_id: 'q1',
        title: 'New Task',
        status: 'queued' as const,
        priority: 5,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }
      vi.mocked(api.createTask).mockResolvedValueOnce(createdTask)

      await useAppStore.getState().createTask(newTaskData)

      expect(api.createTask).toHaveBeenCalledWith(newTaskData)
      expect(useAppStore.getState().tasks).toContainEqual(createdTask)
    })
  })

  describe('setWsConnected', () => {
    it('should update WebSocket connection status', () => {
      expect(useAppStore.getState().wsConnected).toBe(false)

      useAppStore.getState().setWsConnected(true)

      expect(useAppStore.getState().wsConnected).toBe(true)
    })
  })

  describe('handleTaskEvent', () => {
    it('should update existing task in store via task event', () => {
      const existingTask = {
        _id: '1',
        id: '1',
        queue_id: 'q1',
        title: 'Original',
        status: 'queued' as const,
        priority: 5,
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }
      useAppStore.setState({ tasks: [existingTask] })

      const updatedTask = { ...existingTask, status: 'completed' as const }
      useAppStore.getState().handleTaskEvent({ type: 'task.completed', data: updatedTask })

      const tasks = useAppStore.getState().tasks
      expect(tasks[0].status).toBe('completed')
    })
  })
})
