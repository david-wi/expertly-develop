export type ErrorSeverity = 'info' | 'warning' | 'error'

export type ErrorStatus = 'new' | 'acknowledged' | 'resolved'

export interface ErrorLog {
  id: string
  app_name: string
  error_message: string
  stack_trace: string | null
  url: string | null
  user_id: string | null
  user_email: string | null
  org_id: string | null
  browser_info: string | null
  additional_context: Record<string, unknown> | null
  severity: ErrorSeverity
  status: ErrorStatus
  occurred_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  created_at: string
}

export interface ErrorLogCreate {
  app_name: string
  error_message: string
  stack_trace?: string
  url?: string
  user_id?: string
  user_email?: string
  org_id?: string
  browser_info?: string
  additional_context?: Record<string, unknown>
  severity?: ErrorSeverity
  occurred_at?: string
}

export interface ErrorLogUpdate {
  status?: ErrorStatus
}

export interface ErrorLogListResponse {
  errors: ErrorLog[]
  total: number
}

export interface AppErrorCount {
  app_name: string
  count: number
}

export interface StatusErrorCount {
  status: string
  count: number
}

export interface SeverityErrorCount {
  severity: string
  count: number
}

export interface ErrorStatsResponse {
  total: number
  by_app: AppErrorCount[]
  by_status: StatusErrorCount[]
  by_severity: SeverityErrorCount[]
  last_24h: number
  last_7d: number
}

export interface ErrorLogFilters {
  app_name?: string
  status?: ErrorStatus
  severity?: ErrorSeverity
  start_date?: string
  end_date?: string
  skip?: number
  limit?: number
}
