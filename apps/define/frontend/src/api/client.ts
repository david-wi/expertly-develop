import axios from 'axios'

// Identity service URL for authentication
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
})

// Redirect to Identity login on 401 errors
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
    return Promise.reject(error)
  }
)

// Types
export interface Product {
  id: string
  name: string
  prefix: string
  description: string | null
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

// AI API
export const aiApi = {
  parseRequirements: (data: {
    description: string
    files?: Array<{ name: string; type: string; content: string }>
    existing_requirements: Array<{ id: string; stable_key: string; title: string; parent_id: string | null }>
    target_parent_id?: string
    product_name: string
  }) => api.post<{ requirements: ParsedRequirement[] }>('/ai/parse-requirements', data).then((r) => r.data),
}

export default api
