import axios from 'axios'
import { createErrorLogger } from '@expertly/ui'

// Identity service URL for authentication
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

// Error logger for API errors
const logger = createErrorLogger('define')

// Storage key for tenant ID override
export const TENANT_STORAGE_KEY = 'expertly-tenant-id'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
})

// Add interceptor to include X-Tenant-Id header from localStorage
api.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem(TENANT_STORAGE_KEY)
  if (tenantId) {
    config.headers['X-Tenant-Id'] = tenantId
  }
  return config
})

// Redirect to Identity login on 401 errors, log other errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Build return URL from current location
      const returnUrl = window.location.href
      const loginUrl = new URL('/login', IDENTITY_URL)
      loginUrl.searchParams.set('return_url', returnUrl)
      window.location.href = loginUrl.toString()
      return new Promise(() => {}) // Never resolve - we're redirecting
    }

    // Log non-401 errors to centralized error tracking
    logger.error(error, {
      action: 'apiRequest',
      additionalContext: {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
      },
    })

    return Promise.reject(error)
  }
)

// Types
export interface Product {
  id: string
  name: string
  prefix: string
  description: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
  requirement_count?: number
}

export interface Requirement {
  id: string
  product_id: string
  parent_id: string | null
  stable_key: string
  title: string
  what_this_does: string | null
  why_this_exists: string | null
  not_included: string | null
  acceptance_criteria: string | null
  status: string
  priority: string
  tags: string | null
  order_index: number
  current_version: number
  created_at: string
  updated_at: string
}

export interface ReleaseSnapshot {
  id: string
  product_id: string
  version_name: string
  description: string | null
  requirements_snapshot: string
  stats: string | null
  status: string
  created_at: string
  released_at: string | null
}

export interface JiraSettings {
  id: string
  product_id: string
  jira_host: string
  jira_email: string
  default_project_key: string
  created_at: string
  updated_at: string
}

export interface JiraStoryDraft {
  id: string
  product_id: string
  requirement_id: string | null
  summary: string
  description: string | null
  issue_type: string
  priority: string
  labels: string | null
  story_points: number | null
  status: string
  jira_issue_key: string | null
  jira_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ParsedRequirement {
  temp_id: string
  title: string
  what_this_does: string | null
  why_this_exists: string | null
  not_included: string | null
  acceptance_criteria: string | null
  priority: string
  tags: string[]
  parent_ref: string | null
}

export interface Artifact {
  id: string
  product_id: string
  name: string
  description: string | null
  artifact_type: 'file' | 'link'
  url: string | null
  original_filename: string | null
  mime_type: string | null
  current_version: number
  status: string
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface ArtifactVersion {
  id: string
  artifact_id: string
  version_number: number
  original_storage_path: string
  markdown_storage_path: string | null
  markdown_content: string | null
  size_bytes: number
  conversion_status: string
  conversion_error: string | null
  change_summary: string | null
  changed_by: string | null
  created_at: string
}

export interface ArtifactWithVersions extends Artifact {
  versions: ArtifactVersion[]
}

// Products API
export const productsApi = {
  list: () => api.get<Product[]>('/products').then((r) => r.data),
  get: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  create: (data: { name: string; prefix?: string; description?: string }) =>
    api.post<Product>('/products', data).then((r) => r.data),
  update: (id: string, data: Partial<Product>) =>
    api.patch<Product>(`/products/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/products/${id}`),
}

// Requirements API
export const requirementsApi = {
  list: (productId: string) =>
    api.get<Requirement[]>('/requirements', { params: { product_id: productId } }).then((r) => r.data),
  get: (id: string) => api.get<Requirement>(`/requirements/${id}`).then((r) => r.data),
  create: (data: {
    product_id: string
    parent_id?: string | null
    title: string
    what_this_does?: string
    why_this_exists?: string
    not_included?: string
    acceptance_criteria?: string
    status?: string
    priority?: string
    tags?: string[]
  }) => api.post<Requirement>('/requirements', data).then((r) => r.data),
  update: (id: string, data: Partial<Requirement>) =>
    api.patch<Requirement>(`/requirements/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/requirements/${id}`),
  createBatch: (data: {
    product_id: string
    requirements: Array<{
      temp_id: string
      title: string
      what_this_does?: string
      why_this_exists?: string
      not_included?: string
      acceptance_criteria?: string
      priority?: string
      tags?: string[]
      parent_ref?: string | null
    }>
  }) => api.post<Requirement[]>('/requirements/batch', data).then((r) => r.data),
}

// Releases API
export const releasesApi = {
  list: (productId: string) =>
    api.get<ReleaseSnapshot[]>('/releases', { params: { product_id: productId } }).then((r) => r.data),
  get: (id: string) => api.get<ReleaseSnapshot>(`/releases/${id}`).then((r) => r.data),
  create: (data: { product_id: string; version_name: string; description?: string }) =>
    api.post<ReleaseSnapshot>('/releases', data).then((r) => r.data),
  update: (id: string, data: Partial<ReleaseSnapshot>) =>
    api.patch<ReleaseSnapshot>(`/releases/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/releases/${id}`),
}

// Jira API
export const jiraApi = {
  getSettings: (productId: string) =>
    api.get<JiraSettings | null>(`/jira/settings/${productId}`).then((r) => r.data),
  saveSettings: (productId: string, data: {
    jira_host: string
    jira_email: string
    jira_api_token: string
    default_project_key: string
  }) => api.post<JiraSettings>(`/jira/settings/${productId}`, data).then((r) => r.data),
  listDrafts: (productId: string) =>
    api.get<JiraStoryDraft[]>('/jira/drafts', { params: { product_id: productId } }).then((r) => r.data),
  createDraft: (data: {
    product_id: string
    requirement_id?: string
    summary: string
    description?: string
    issue_type?: string
    priority?: string
    labels?: string[]
    story_points?: number
  }) => api.post<JiraStoryDraft>('/jira/drafts', data).then((r) => r.data),
  updateDraft: (id: string, data: Partial<JiraStoryDraft>) =>
    api.put<JiraStoryDraft>(`/jira/drafts/${id}`, data).then((r) => r.data),
  deleteDraft: (id: string) => api.delete(`/jira/drafts/${id}`),
  send: (draftId: string) => api.post('/jira/send', { draft_id: draftId }),
  sendAll: (productId: string, draftIds: string[]) =>
    api.post('/jira/send-all', { product_id: productId, draft_ids: draftIds }),
}

// Users API
export interface CurrentUser {
  id: string
  name: string
  email: string
  organization_id: string | null
  organization_name: string | null
}

export const usersApi = {
  me: () => api.get<CurrentUser>('/users/me').then((r) => r.data),
}

// Organization types
export interface Organization {
  id: string
  name: string
  slug: string
}

export const organizationsApi = {
  list: async () => {
    const { data } = await api.get<{ items: Organization[]; total: number }>('/organizations')
    return data
  },
}

// AI API
export const aiApi = {
  parseRequirements: (data: {
    description: string
    files?: Array<{ name: string; type: string; content: string }>
    existing_requirements: Array<{ id: string; stable_key: string; title: string; parent_id: string | null }>
    target_parent_id?: string
    product_name: string
  }) => api.post<{ requirements: ParsedRequirement[] }>('/ai/parse-requirements', data).then((r) => r.data),

  generateFromArtifacts: (data: {
    product_id: string
    artifact_ids?: string[]
    target_parent_id?: string
  }) => api.post<{ job_id: string }>(
    '/ai/generate-from-artifacts', data
  ).then((r) => r.data),

  getGenerationStatus: (jobId: string) =>
    api.get<{ status: string; requirements: ParsedRequirement[] | null; error: string | null }>(
      `/ai/generate-from-artifacts/${jobId}`
    ).then((r) => r.data),
}

// Artifacts API
export const artifactsApi = {
  list: (productId: string) =>
    api.get<Artifact[]>('/artifacts', { params: { product_id: productId } }).then((r) => r.data),

  get: (id: string) =>
    api.get<ArtifactWithVersions>(`/artifacts/${id}`).then((r) => r.data),

  upload: (productId: string, name: string, file: File, description?: string) => {
    const formData = new FormData()
    formData.append('product_id', productId)
    formData.append('name', name)
    formData.append('file', file)
    if (description) {
      formData.append('description', description)
    }
    return api.post<Artifact>('/artifacts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  createLink: (productId: string, name: string, url: string, description?: string) =>
    api.post<Artifact>('/artifacts/link', { name, url, description }, { params: { product_id: productId } }).then((r) => r.data),

  update: (id: string, data: { name?: string; description?: string; status?: string; url?: string }) =>
    api.patch<Artifact>(`/artifacts/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/artifacts/${id}`),

  uploadVersion: (artifactId: string, file: File, changeSummary?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (changeSummary) {
      formData.append('change_summary', changeSummary)
    }
    return api.post<ArtifactVersion>(`/artifacts/${artifactId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  downloadOriginalUrl: (artifactId: string, versionId: string) =>
    `/api/v1/artifacts/${artifactId}/versions/${versionId}/original`,

  getMarkdown: (artifactId: string, versionId: string) =>
    api.get<string>(`/artifacts/${artifactId}/versions/${versionId}/markdown`, {
      responseType: 'text',
      transformResponse: [(data) => data],
    }).then((r) => r.data),

  reconvert: (artifactId: string, versionId: string) =>
    api.post<ArtifactVersion>(`/artifacts/${artifactId}/versions/${versionId}/reconvert`).then((r) => r.data),
}

// Avatars API
export const avatarsApi = {
  generate: (productId: string, productName: string, productDescription?: string | null, imageDescription?: string | null) =>
    api.post<{ avatar_url: string }>('/avatars/generate', {
      product_id: productId,
      product_name: productName,
      product_description: productDescription,
      image_description: imageDescription,
    }).then((r) => r.data),

  upload: (productId: string, file: File) => {
    const formData = new FormData()
    formData.append('product_id', productId)
    formData.append('file', file)
    return api.post<{ avatar_url: string }>('/avatars/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  remove: (productId: string) => api.delete(`/avatars/${productId}`),
}

export default api
