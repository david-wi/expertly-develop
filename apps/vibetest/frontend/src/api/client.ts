import axios from 'axios'

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  // Include cookies for cross-origin requests (Identity session cookie)
  withCredentials: true,
})

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Not authenticated - redirect to Identity login
      const returnUrl = encodeURIComponent(window.location.href)
      window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`
    }
    return Promise.reject(error)
  }
)

// Auth API - uses Identity session cookies
export const authApi = {
  me: () => api.get('/auth/me').then((r) => r.data),

  logout: () => {
    const returnUrl = encodeURIComponent(window.location.origin + '/login')
    window.location.href = `${IDENTITY_URL}/logout?returnUrl=${returnUrl}`
  },

  getIdentityUrls: () =>
    api.get('/auth/identity-urls').then((r) => r.data) as Promise<{
      login_url: string
      logout_url: string
      register_url: string
      users_management_url: string
    }>,

  isAuthenticated: async () => {
    try {
      await api.get('/auth/me')
      return true
    } catch {
      return false
    }
  },
}

// Legacy token storage (deprecated - kept for cleanup)
export const tokenStorage = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  setTokens: () => {},
  clearTokens: () => {
    // Clean up any old tokens from localStorage
    localStorage.removeItem('vibeqa_access_token')
    localStorage.removeItem('vibeqa_refresh_token')
  },
}

// Projects
export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string }) =>
    api.post('/projects', data).then(r => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; status: string }>) =>
    api.patch(`/projects/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
}

// Environments
export const environmentsApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/environments`).then(r => r.data),
  get: (projectId: string, environmentId: string) =>
    api.get(`/projects/${projectId}/environments/${environmentId}`).then(r => r.data),
  create: (projectId: string, data: {
    name: string;
    type: string;
    base_url: string;
    credentials?: object;
    is_default?: boolean;
    is_read_only?: boolean;
    notes?: string;
  }) => api.post(`/projects/${projectId}/environments`, data).then(r => r.data),
  update: (projectId: string, environmentId: string, data: {
    name?: string;
    type?: string;
    base_url?: string;
    credentials?: object;
    is_default?: boolean;
    is_read_only?: boolean;
    notes?: string;
  }) => api.patch(`/projects/${projectId}/environments/${environmentId}`, data).then(r => r.data),
  delete: (projectId: string, environmentId: string) =>
    api.delete(`/projects/${projectId}/environments/${environmentId}`),
}

// Tests
export const testsApi = {
  list: (projectId: string, params?: { status?: string; priority?: string; tag?: string }) =>
    api.get(`/projects/${projectId}/tests`, { params }).then(r => r.data),
  get: (projectId: string, testId: string) =>
    api.get(`/projects/${projectId}/tests/${testId}`).then(r => r.data),
  create: (projectId: string, data: {
    title: string;
    description?: string;
    steps?: object[];
    expected_results?: string;
    priority?: string;
    execution_type?: string;
    tags?: string[];
    automation_config?: object;
    created_by?: string;
  }) => api.post(`/projects/${projectId}/tests`, data).then(r => r.data),
  update: (projectId: string, testId: string, data: object) =>
    api.patch(`/projects/${projectId}/tests/${testId}`, data).then(r => r.data),
  approve: (projectId: string, testId: string) =>
    api.post(`/projects/${projectId}/tests/${testId}/approve`).then(r => r.data),
  delete: (projectId: string, testId: string) =>
    api.delete(`/projects/${projectId}/tests/${testId}`),
}

// Suites
export const suitesApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/suites`).then(r => r.data),
  create: (projectId: string, data: { name: string; type?: string; test_case_ids?: string[] }) =>
    api.post(`/projects/${projectId}/suites`, data).then(r => r.data),
}

// Runs
export const runsApi = {
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/runs`).then(r => r.data),
  get: (projectId: string, runId: string) =>
    api.get(`/projects/${projectId}/runs/${runId}`).then(r => r.data),
  start: (projectId: string, data?: {
    environment_id?: string;
    suite_id?: string;
    test_case_ids?: string[];
    name?: string;
  }) => api.post(`/projects/${projectId}/runs`, data || {}).then(r => r.data),
  getResults: (projectId: string, runId: string) =>
    api.get(`/projects/${projectId}/runs/${runId}/results`).then(r => r.data),
}

// Quick Start
export const quickStartApi = {
  start: (data: {
    url: string;
    credentials?: {
      username?: string;
      password?: string;
      login_url?: string;
    };
    max_pages?: number;
  }) => api.post('/quick-start', data).then(r => r.data),
  getStatus: (sessionId: string) =>
    api.get(`/quick-start/${sessionId}`).then(r => r.data),
  saveAsProject: (sessionId: string, name: string) =>
    api.post(`/quick-start/${sessionId}/save-project?name=${encodeURIComponent(name)}`).then(r => r.data),
}

// Health
export const healthApi = {
  check: () => api.get('/health').then(r => r.data),
  ready: () => api.get('/ready').then(r => r.data),
}

export default api
