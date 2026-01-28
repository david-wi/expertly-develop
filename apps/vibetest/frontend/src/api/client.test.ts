import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return { default: mockAxios }
})

// We need to import after mocking
import {
  projectsApi,
  testsApi,
  runsApi,
  environmentsApi,
  quickStartApi,
  healthApi,
  authApi,
  organizationsApi,
  TENANT_STORAGE_KEY,
} from './client'

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('projectsApi', () => {
    it('list fetches all projects', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1' },
        { id: '2', name: 'Project 2' },
      ]
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockProjects })

      const result = await projectsApi.list()

      expect(axios.get).toHaveBeenCalledWith('/projects')
      expect(result).toEqual(mockProjects)
    })

    it('get fetches a single project', async () => {
      const mockProject = { id: '1', name: 'Project 1' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockProject })

      const result = await projectsApi.get('1')

      expect(axios.get).toHaveBeenCalledWith('/projects/1')
      expect(result).toEqual(mockProject)
    })

    it('create posts new project data', async () => {
      const newProject = { name: 'New Project', description: 'A description' }
      const mockResponse = { id: '1', ...newProject }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await projectsApi.create(newProject)

      expect(axios.post).toHaveBeenCalledWith('/projects', newProject)
      expect(result).toEqual(mockResponse)
    })

    it('update patches project data', async () => {
      const updates = { name: 'Updated Name' }
      const mockResponse = { id: '1', name: 'Updated Name' }
      vi.mocked(axios.patch).mockResolvedValueOnce({ data: mockResponse })

      const result = await projectsApi.update('1', updates)

      expect(axios.patch).toHaveBeenCalledWith('/projects/1', updates)
      expect(result).toEqual(mockResponse)
    })

    it('delete removes a project', async () => {
      vi.mocked(axios.delete).mockResolvedValueOnce({})

      await projectsApi.delete('1')

      expect(axios.delete).toHaveBeenCalledWith('/projects/1')
    })
  })

  describe('testsApi', () => {
    const projectId = 'project-123'

    it('list fetches tests for a project', async () => {
      const mockTests = [{ id: '1', title: 'Test 1' }]
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockTests })

      const result = await testsApi.list(projectId)

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/tests`, { params: undefined })
      expect(result).toEqual(mockTests)
    })

    it('list with filters', async () => {
      const mockTests = [{ id: '1', title: 'Test 1', status: 'draft' }]
      const params = { status: 'draft', priority: 'high' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockTests })

      const result = await testsApi.list(projectId, params)

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/tests`, { params })
      expect(result).toEqual(mockTests)
    })

    it('get fetches a single test', async () => {
      const mockTest = { id: 'test-1', title: 'Test 1' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockTest })

      const result = await testsApi.get(projectId, 'test-1')

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/tests/test-1`)
      expect(result).toEqual(mockTest)
    })

    it('create posts new test data', async () => {
      const newTest = { title: 'New Test', description: 'Test description' }
      const mockResponse = { id: 'test-1', ...newTest }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await testsApi.create(projectId, newTest)

      expect(axios.post).toHaveBeenCalledWith(`/projects/${projectId}/tests`, newTest)
      expect(result).toEqual(mockResponse)
    })

    it('approve posts to approve endpoint', async () => {
      const mockResponse = { id: 'test-1', status: 'approved' }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await testsApi.approve(projectId, 'test-1')

      expect(axios.post).toHaveBeenCalledWith(`/projects/${projectId}/tests/test-1/approve`)
      expect(result).toEqual(mockResponse)
    })

    it('delete removes a test', async () => {
      vi.mocked(axios.delete).mockResolvedValueOnce({})

      await testsApi.delete(projectId, 'test-1')

      expect(axios.delete).toHaveBeenCalledWith(`/projects/${projectId}/tests/test-1`)
    })
  })

  describe('runsApi', () => {
    const projectId = 'project-123'

    it('list fetches runs for a project', async () => {
      const mockRuns = [{ id: '1', status: 'completed' }]
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockRuns })

      const result = await runsApi.list(projectId)

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/runs`)
      expect(result).toEqual(mockRuns)
    })

    it('get fetches a single run', async () => {
      const mockRun = { id: 'run-1', status: 'completed' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockRun })

      const result = await runsApi.get(projectId, 'run-1')

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/runs/run-1`)
      expect(result).toEqual(mockRun)
    })

    it('start creates a new run', async () => {
      const mockRun = { id: 'run-1', status: 'pending' }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockRun })

      const result = await runsApi.start(projectId)

      expect(axios.post).toHaveBeenCalledWith(`/projects/${projectId}/runs`, {})
      expect(result).toEqual(mockRun)
    })

    it('start with options creates a new run', async () => {
      const options = { environment_id: 'env-1', name: 'Test Run' }
      const mockRun = { id: 'run-1', status: 'pending', ...options }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockRun })

      const result = await runsApi.start(projectId, options)

      expect(axios.post).toHaveBeenCalledWith(`/projects/${projectId}/runs`, options)
      expect(result).toEqual(mockRun)
    })

    it('getResults fetches run results', async () => {
      const mockResults = [{ id: '1', status: 'passed' }]
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockResults })

      const result = await runsApi.getResults(projectId, 'run-1')

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/runs/run-1/results`)
      expect(result).toEqual(mockResults)
    })
  })

  describe('environmentsApi', () => {
    const projectId = 'project-123'

    it('list fetches environments for a project', async () => {
      const mockEnvironments = [{ id: '1', name: 'Production' }]
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockEnvironments })

      const result = await environmentsApi.list(projectId)

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/environments`)
      expect(result).toEqual(mockEnvironments)
    })

    it('get fetches a single environment', async () => {
      const mockEnv = { id: 'env-1', name: 'Production' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockEnv })

      const result = await environmentsApi.get(projectId, 'env-1')

      expect(axios.get).toHaveBeenCalledWith(`/projects/${projectId}/environments/env-1`)
      expect(result).toEqual(mockEnv)
    })

    it('create posts new environment data', async () => {
      const newEnv = {
        name: 'Staging',
        type: 'staging',
        base_url: 'https://staging.example.com',
      }
      const mockResponse = { id: 'env-1', ...newEnv }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await environmentsApi.create(projectId, newEnv)

      expect(axios.post).toHaveBeenCalledWith(`/projects/${projectId}/environments`, newEnv)
      expect(result).toEqual(mockResponse)
    })

    it('delete removes an environment', async () => {
      vi.mocked(axios.delete).mockResolvedValueOnce({})

      await environmentsApi.delete(projectId, 'env-1')

      expect(axios.delete).toHaveBeenCalledWith(`/projects/${projectId}/environments/env-1`)
    })
  })

  describe('quickStartApi', () => {
    it('start initiates a quick start session', async () => {
      const startData = { url: 'https://example.com' }
      const mockSession = { id: 'session-1', url: startData.url, status: 'pending' }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockSession })

      const result = await quickStartApi.start(startData)

      expect(axios.post).toHaveBeenCalledWith('/quick-start', startData)
      expect(result).toEqual(mockSession)
    })

    it('start with credentials', async () => {
      const startData = {
        url: 'https://example.com',
        credentials: { username: 'user', password: 'pass' },
      }
      const mockSession = { id: 'session-1', url: startData.url, status: 'pending' }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockSession })

      const result = await quickStartApi.start(startData)

      expect(axios.post).toHaveBeenCalledWith('/quick-start', startData)
      expect(result).toEqual(mockSession)
    })

    it('getStatus fetches session status', async () => {
      const mockSession = { id: 'session-1', status: 'exploring', progress: 50 }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockSession })

      const result = await quickStartApi.getStatus('session-1')

      expect(axios.get).toHaveBeenCalledWith('/quick-start/session-1')
      expect(result).toEqual(mockSession)
    })

    it('saveAsProject saves session as project', async () => {
      const mockResponse = { project_id: 'project-1' }
      vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse })

      const result = await quickStartApi.saveAsProject('session-1', 'My Project')

      expect(axios.post).toHaveBeenCalledWith(
        '/quick-start/session-1/save-project?name=My%20Project'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('healthApi', () => {
    it('check returns health status', async () => {
      const mockHealth = { status: 'healthy' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockHealth })

      const result = await healthApi.check()

      expect(axios.get).toHaveBeenCalledWith('/health')
      expect(result).toEqual(mockHealth)
    })

    it('ready returns readiness status', async () => {
      const mockReady = { status: 'ready' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockReady })

      const result = await healthApi.ready()

      expect(axios.get).toHaveBeenCalledWith('/ready')
      expect(result).toEqual(mockReady)
    })
  })

  describe('authApi', () => {
    it('me fetches current user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockUser })

      const result = await authApi.me()

      expect(axios.get).toHaveBeenCalledWith('/auth/me')
      expect(result).toEqual(mockUser)
    })

    it('getIdentityUrls fetches identity URLs', async () => {
      const mockUrls = {
        login_url: 'https://identity.example.com/login',
        logout_url: 'https://identity.example.com/logout',
        register_url: 'https://identity.example.com/register',
        users_management_url: 'https://identity.example.com/users',
      }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockUrls })

      const result = await authApi.getIdentityUrls()

      expect(axios.get).toHaveBeenCalledWith('/auth/identity-urls')
      expect(result).toEqual(mockUrls)
    })

    it('isAuthenticated returns true when authenticated', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: { id: '1' } })

      const result = await authApi.isAuthenticated()

      expect(result).toBe(true)
    })

    it('isAuthenticated returns false when not authenticated', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Unauthorized'))

      const result = await authApi.isAuthenticated()

      expect(result).toBe(false)
    })
  })

  describe('organizationsApi', () => {
    it('list fetches organizations', async () => {
      const mockOrgs = {
        items: [{ id: '1', name: 'Org 1', slug: 'org-1' }],
        total: 1,
      }
      vi.mocked(axios.get).mockResolvedValueOnce({ data: mockOrgs })

      const result = await organizationsApi.list()

      expect(axios.get).toHaveBeenCalledWith('/organizations')
      expect(result).toEqual(mockOrgs)
    })
  })

  describe('TENANT_STORAGE_KEY', () => {
    it('is defined correctly', () => {
      expect(TENANT_STORAGE_KEY).toBe('expertly-tenant-id')
    })
  })
})
