import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './api'

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('getHealth', () => {
    it('should return health status', async () => {
      const mockResponse = { status: 'healthy', database: 'connected' }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.getHealth()
      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith('/health', expect.any(Object))
    })

    it('should throw on error response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Server error' })
      })

      await expect(api.getHealth()).rejects.toThrow('Server error')
    })
  })

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: '123',
        name: 'David',
        email: 'david@example.com',
        role: 'owner'
      }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser)
      })

      const result = await api.getCurrentUser()
      expect(result).toEqual(mockUser)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/users/me', expect.any(Object))
    })
  })

  describe('getQueues', () => {
    it('should return list of queues', async () => {
      const mockQueues = [
        { _id: '1', purpose: 'Inbox', scope_type: 'organization', is_system: true },
        { _id: '2', purpose: 'Urgent', scope_type: 'organization', is_system: true }
      ]
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQueues)
      })

      const result = await api.getQueues()
      expect(result).toEqual(mockQueues)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/queues', expect.any(Object))
    })
  })

  describe('getTasks', () => {
    it('should return tasks without filters', async () => {
      const mockTasks = [
        { _id: '1', title: 'Task 1', status: 'queued' }
      ]
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTasks)
      })

      const result = await api.getTasks()
      expect(result).toEqual(mockTasks)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/tasks', expect.any(Object))
    })

    it('should include queue_id filter in URL', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

      await api.getTasks({ queue_id: 'abc123' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/tasks?queue_id=abc123',
        expect.any(Object)
      )
    })

    it('should include status filter in URL', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      })

      await api.getTasks({ status: 'queued' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/tasks?status=queued',
        expect.any(Object)
      )
    })
  })

  describe('createTask', () => {
    it('should create a task with POST request', async () => {
      const newTask = {
        queue_id: 'queue123',
        title: 'New Task',
        description: 'Description'
      }
      const mockResponse = { _id: '1', ...newTask, status: 'queued' }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await api.createTask(newTask)
      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/tasks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newTask)
        })
      )
    })
  })
})
