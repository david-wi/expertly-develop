import axios from 'axios'
import type {
  Hypothesis,
  Industry,
  IndustryTreeNode,
  Company,
  ResearchReport,
  ReportListItem,
  QueueItem,
  DashboardStats,
  LeaderboardEntry,
  AppSettings,
  QueueStatus,
  TestResult,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Current User (from identity API)
export async function getCurrentUser() {
  try {
    const response = await fetch('https://identity-api.ai.devintensive.com/api/v1/auth/me', {
      credentials: 'include',
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

// Hypotheses
export const hypothesesApi = {
  list: (status?: string) =>
    api.get<Hypothesis[]>('/v1/hypotheses', { params: { status } }).then(r => r.data),
  get: (id: string) =>
    api.get<Hypothesis>(`/v1/hypotheses/${id}`).then(r => r.data),
  create: (data: Partial<Hypothesis>) =>
    api.post<Hypothesis>('/v1/hypotheses', data).then(r => r.data),
  update: (id: string, data: Partial<Hypothesis>) =>
    api.patch<Hypothesis>(`/v1/hypotheses/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/v1/hypotheses/${id}`).then(r => r.data),
  archive: (id: string) =>
    api.post(`/v1/hypotheses/${id}/archive`).then(r => r.data),
  activate: (id: string) =>
    api.post(`/v1/hypotheses/${id}/activate`).then(r => r.data),
}

// Industries
export const industriesApi = {
  list: (params?: { level?: number; parent_id?: string }) =>
    api.get<Industry[]>('/v1/industries', { params }).then(r => r.data),
  tree: () =>
    api.get<IndustryTreeNode[]>('/v1/industries/tree').then(r => r.data),
  get: (id: string) =>
    api.get<Industry>(`/v1/industries/${id}`).then(r => r.data),
  create: (data: Partial<Industry>) =>
    api.post<Industry>('/v1/industries', data).then(r => r.data),
  update: (id: string, data: Partial<Industry>) =>
    api.patch<Industry>(`/v1/industries/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/v1/industries/${id}`).then(r => r.data),
}

// Companies
export const companiesApi = {
  list: (params?: { industry_id?: string; signal?: string; hypothesis_id?: string; search?: string }) =>
    api.get<Company[]>('/v1/companies', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<Company>(`/v1/companies/${id}`).then(r => r.data),
  create: (data: Partial<Company>) =>
    api.post<Company>('/v1/companies', data).then(r => r.data),
  update: (id: string, data: Partial<Company>) =>
    api.patch<Company>(`/v1/companies/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/v1/companies/${id}`).then(r => r.data),
  linkHypothesis: (id: string, hypothesisId: string) =>
    api.post(`/v1/companies/${id}/link-hypothesis`, { hypothesis_id: hypothesisId }).then(r => r.data),
  unlinkHypothesis: (id: string, hypothesisId: string) =>
    api.post(`/v1/companies/${id}/unlink-hypothesis`, { hypothesis_id: hypothesisId }).then(r => r.data),
  refreshFinancials: (id: string) =>
    api.post<Company>(`/v1/companies/${id}/refresh-financials`).then(r => r.data),
  searchTicker: (query: string) =>
    api.get<Array<{ ticker: string; name: string; exchange?: string; sector?: string }>>(`/v1/companies/search-ticker/${query}`).then(r => r.data),
}

// Reports
export const reportsApi = {
  list: (params?: { company_id?: string; limit?: number }) =>
    api.get<ReportListItem[]>('/v1/reports', { params }).then(r => r.data),
  get: (id: string) =>
    api.get<ResearchReport>(`/v1/reports/${id}`).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/v1/reports/${id}`).then(r => r.data),
  generate: (companyId: string) =>
    api.post<ResearchReport>(`/v1/reports/generate/${companyId}`).then(r => r.data),
  backfill: () =>
    api.post<{ updated: number; errors: Array<{ ticker: string; error: string }> }>('/v1/reports/backfill').then(r => r.data),
}

// Queue
export const queueApi = {
  list: (status?: string) =>
    api.get<QueueItem[]>('/v1/queue', { params: { status } }).then(r => r.data),
  add: (data: { company_id: string; company_name: string; company_ticker: string; priority?: number; notes?: string }) =>
    api.post<QueueItem>('/v1/queue', data).then(r => r.data),
  addBatch: (items: Array<{ company_id: string; company_name: string; company_ticker: string; priority?: number }>) =>
    api.post('/v1/queue/batch', { items }).then(r => r.data),
  status: () =>
    api.get<QueueStatus>('/v1/queue/status').then(r => r.data),
  process: () =>
    api.post('/v1/queue/process').then(r => r.data),
  retry: (id: string) =>
    api.post(`/v1/queue/${id}/retry`).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/v1/queue/${id}`).then(r => r.data),
  clearCompleted: () =>
    api.post('/v1/queue/clear-completed').then(r => r.data),
}

// Dashboard
export const dashboardApi = {
  stats: () =>
    api.get<DashboardStats>('/v1/dashboard/stats').then(r => r.data),
  leaderboard: (params?: { hypothesis_id?: string; industry_id?: string; signal?: string; limit?: number }) =>
    api.get<LeaderboardEntry[]>('/v1/dashboard/leaderboard', { params }).then(r => r.data),
  byHypothesis: (id: string) =>
    api.get(`/v1/dashboard/by-hypothesis/${id}`).then(r => r.data),
  byIndustry: (id: string) =>
    api.get(`/v1/dashboard/by-industry/${id}`).then(r => r.data),
}

// Settings
export const settingsApi = {
  get: () =>
    api.get<AppSettings>('/v1/settings').then(r => r.data),
  update: (data: Partial<{ anthropic_api_key: string; sec_edgar_user_agent: string; queue_batch_size: number; default_model: string }>) =>
    api.patch<AppSettings>('/v1/settings', data).then(r => r.data),
  testClaude: () =>
    api.post<TestResult>('/v1/settings/test-claude').then(r => r.data),
  testSec: () =>
    api.post<TestResult>('/v1/settings/test-sec').then(r => r.data),
}
