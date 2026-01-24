import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const TENANT_STORAGE_KEY = 'expertly-tenant-id'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add interceptor to include X-Tenant-Id header from localStorage
api.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem(TENANT_STORAGE_KEY)
  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId
  }
  return config
})

// Types
export interface Project {
  id: string
  name: string
  description: string | null
  visibility: string
  site_url: string | null
  has_credentials: boolean
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  name: string
  description?: string
  visibility?: 'private' | 'team' | 'companywide'
  site_url?: string
}

export interface Job {
  id: string
  job_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  current_step: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  elapsed_ms: number | null
  project_id: string | null
  result: Record<string, unknown> | null
  error: string | null
}

export interface Artifact {
  id: string
  label: string
  description: string | null
  artifact_type_code: string
  format: string
  status: string
  project_id: string | null
  job_id: string | null
  created_at: string
}

export interface Scenario {
  id: string
  code: string
  name: string
  description: string | null
  scenario_template: string
  default_observations: string[]
  is_system: boolean
}

export interface Persona {
  id: string
  project_id: string
  name: string
  role_description: string | null
  goals: string[]
  task_types: string[]
  has_credentials: boolean
  created_at: string
  updated_at: string
}

// API functions
export const projectsApi = {
  list: async () => {
    const { data } = await api.get<{ items: Project[]; total: number }>('/projects')
    return data
  },
  get: async (id: string) => {
    const { data } = await api.get<Project>(`/projects/${id}`)
    return data
  },
  create: async (project: ProjectCreate) => {
    const { data } = await api.post<Project>('/projects', project)
    return data
  },
  update: async (id: string, updates: Partial<ProjectCreate>) => {
    const { data } = await api.put<Project>(`/projects/${id}`, updates)
    return data
  },
  delete: async (id: string) => {
    await api.delete(`/projects/${id}`)
  },
}

export const jobsApi = {
  list: async (params?: { status?: string; job_type?: string; project_id?: string }) => {
    const { data } = await api.get<{ items: Job[]; total: number; stats: Record<string, number> }>('/jobs', { params })
    return data
  },
  get: async (id: string) => {
    const { data } = await api.get<Job>(`/jobs/${id}`)
    return data
  },
  cancel: async (id: string) => {
    await api.delete(`/jobs/${id}`)
  },
}

export const artifactsApi = {
  list: async (params?: { project_id?: string; artifact_type?: string }) => {
    const { data } = await api.get<{ items: Artifact[]; total: number }>('/artifacts', { params })
    return data
  },
  get: async (id: string) => {
    const { data } = await api.get<Artifact>(`/artifacts/${id}`)
    return data
  },
  download: (id: string) => `${API_BASE_URL}/artifacts/${id}/download`,
  delete: async (id: string) => {
    await api.delete(`/artifacts/${id}`)
  },
}

export const scenariosApi = {
  list: async () => {
    const { data } = await api.get<{ items: Scenario[]; total: number }>('/scenarios')
    return data
  },
  get: async (code: string) => {
    const { data } = await api.get<Scenario>(`/scenarios/${code}`)
    return data
  },
}

export const personasApi = {
  list: async (projectId?: string) => {
    const { data } = await api.get<{ items: Persona[]; total: number }>('/personas', {
      params: projectId ? { project_id: projectId } : {},
    })
    return data
  },
}

export const walkthroughsApi = {
  create: async (params: {
    project_id: string
    scenario_text: string
    label?: string
    description?: string
    observations?: string[]
    persona_id?: string
    preconfigured_scenario?: string
  }) => {
    const { data } = await api.post<{ job_id: string; status: string; message: string }>('/walkthroughs', params)
    return data
  },
}

// Organization types
export interface Organization {
  id: string
  name: string
  slug: string
}

export interface TenantInfo {
  id: string
  name: string
  slug: string
}

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
  tenant: TenantInfo
}

export const organizationsApi = {
  list: async () => {
    const { data } = await api.get<{ items: Organization[]; total: number }>('/organizations')
    return data
  },
}

export const usersApi = {
  me: async () => {
    const { data } = await api.get<CurrentUser>('/users/me')
    return data
  },
}
