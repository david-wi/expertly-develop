export interface HealthCheckResult {
  service_name: string
  service_url: string
  is_healthy: boolean
  status_code: number | null
  response_time_ms: number | null
  error_message: string | null
  checked_at: string
}

export interface ServiceStatus {
  service_name: string
  service_url: string
  is_healthy: boolean
  status_code: number | null
  response_time_ms: number | null
  error_message: string | null
  last_checked: string | null
  uptime_24h: number | null
  uptime_7d: number | null
  total_checks_24h: number
  healthy_checks_24h: number
}

export interface MonitoringResponse {
  services: ServiceStatus[]
  overall_healthy: boolean
  checked_at: string
}

export interface HealthHistoryResponse {
  service_name: string
  checks: HealthCheckResult[]
  total: number
}
