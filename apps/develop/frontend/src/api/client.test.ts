import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import {
  projectsApi,
  jobsApi,
  artifactsApi,
  scenariosApi,
  personasApi,
  walkthroughsApi,
  organizationsApi,
  usersApi,
  TENANT_STORAGE_KEY,
} from './client'

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

describe('API Client', () => {
  let mockApi: {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Get reference to the mocked axios instance
    mockApi = axios.create() as unknown as typeof mockApi
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('projectsApi', () => {
    const mockProject = {
      id: 'proj-1',
      name: 'Test Project',
      description: 'A test project',
      visibility: 'private',
      site_url: 'https://example.com',
      has_credentials: false,
      is_owner: true,
      can_edit: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    it('list() fetches all projects', async () => {
      const mockResponse = { data: { items: [mockProject], total: 1 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await projectsApi.list()

      expect(mockApi.get).toHaveBeenCalledWith('/projects')
      expect(result).toEqual(mockResponse.data)
    })

    it('get() fetches a project by id', async () => {
      const mockResponse = { data: mockProject }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await projectsApi.get('proj-1')

      expect(mockApi.get).toHaveBeenCalledWith('/projects/proj-1')
      expect(result).toEqual(mockProject)
    })

    it('create() creates a new project', async () => {
      const newProject = { name: 'New Project', description: 'New description' }
      const mockResponse = { data: { ...mockProject, ...newProject } }
      mockApi.post.mockResolvedValueOnce(mockResponse)

      const result = await projectsApi.create(newProject)

      expect(mockApi.post).toHaveBeenCalledWith('/projects', newProject)
      expect(result).toEqual(mockResponse.data)
    })

    it('update() updates an existing project', async () => {
      const updates = { name: 'Updated Project' }
      const mockResponse = { data: { ...mockProject, ...updates } }
      mockApi.put.mockResolvedValueOnce(mockResponse)

      const result = await projectsApi.update('proj-1', updates)

      expect(mockApi.put).toHaveBeenCalledWith('/projects/proj-1', updates)
      expect(result).toEqual(mockResponse.data)
    })

    it('delete() deletes a project', async () => {
      mockApi.delete.mockResolvedValueOnce({})

      await projectsApi.delete('proj-1')

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/proj-1')
    })
  })

  describe('jobsApi', () => {
    const mockJob = {
      id: 'job-1',
      job_type: 'walkthrough',
      status: 'completed' as const,
      progress: 100,
      current_step: null,
      created_at: '2024-01-01T00:00:00Z',
      started_at: '2024-01-01T00:00:01Z',
      completed_at: '2024-01-01T00:00:30Z',
      elapsed_ms: 29000,
      project_id: 'proj-1',
      project_name: 'Test Project',
      requested_by_name: 'John Doe',
      result: null,
      error: null,
    }

    it('list() fetches all jobs', async () => {
      const mockResponse = {
        data: { items: [mockJob], total: 1, stats: { completed: 1 } },
      }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await jobsApi.list()

      expect(mockApi.get).toHaveBeenCalledWith('/jobs', { params: undefined })
      expect(result).toEqual(mockResponse.data)
    })

    it('list() fetches jobs with filters', async () => {
      const params = { status: 'running', project_id: 'proj-1' }
      const mockResponse = {
        data: { items: [], total: 0, stats: {} },
      }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await jobsApi.list(params)

      expect(mockApi.get).toHaveBeenCalledWith('/jobs', { params })
      expect(result).toEqual(mockResponse.data)
    })

    it('get() fetches a job by id', async () => {
      const mockResponse = { data: mockJob }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await jobsApi.get('job-1')

      expect(mockApi.get).toHaveBeenCalledWith('/jobs/job-1')
      expect(result).toEqual(mockJob)
    })

    it('cancel() cancels a job', async () => {
      mockApi.delete.mockResolvedValueOnce({})

      await jobsApi.cancel('job-1')

      expect(mockApi.delete).toHaveBeenCalledWith('/jobs/job-1')
    })
  })

  describe('artifactsApi', () => {
    const mockArtifact = {
      id: 'art-1',
      label: 'Test Artifact',
      description: 'A test artifact',
      artifact_type_code: 'walkthrough',
      format: 'pdf',
      status: 'ready',
      project_id: 'proj-1',
      project_name: 'Test Project',
      job_id: 'job-1',
      created_by_name: 'John Doe',
      created_at: '2024-01-01T00:00:00Z',
    }

    it('list() fetches all artifacts', async () => {
      const mockResponse = { data: { items: [mockArtifact], total: 1 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await artifactsApi.list()

      expect(mockApi.get).toHaveBeenCalledWith('/artifacts', { params: undefined })
      expect(result).toEqual(mockResponse.data)
    })

    it('list() fetches artifacts with filters', async () => {
      const params = { project_id: 'proj-1', artifact_type: 'walkthrough' }
      const mockResponse = { data: { items: [], total: 0 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await artifactsApi.list(params)

      expect(mockApi.get).toHaveBeenCalledWith('/artifacts', { params })
      expect(result).toEqual(mockResponse.data)
    })

    it('get() fetches an artifact by id', async () => {
      const mockResponse = { data: mockArtifact }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await artifactsApi.get('art-1')

      expect(mockApi.get).toHaveBeenCalledWith('/artifacts/art-1')
      expect(result).toEqual(mockArtifact)
    })

    it('download() returns the correct download URL', () => {
      const url = artifactsApi.download('art-1')
      expect(url).toContain('/artifacts/art-1/download')
    })

    it('delete() deletes an artifact', async () => {
      mockApi.delete.mockResolvedValueOnce({})

      await artifactsApi.delete('art-1')

      expect(mockApi.delete).toHaveBeenCalledWith('/artifacts/art-1')
    })
  })

  describe('scenariosApi', () => {
    const mockScenario = {
      id: 'scen-1',
      code: 'basic_walkthrough',
      name: 'Basic Walkthrough',
      description: 'A basic walkthrough scenario',
      scenario_template: 'Navigate to {{url}} and perform {{action}}',
      default_observations: ['Check page loads', 'Verify content'],
      is_system: true,
    }

    it('list() fetches all scenarios', async () => {
      const mockResponse = { data: { items: [mockScenario], total: 1 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await scenariosApi.list()

      expect(mockApi.get).toHaveBeenCalledWith('/scenarios')
      expect(result).toEqual(mockResponse.data)
    })

    it('get() fetches a scenario by code', async () => {
      const mockResponse = { data: mockScenario }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await scenariosApi.get('basic_walkthrough')

      expect(mockApi.get).toHaveBeenCalledWith('/scenarios/basic_walkthrough')
      expect(result).toEqual(mockScenario)
    })
  })

  describe('personasApi', () => {
    const mockPersona = {
      id: 'pers-1',
      project_id: 'proj-1',
      name: 'Test User',
      role_description: 'A test user for QA',
      goals: ['Test features', 'Find bugs'],
      task_types: ['testing', 'qa'],
      has_credentials: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    it('list() fetches all personas', async () => {
      const mockResponse = { data: { items: [mockPersona], total: 1 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await personasApi.list()

      expect(mockApi.get).toHaveBeenCalledWith('/personas', { params: {} })
      expect(result).toEqual(mockResponse.data)
    })

    it('list() fetches personas for a specific project', async () => {
      const mockResponse = { data: { items: [mockPersona], total: 1 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await personasApi.list('proj-1')

      expect(mockApi.get).toHaveBeenCalledWith('/personas', {
        params: { project_id: 'proj-1' },
      })
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('walkthroughsApi', () => {
    it('create() creates a new walkthrough', async () => {
      const params = {
        project_id: 'proj-1',
        scenario_text: 'Navigate to homepage',
        label: 'Homepage Test',
        description: 'Test the homepage',
        observations: ['Check title', 'Check content'],
      }
      const mockResponse = {
        data: { job_id: 'job-1', status: 'pending', message: 'Walkthrough created' },
      }
      mockApi.post.mockResolvedValueOnce(mockResponse)

      const result = await walkthroughsApi.create(params)

      expect(mockApi.post).toHaveBeenCalledWith('/walkthroughs', params)
      expect(result).toEqual(mockResponse.data)
    })

    it('create() includes optional persona_id', async () => {
      const params = {
        project_id: 'proj-1',
        scenario_text: 'Navigate to homepage',
        persona_id: 'pers-1',
      }
      const mockResponse = {
        data: { job_id: 'job-1', status: 'pending', message: 'Walkthrough created' },
      }
      mockApi.post.mockResolvedValueOnce(mockResponse)

      const result = await walkthroughsApi.create(params)

      expect(mockApi.post).toHaveBeenCalledWith('/walkthroughs', params)
      expect(result).toEqual(mockResponse.data)
    })

    it('create() includes optional preconfigured_scenario', async () => {
      const params = {
        project_id: 'proj-1',
        scenario_text: 'Navigate to homepage',
        preconfigured_scenario: 'basic_walkthrough',
      }
      const mockResponse = {
        data: { job_id: 'job-1', status: 'pending', message: 'Walkthrough created' },
      }
      mockApi.post.mockResolvedValueOnce(mockResponse)

      const result = await walkthroughsApi.create(params)

      expect(mockApi.post).toHaveBeenCalledWith('/walkthroughs', params)
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('organizationsApi', () => {
    const mockOrg = {
      id: 'org-1',
      name: 'Test Organization',
      slug: 'test-org',
    }

    it('list() fetches all organizations', async () => {
      const mockResponse = { data: { items: [mockOrg], total: 1 } }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await organizationsApi.list()

      expect(mockApi.get).toHaveBeenCalledWith('/organizations')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('usersApi', () => {
    const mockUser = {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      tenant: {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
      },
    }

    it('me() fetches current user', async () => {
      const mockResponse = { data: mockUser }
      mockApi.get.mockResolvedValueOnce(mockResponse)

      const result = await usersApi.me()

      expect(mockApi.get).toHaveBeenCalledWith('/users/me')
      expect(result).toEqual(mockUser)
    })
  })

  describe('TENANT_STORAGE_KEY', () => {
    it('has the correct value', () => {
      expect(TENANT_STORAGE_KEY).toBe('expertly-tenant-id')
    })
  })
})
