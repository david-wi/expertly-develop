import axios from 'axios'
import type {
  Theme,
  ThemeListResponse,
  ThemeVersionListResponse,
  ThemeCreateInput,
  ThemeUpdateInput,
} from '@/types/theme'
import type {
  MonitoringResponse,
  HealthHistoryResponse,
} from '@/types/monitoring'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// Identity service URL for authentication
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

const api = axios.create({
  baseURL: API_URL,
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
      const returnUrl = window.location.href
      const loginUrl = new URL('/login', IDENTITY_URL)
      loginUrl.searchParams.set('return_url', returnUrl)
      window.location.href = loginUrl.toString()
      return new Promise(() => {}) // Never resolve - we're redirecting
    }
    return Promise.reject(error)
  }
)

// Theme API
export const themesApi = {
  list: async (includeInactive = false): Promise<ThemeListResponse> => {
    const response = await api.get<ThemeListResponse>('/themes', {
      params: { include_inactive: includeInactive },
    })
    return response.data
  },

  get: async (id: string): Promise<Theme> => {
    const response = await api.get<Theme>(`/themes/${id}`)
    return response.data
  },

  create: async (data: ThemeCreateInput): Promise<Theme> => {
    const response = await api.post<Theme>('/themes', data)
    return response.data
  },

  update: async (id: string, data: ThemeUpdateInput): Promise<Theme> => {
    const response = await api.put<Theme>(`/themes/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/themes/${id}`)
  },

  getVersions: async (id: string): Promise<ThemeVersionListResponse> => {
    const response = await api.get<ThemeVersionListResponse>(`/themes/${id}/versions`)
    return response.data
  },

  restoreVersion: async (themeId: string, versionId: string, changedBy?: string): Promise<Theme> => {
    const response = await api.post<Theme>(
      `/themes/${themeId}/restore/${versionId}`,
      null,
      { params: { changed_by: changedBy } }
    )
    return response.data
  },
}

// Users API
export interface CurrentUser {
  id: string
  name: string
  email: string
  organization_id: string | null
}

export const usersApi = {
  me: async (): Promise<CurrentUser> => {
    const response = await api.get<CurrentUser>('/users/me')
    return response.data
  },
}

// Monitoring API
export const monitoringApi = {
  getStatus: async (refresh = false): Promise<MonitoringResponse> => {
    const response = await api.get<MonitoringResponse>('/monitoring', {
      params: { refresh },
    })
    return response.data
  },

  runChecks: async (): Promise<MonitoringResponse> => {
    const response = await api.post<MonitoringResponse>('/monitoring/check')
    return response.data
  },

  getHistory: async (serviceName: string, limit = 100): Promise<HealthHistoryResponse> => {
    const response = await api.get<HealthHistoryResponse>(`/monitoring/history/${encodeURIComponent(serviceName)}`, {
      params: { limit },
    })
    return response.data
  },
}

export default api
