import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { themesApi, usersApi, monitoringApi, errorLogsApi } from './api'
import type { ThemeColors, ThemeListResponse, ThemeVersionListResponse, Theme, ThemeCreateInput, ThemeUpdateInput } from '@/types/theme'
import type { MonitoringResponse, HealthHistoryResponse } from '@/types/monitoring'
import type { ErrorLogListResponse, ErrorStatsResponse, ErrorLog } from '@/types/error_logs'

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

// Get the mocked axios instance
const mockAxios = axios.create() as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const mockColors: ThemeColors = {
  light: {
    primary: {
      '50': '#f0f9ff',
      '100': '#e0f2fe',
      '200': '#bae6fd',
      '300': '#7dd3fc',
      '400': '#38bdf8',
      '500': '#0ea5e9',
      '600': '#0284c7',
      '700': '#0369a1',
      '800': '#075985',
      '900': '#0c4a6e',
      '950': '#082f49',
    },
    background: {
      default: '#ffffff',
      surface: '#f8fafc',
      elevated: '#f1f5f9',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#94a3b8',
    },
    border: {
      default: '#e2e8f0',
      subtle: '#f1f5f9',
    },
  },
  dark: {
    primary: {
      '50': '#f0f9ff',
      '100': '#e0f2fe',
      '200': '#bae6fd',
      '300': '#7dd3fc',
      '400': '#38bdf8',
      '500': '#0ea5e9',
      '600': '#0284c7',
      '700': '#0369a1',
      '800': '#075985',
      '900': '#0c4a6e',
      '950': '#082f49',
    },
    background: {
      default: '#0f172a',
      surface: '#1e293b',
      elevated: '#334155',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      muted: '#64748b',
    },
    border: {
      default: '#334155',
      subtle: '#1e293b',
    },
  },
}

const mockTheme: Theme = {
  id: '1',
  name: 'Test Theme',
  slug: 'test-theme',
  description: 'A test theme',
  is_default: false,
  is_active: true,
  current_version: 1,
  colors: mockColors,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('themesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('list', () => {
    it('fetches themes list without inactive', async () => {
      const mockResponse: ThemeListResponse = {
        themes: [mockTheme],
        total: 1,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await themesApi.list()

      expect(mockAxios.get).toHaveBeenCalledWith('/themes', {
        params: { include_inactive: false },
      })
      expect(result).toEqual(mockResponse)
    })

    it('fetches themes list with inactive', async () => {
      const mockResponse: ThemeListResponse = {
        themes: [mockTheme],
        total: 1,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await themesApi.list(true)

      expect(mockAxios.get).toHaveBeenCalledWith('/themes', {
        params: { include_inactive: true },
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('get', () => {
    it('fetches a single theme by id', async () => {
      mockAxios.get.mockResolvedValue({ data: mockTheme })

      const result = await themesApi.get('1')

      expect(mockAxios.get).toHaveBeenCalledWith('/themes/1')
      expect(result).toEqual(mockTheme)
    })
  })

  describe('create', () => {
    it('creates a new theme', async () => {
      const createInput: ThemeCreateInput = {
        name: 'New Theme',
        slug: 'new-theme',
        colors: mockColors,
      }
      mockAxios.post.mockResolvedValue({ data: mockTheme })

      const result = await themesApi.create(createInput)

      expect(mockAxios.post).toHaveBeenCalledWith('/themes', createInput)
      expect(result).toEqual(mockTheme)
    })
  })

  describe('update', () => {
    it('updates an existing theme', async () => {
      const updateInput: ThemeUpdateInput = {
        name: 'Updated Theme',
        change_summary: 'Updated name',
        changed_by: 'admin',
      }
      mockAxios.put.mockResolvedValue({ data: mockTheme })

      const result = await themesApi.update('1', updateInput)

      expect(mockAxios.put).toHaveBeenCalledWith('/themes/1', updateInput)
      expect(result).toEqual(mockTheme)
    })
  })

  describe('delete', () => {
    it('deletes a theme', async () => {
      mockAxios.delete.mockResolvedValue({})

      await themesApi.delete('1')

      expect(mockAxios.delete).toHaveBeenCalledWith('/themes/1')
    })
  })

  describe('getVersions', () => {
    it('fetches version history for a theme', async () => {
      const mockResponse: ThemeVersionListResponse = {
        versions: [
          {
            id: 'v1',
            version_number: 1,
            snapshot: mockColors,
            change_summary: 'Initial version',
            changed_by: 'admin',
            changed_at: '2024-01-01T00:00:00Z',
            status: 'active',
          },
        ],
        total: 1,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await themesApi.getVersions('1')

      expect(mockAxios.get).toHaveBeenCalledWith('/themes/1/versions')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('restoreVersion', () => {
    it('restores a theme to a previous version', async () => {
      mockAxios.post.mockResolvedValue({ data: mockTheme })

      const result = await themesApi.restoreVersion('1', 'v1', 'admin')

      expect(mockAxios.post).toHaveBeenCalledWith('/themes/1/restore/v1', null, {
        params: { changed_by: 'admin' },
      })
      expect(result).toEqual(mockTheme)
    })

    it('restores without changed_by', async () => {
      mockAxios.post.mockResolvedValue({ data: mockTheme })

      const result = await themesApi.restoreVersion('1', 'v1')

      expect(mockAxios.post).toHaveBeenCalledWith('/themes/1/restore/v1', null, {
        params: { changed_by: undefined },
      })
      expect(result).toEqual(mockTheme)
    })
  })
})

describe('usersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('me', () => {
    it('fetches current user', async () => {
      const mockUser = {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        organization_id: 'org1',
      }
      mockAxios.get.mockResolvedValue({ data: mockUser })

      const result = await usersApi.me()

      expect(mockAxios.get).toHaveBeenCalledWith('/users/me')
      expect(result).toEqual(mockUser)
    })
  })
})

describe('monitoringApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStatus', () => {
    it('fetches monitoring status', async () => {
      const mockResponse: MonitoringResponse = {
        services: [
          {
            service_name: 'Test Service',
            service_url: 'https://test.example.com',
            is_healthy: true,
            status_code: 200,
            response_time_ms: 100,
            error_message: null,
            last_checked: '2024-01-01T00:00:00Z',
            uptime_24h: 99.9,
            uptime_7d: 99.5,
            total_checks_24h: 288,
            healthy_checks_24h: 287,
          },
        ],
        overall_healthy: true,
        checked_at: '2024-01-01T00:00:00Z',
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await monitoringApi.getStatus()

      expect(mockAxios.get).toHaveBeenCalledWith('/monitoring', {
        params: { refresh: false },
      })
      expect(result).toEqual(mockResponse)
    })

    it('fetches monitoring status with refresh', async () => {
      const mockResponse: MonitoringResponse = {
        services: [],
        overall_healthy: true,
        checked_at: '2024-01-01T00:00:00Z',
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      await monitoringApi.getStatus(true)

      expect(mockAxios.get).toHaveBeenCalledWith('/monitoring', {
        params: { refresh: true },
      })
    })
  })

  describe('runChecks', () => {
    it('runs health checks', async () => {
      const mockResponse: MonitoringResponse = {
        services: [],
        overall_healthy: true,
        checked_at: '2024-01-01T00:00:00Z',
      }
      mockAxios.post.mockResolvedValue({ data: mockResponse })

      const result = await monitoringApi.runChecks()

      expect(mockAxios.post).toHaveBeenCalledWith('/monitoring/check')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getHistory', () => {
    it('fetches health check history', async () => {
      const mockResponse: HealthHistoryResponse = {
        service_name: 'Test Service',
        checks: [
          {
            service_name: 'Test Service',
            service_url: 'https://test.example.com',
            is_healthy: true,
            status_code: 200,
            response_time_ms: 100,
            error_message: null,
            checked_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await monitoringApi.getHistory('Test Service', 50)

      expect(mockAxios.get).toHaveBeenCalledWith('/monitoring/history/Test%20Service', {
        params: { limit: 50 },
      })
      expect(result).toEqual(mockResponse)
    })

    it('uses default limit of 100', async () => {
      const mockResponse: HealthHistoryResponse = {
        service_name: 'Test Service',
        checks: [],
        total: 0,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      await monitoringApi.getHistory('Test Service')

      expect(mockAxios.get).toHaveBeenCalledWith('/monitoring/history/Test%20Service', {
        params: { limit: 100 },
      })
    })
  })
})

describe('errorLogsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockErrorLog: ErrorLog = {
    id: 'err1',
    app_name: 'test-app',
    error_message: 'Test error',
    stack_trace: 'Error at test.js:1',
    url: 'https://test.example.com/page',
    user_id: 'user1',
    user_email: 'test@example.com',
    org_id: 'org1',
    browser_info: 'Chrome 120',
    additional_context: { key: 'value' },
    severity: 'error',
    status: 'new',
    occurred_at: '2024-01-01T00:00:00Z',
    acknowledged_at: null,
    resolved_at: null,
    created_at: '2024-01-01T00:00:00Z',
  }

  describe('list', () => {
    it('fetches error logs with filters', async () => {
      const mockResponse: ErrorLogListResponse = {
        errors: [mockErrorLog],
        total: 1,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const filters = { app_name: 'test-app', limit: 50 }
      const result = await errorLogsApi.list(filters)

      expect(mockAxios.get).toHaveBeenCalledWith('/error-logs', {
        params: filters,
      })
      expect(result).toEqual(mockResponse)
    })

    it('fetches error logs without filters', async () => {
      const mockResponse: ErrorLogListResponse = {
        errors: [],
        total: 0,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await errorLogsApi.list()

      expect(mockAxios.get).toHaveBeenCalledWith('/error-logs', {
        params: {},
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('get', () => {
    it('fetches a single error log', async () => {
      mockAxios.get.mockResolvedValue({ data: mockErrorLog })

      const result = await errorLogsApi.get('err1')

      expect(mockAxios.get).toHaveBeenCalledWith('/error-logs/err1')
      expect(result).toEqual(mockErrorLog)
    })
  })

  describe('update', () => {
    it('updates error log status', async () => {
      const updatedError = { ...mockErrorLog, status: 'acknowledged' as const }
      mockAxios.patch.mockResolvedValue({ data: updatedError })

      const result = await errorLogsApi.update('err1', { status: 'acknowledged' })

      expect(mockAxios.patch).toHaveBeenCalledWith('/error-logs/err1', { status: 'acknowledged' })
      expect(result).toEqual(updatedError)
    })
  })

  describe('getStats', () => {
    it('fetches error statistics', async () => {
      const mockResponse: ErrorStatsResponse = {
        total: 10,
        by_app: [{ app_name: 'test-app', count: 5 }],
        by_status: [{ status: 'new', count: 3 }],
        by_severity: [{ severity: 'error', count: 7 }],
        last_24h: 2,
        last_7d: 8,
      }
      mockAxios.get.mockResolvedValue({ data: mockResponse })

      const result = await errorLogsApi.getStats()

      expect(mockAxios.get).toHaveBeenCalledWith('/error-logs/stats')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getApps', () => {
    it('fetches list of apps with errors', async () => {
      const mockApps = ['app1', 'app2', 'app3']
      mockAxios.get.mockResolvedValue({ data: mockApps })

      const result = await errorLogsApi.getApps()

      expect(mockAxios.get).toHaveBeenCalledWith('/error-logs/apps')
      expect(result).toEqual(mockApps)
    })
  })
})
