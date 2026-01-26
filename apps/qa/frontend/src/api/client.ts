import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token storage keys
const ACCESS_TOKEN_KEY = 'vibeqa_access_token'
const REFRESH_TOKEN_KEY = 'vibeqa_refresh_token'

// Token management
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

// Request interceptor - add auth header
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle token refresh
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = tokenStorage.getRefreshToken()

      if (!refreshToken) {
        tokenStorage.clearTokens()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const response = await axios.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        })

        const { access_token, refresh_token: newRefreshToken } = response.data
        tokenStorage.setTokens(access_token, newRefreshToken)

        processQueue(null, access_token)

        originalRequest.headers.Authorization = `Bearer ${access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        tokenStorage.clearTokens()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  register: (data: {
    email: string
    password: string
    full_name: string
    organization_name: string
  }) =>
    api.post('/auth/register', data).then((r) => {
      tokenStorage.setTokens(r.data.access_token, r.data.refresh_token)
      return r.data
    }),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => {
      tokenStorage.setTokens(r.data.access_token, r.data.refresh_token)
      return r.data
    }),

  logout: () => {
    tokenStorage.clearTokens()
  },

  me: () => api.get('/auth/me').then((r) => r.data),

  isAuthenticated: () => !!tokenStorage.getAccessToken(),
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
