import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './api'

describe('API Service - Extended Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('Organizations', () => {
    it('should get all organizations', async () => {
      const mockOrganizations = [
        { id: '1', name: 'Org 1', slug: 'org-1', is_default: true, created_at: '2024-01-01' },
      ]
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrganizations),
      })

      const result = await api.getOrganizations()
      expect(result).toEqual(mockOrganizations)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/organizations', expect.any(Object))
    })

    it('should get organization by id', async () => {
      const mockOrg = { id: '1', name: 'Org 1', slug: 'org-1', is_default: true, created_at: '2024-01-01' }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrg),
      })

      const result = await api.getOrganization('1')
      expect(result).toEqual(mockOrg)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/organizations/1', expect.any(Object))
    })
  })

  describe('Users', () => {
    const mockUser = {
      id: 'user-1',
      organization_id: 'org-1',
      email: 'test@example.com',
      name: 'Test User',
      user_type: 'human',
      role: 'member',
      is_active: true,
      is_default: false,
      created_at: '2024-01-01',
    }

    it('should get users without filter', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockUser]),
      })

      const result = await api.getUsers()
      expect(result).toEqual([mockUser])
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/users', expect.any(Object))
    })

    it('should get users with type filter', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockUser]),
      })

      const result = await api.getUsers('human')
      expect(result).toEqual([mockUser])
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/users?user_type=human', expect.any(Object))
    })

    it('should get user by id', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      })

      const result = await api.getUser('user-1')
      expect(result).toEqual(mockUser)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/users/user-1', expect.any(Object))
    })

    it('should create user', async () => {
      const newUser = { ...mockUser, api_key: 'test-key' }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newUser),
      })

      const result = await api.createUser({ email: 'test@example.com', name: 'Test User' })
      expect(result).toEqual(newUser)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should update user', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUser),
      })

      const result = await api.updateUser('user-1', { name: 'Updated' })
      expect(result).toEqual(mockUser)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/user-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('should delete user', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(undefined),
      })

      await api.deleteUser('user-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/user-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should regenerate API key', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ api_key: 'new-key' }),
      })

      const result = await api.regenerateApiKey('user-1')
      expect(result).toEqual({ api_key: 'new-key' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/users/user-1/regenerate-api-key',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('Queues', () => {
    const mockQueue = {
      id: 'queue-1',
      organization_id: 'org-1',
      purpose: 'Test Queue',
      scope_type: 'organization',
      is_system: false,
      priority_default: 5,
      allow_bots: true,
      created_at: '2024-01-01',
    }

    it('should get queue by id', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQueue),
      })

      const result = await api.getQueue('queue-1')
      expect(result).toEqual(mockQueue)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/queues/queue-1', expect.any(Object))
    })

    it('should create queue', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQueue),
      })

      const result = await api.createQueue({ purpose: 'Test Queue' })
      expect(result).toEqual(mockQueue)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/queues',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should update queue', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQueue),
      })

      const result = await api.updateQueue('queue-1', { purpose: 'Updated' })
      expect(result).toEqual(mockQueue)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/queues/queue-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('should delete queue', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(undefined),
      })

      await api.deleteQueue('queue-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/queues/queue-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('Tasks', () => {
    const mockTask = {
      id: 'task-1',
      queue_id: 'queue-1',
      title: 'Test Task',
      status: 'queued',
      priority: 5,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }

    it('should get task by id', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTask),
      })

      const result = await api.getTask('task-1')
      expect(result).toEqual(mockTask)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/tasks/task-1', expect.any(Object))
    })

    it('should get tasks with multiple filters', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockTask]),
      })

      await api.getTasks({ queue_id: 'queue-1', status: 'queued' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/tasks?queue_id=queue-1&status=queued',
        expect.any(Object)
      )
    })
  })

  describe('Teams', () => {
    const mockTeam = {
      id: 'team-1',
      organization_id: 'org-1',
      name: 'Test Team',
      member_ids: ['user-1'],
    }

    it('should get all teams', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockTeam]),
      })

      const result = await api.getTeams()
      expect(result).toEqual([mockTeam])
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/teams', expect.any(Object))
    })

    it('should get team by id', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTeam),
      })

      const result = await api.getTeam('team-1')
      expect(result).toEqual(mockTeam)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/teams/team-1', expect.any(Object))
    })

    it('should create team', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTeam),
      })

      const result = await api.createTeam({ name: 'Test Team' })
      expect(result).toEqual(mockTeam)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/teams',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should update team', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTeam),
      })

      const result = await api.updateTeam('team-1', { name: 'Updated' })
      expect(result).toEqual(mockTeam)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/teams/team-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('should delete team', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(undefined),
      })

      await api.deleteTeam('team-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/teams/team-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should add team member', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTeam),
      })

      const result = await api.addTeamMember('team-1', 'user-2')
      expect(result).toEqual(mockTeam)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/teams/team-1/members/user-2',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should remove team member', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTeam),
      })

      const result = await api.removeTeamMember('team-1', 'user-2')
      expect(result).toEqual(mockTeam)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/teams/team-1/members/user-2',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('Recurring Tasks', () => {
    const mockRecurringTask = {
      id: 'rt-1',
      organization_id: 'org-1',
      queue_id: 'queue-1',
      title: 'Daily Task',
      priority: 5,
      recurrence_type: 'daily',
      interval: 1,
      days_of_week: [],
      start_date: '2024-01-01',
      timezone: 'UTC',
      is_active: true,
      created_tasks_count: 10,
      max_retries: 3,
      created_at: '2024-01-01',
    }

    it('should get all recurring tasks', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockRecurringTask]),
      })

      const result = await api.getRecurringTasks()
      expect(result).toEqual([mockRecurringTask])
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/recurring-tasks', expect.any(Object))
    })

    it('should get recurring tasks with filters', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockRecurringTask]),
      })

      await api.getRecurringTasks({ queue_id: 'queue-1', is_active: true })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/recurring-tasks?queue_id=queue-1&is_active=true',
        expect.any(Object)
      )
    })

    it('should get recurring task by id', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRecurringTask),
      })

      const result = await api.getRecurringTask('rt-1')
      expect(result).toEqual(mockRecurringTask)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/recurring-tasks/rt-1', expect.any(Object))
    })

    it('should create recurring task', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRecurringTask),
      })

      const result = await api.createRecurringTask({ queue_id: 'queue-1', title: 'Daily Task' })
      expect(result).toEqual(mockRecurringTask)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/recurring-tasks',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should update recurring task', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRecurringTask),
      })

      const result = await api.updateRecurringTask('rt-1', { title: 'Updated' })
      expect(result).toEqual(mockRecurringTask)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/recurring-tasks/rt-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('should delete recurring task', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(undefined),
      })

      await api.deleteRecurringTask('rt-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/recurring-tasks/rt-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should trigger recurring task', async () => {
      const mockCreatedTask = { id: 'task-1', title: 'Daily Task' }
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCreatedTask),
      })

      const result = await api.triggerRecurringTask('rt-1')
      expect(result).toEqual(mockCreatedTask)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/recurring-tasks/rt-1/trigger',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('Playbooks', () => {
    const mockPlaybook = {
      id: 'pb-1',
      organization_id: 'org-1',
      name: 'Test Playbook',
      steps: [],
      scope_type: 'organization',
      version: 1,
      history: [],
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    }

    it('should get all playbooks', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPlaybook]),
      })

      const result = await api.getPlaybooks()
      expect(result).toEqual([mockPlaybook])
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/playbooks', expect.any(Object))
    })

    it('should get playbooks with filters', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockPlaybook]),
      })

      await api.getPlaybooks({ scope_type: 'organization', active_only: true })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/playbooks?scope_type=organization&active_only=true',
        expect.any(Object)
      )
    })

    it('should get playbook by id', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlaybook),
      })

      const result = await api.getPlaybook('pb-1')
      expect(result).toEqual(mockPlaybook)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/playbooks/pb-1', expect.any(Object))
    })

    it('should create playbook', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlaybook),
      })

      const result = await api.createPlaybook({ name: 'Test Playbook' })
      expect(result).toEqual(mockPlaybook)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/playbooks',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should update playbook', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPlaybook),
      })

      const result = await api.updatePlaybook('pb-1', { name: 'Updated' })
      expect(result).toEqual(mockPlaybook)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/playbooks/pb-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('should delete playbook', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(undefined),
      })

      await api.deletePlaybook('pb-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/playbooks/pb-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('should duplicate playbook', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockPlaybook, id: 'pb-2', name: 'Test Playbook (Copy)' }),
      })

      const result = await api.duplicatePlaybook('pb-1')
      expect(result.name).toBe('Test Playbook (Copy)')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/playbooks/pb-1/duplicate',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should duplicate playbook with new name', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockPlaybook, id: 'pb-2', name: 'Custom Name' }),
      })

      await api.duplicatePlaybook('pb-1', 'Custom Name')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/playbooks/pb-1/duplicate?new_name=Custom%20Name',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should get playbook history', async () => {
      const mockHistory = [{ version: 1, name: 'Original', steps: [], changed_at: '2024-01-01' }]
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      })

      const result = await api.getPlaybookHistory('pb-1')
      expect(result).toEqual(mockHistory)
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/playbooks/pb-1/history', expect.any(Object))
    })
  })

  describe('Images', () => {
    it('should generate avatar', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/avatar.png' }),
      })

      const result = await api.generateAvatar({
        user_type: 'virtual',
        description: 'A helpful bot',
        name: 'Bot',
      })
      expect(result).toEqual({ url: 'https://example.com/avatar.png' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/images/generate-avatar',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('Error Handling', () => {
    it('should throw error with detail message', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Bad request' }),
      })

      await expect(api.getHealth()).rejects.toThrow('Bad request')
    })

    it('should throw HTTP status on JSON parse failure', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('JSON parse error')),
      })

      await expect(api.getHealth()).rejects.toThrow('Unknown error')
    })

    it('should include credentials in requests', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      await api.getHealth()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    it('should include Content-Type header', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      await api.getHealth()
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      )
    })
  })
})
