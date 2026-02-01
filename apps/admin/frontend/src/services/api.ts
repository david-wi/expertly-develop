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
import type {
  ErrorLog,
  ErrorLogListResponse,
  ErrorStatsResponse,
  ErrorLogUpdate,
  ErrorLogFilters,
} from '@/types/error_logs'
import type {
  AIProvider,
  AIProviderListResponse,
  AIProviderCreate,
  AIProviderUpdate,
  AIModel,
  AIModelListResponse,
  AIModelCreate,
  AIModelUpdate,
  AIUseCaseConfig,
  AIUseCaseConfigListResponse,
  AIUseCaseConfigCreate,
  AIUseCaseConfigUpdate,
} from '@/types/ai_config'
import type {
  TestScenario,
  TestScenarioListResponse,
  TestScenarioCreate,
  TestScenarioUpdate,
  TestScenarioStats,
  TestScenarioFilters,
  TestRun,
  TestRunListResponse,
  TestRunCreate,
} from '@/types/test_scenarios'

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

// Error Logs API
export const errorLogsApi = {
  list: async (filters: ErrorLogFilters = {}): Promise<ErrorLogListResponse> => {
    const response = await api.get<ErrorLogListResponse>('/error-logs', {
      params: filters,
    })
    return response.data
  },

  get: async (id: string): Promise<ErrorLog> => {
    const response = await api.get<ErrorLog>(`/error-logs/${id}`)
    return response.data
  },

  update: async (id: string, data: ErrorLogUpdate): Promise<ErrorLog> => {
    const response = await api.patch<ErrorLog>(`/error-logs/${id}`, data)
    return response.data
  },

  getStats: async (): Promise<ErrorStatsResponse> => {
    const response = await api.get<ErrorStatsResponse>('/error-logs/stats')
    return response.data
  },

  getApps: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/error-logs/apps')
    return response.data
  },
}

// AI Config API
export const aiConfigApi = {
  // Providers
  listProviders: async (includeInactive = false): Promise<AIProviderListResponse> => {
    const response = await api.get<AIProviderListResponse>('/ai-config/providers', {
      params: { include_inactive: includeInactive },
    })
    return response.data
  },

  getProvider: async (id: string): Promise<AIProvider> => {
    const response = await api.get<AIProvider>(`/ai-config/providers/${id}`)
    return response.data
  },

  createProvider: async (data: AIProviderCreate): Promise<AIProvider> => {
    const response = await api.post<AIProvider>('/ai-config/providers', data)
    return response.data
  },

  updateProvider: async (id: string, data: AIProviderUpdate): Promise<AIProvider> => {
    const response = await api.put<AIProvider>(`/ai-config/providers/${id}`, data)
    return response.data
  },

  deleteProvider: async (id: string): Promise<void> => {
    await api.delete(`/ai-config/providers/${id}`)
  },

  // Models
  listModels: async (includeInactive = false, providerId?: string): Promise<AIModelListResponse> => {
    const response = await api.get<AIModelListResponse>('/ai-config/models', {
      params: { include_inactive: includeInactive, provider_id: providerId },
    })
    return response.data
  },

  getModel: async (id: string): Promise<AIModel> => {
    const response = await api.get<AIModel>(`/ai-config/models/${id}`)
    return response.data
  },

  createModel: async (data: AIModelCreate): Promise<AIModel> => {
    const response = await api.post<AIModel>('/ai-config/models', data)
    return response.data
  },

  updateModel: async (id: string, data: AIModelUpdate): Promise<AIModel> => {
    const response = await api.put<AIModel>(`/ai-config/models/${id}`, data)
    return response.data
  },

  deleteModel: async (id: string): Promise<void> => {
    await api.delete(`/ai-config/models/${id}`)
  },

  // Use Cases
  listUseCases: async (includeInactive = false): Promise<AIUseCaseConfigListResponse> => {
    const response = await api.get<AIUseCaseConfigListResponse>('/ai-config/use-cases', {
      params: { include_inactive: includeInactive },
    })
    return response.data
  },

  getUseCase: async (id: string): Promise<AIUseCaseConfig> => {
    const response = await api.get<AIUseCaseConfig>(`/ai-config/use-cases/${id}`)
    return response.data
  },

  createUseCase: async (data: AIUseCaseConfigCreate): Promise<AIUseCaseConfig> => {
    const response = await api.post<AIUseCaseConfig>('/ai-config/use-cases', data)
    return response.data
  },

  updateUseCase: async (id: string, data: AIUseCaseConfigUpdate): Promise<AIUseCaseConfig> => {
    const response = await api.put<AIUseCaseConfig>(`/ai-config/use-cases/${id}`, data)
    return response.data
  },

  updateUseCaseByName: async (name: string, data: AIUseCaseConfigUpdate): Promise<AIUseCaseConfig> => {
    const response = await api.put<AIUseCaseConfig>(`/ai-config/use-cases/by-name/${name}`, data)
    return response.data
  },

  deleteUseCase: async (id: string): Promise<void> => {
    await api.delete(`/ai-config/use-cases/${id}`)
  },
}

// Test Scenarios API
export const testScenariosApi = {
  list: async (filters: TestScenarioFilters = {}): Promise<TestScenarioListResponse> => {
    const response = await api.get<TestScenarioListResponse>('/test-scenarios', {
      params: filters,
    })
    return response.data
  },

  get: async (id: string): Promise<TestScenario> => {
    const response = await api.get<TestScenario>(`/test-scenarios/${id}`)
    return response.data
  },

  create: async (data: TestScenarioCreate): Promise<TestScenario> => {
    const response = await api.post<TestScenario>('/test-scenarios', data)
    return response.data
  },

  update: async (id: string, data: TestScenarioUpdate): Promise<TestScenario> => {
    const response = await api.put<TestScenario>(`/test-scenarios/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/test-scenarios/${id}`)
  },

  getStats: async (): Promise<TestScenarioStats> => {
    const response = await api.get<TestScenarioStats>('/test-scenarios/stats')
    return response.data
  },

  getApps: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/test-scenarios/apps')
    return response.data
  },

  getCategories: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/test-scenarios/categories')
    return response.data
  },

  // Test Runs
  listRuns: async (scenarioId: string, filters: { status?: string; environment?: string; skip?: number; limit?: number } = {}): Promise<TestRunListResponse> => {
    const response = await api.get<TestRunListResponse>(`/test-scenarios/${scenarioId}/runs`, {
      params: filters,
    })
    return response.data
  },

  getRun: async (runId: string): Promise<TestRun> => {
    const response = await api.get<TestRun>(`/test-scenarios/runs/${runId}`)
    return response.data
  },

  reportRun: async (data: TestRunCreate): Promise<TestRun> => {
    const response = await api.post<TestRun>('/test-scenarios/runs', data)
    return response.data
  },
}

export default api
