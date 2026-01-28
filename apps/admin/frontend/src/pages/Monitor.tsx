import { useState, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Globe,
  Server,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react'
import { monitoringApi } from '@/services/api'
import type { ServiceStatus, MonitoringResponse } from '@/types/monitoring'

const POLL_INTERVAL = 10000 // 10 seconds

function formatTime(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleTimeString()
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)

  if (diffSecs < 10) return 'Just now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  return `${diffHours}h ago`
}

function StatusIcon({ isHealthy, isChecking }: { isHealthy: boolean; isChecking: boolean }) {
  if (isChecking) {
    return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
  }
  return isHealthy ? (
    <CheckCircle className="w-5 h-5 text-green-500" />
  ) : (
    <XCircle className="w-5 h-5 text-red-500" />
  )
}

function ServiceRow({ service, isChecking }: { service: ServiceStatus; isChecking: boolean }) {
  const isApi = service.service_name.includes('API')

  return (
    <tr className="border-b border-theme-border hover:bg-theme-bg-elevated/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <StatusIcon isHealthy={service.is_healthy} isChecking={isChecking} />
          <div>
            <div className="font-medium text-theme-text-primary">{service.service_name}</div>
            <a
              href={service.service_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-theme-text-muted hover:text-primary-500"
            >
              {service.service_url}
            </a>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            isApi
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
          }`}
        >
          {isApi ? <Server className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
          {isApi ? 'API' : 'Frontend'}
        </span>
      </td>
      <td className="py-3 px-4">
        {isChecking ? (
          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            Checking...
          </span>
        ) : (
          <span
            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
              service.is_healthy
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
            }`}
          >
            {service.is_healthy ? 'Healthy' : 'Unhealthy'}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-theme-text-secondary">
        {service.status_code ?? '-'}
      </td>
      <td className="py-3 px-4 text-sm text-theme-text-secondary">
        {service.response_time_ms ? `${service.response_time_ms}ms` : '-'}
      </td>
      <td className="py-3 px-4 text-sm text-theme-text-secondary" title={formatTime(service.last_checked)}>
        {formatTimeAgo(service.last_checked)}
      </td>
      <td className="py-3 px-4">
        {service.error_message && (
          <span className="text-xs text-red-500" title={service.error_message}>
            {service.error_message.substring(0, 40)}{service.error_message.length > 40 ? '...' : ''}
          </span>
        )}
        {!service.error_message && service.uptime_24h !== null && (
          <span className={`text-xs ${service.uptime_24h >= 99 ? 'text-green-500' : service.uptime_24h >= 95 ? 'text-yellow-500' : 'text-red-500'}`}>
            24h: {service.uptime_24h.toFixed(1)}%
          </span>
        )}
      </td>
    </tr>
  )
}

export function Monitor() {
  const [data, setData] = useState<MonitoringResponse | null>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [nextPollIn, setNextPollIn] = useState(POLL_INTERVAL / 1000)

  const checkMutation = useMutation({
    mutationFn: () => monitoringApi.runChecks(),
    onSuccess: (newData) => {
      setData(newData)
      setNextPollIn(POLL_INTERVAL / 1000)
    },
  })

  const runCheck = useCallback(() => {
    checkMutation.mutate()
  }, [checkMutation])

  // Initial check
  useEffect(() => {
    runCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling interval
  useEffect(() => {
    if (!isPolling) return

    const pollInterval = setInterval(() => {
      runCheck()
    }, POLL_INTERVAL)

    return () => clearInterval(pollInterval)
  }, [runCheck, isPolling])

  // Countdown timer
  useEffect(() => {
    if (!isPolling) return

    const countdownInterval = setInterval(() => {
      setNextPollIn((prev) => (prev > 0 ? prev - 1 : POLL_INTERVAL / 1000))
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [isPolling])

  const services = data?.services ?? []
  const healthyCount = services.filter((s) => s.is_healthy).length
  const unhealthyCount = services.filter((s) => !s.is_healthy).length
  const frontendServices = services.filter((s) => !s.service_name.includes('API'))
  const apiServices = services.filter((s) => s.service_name.includes('API'))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Live Monitor</h1>
          <p className="text-theme-text-secondary mt-1">
            Real-time service health checks every 10 seconds
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-theme-text-muted">
            {isPolling ? (
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Next poll in {nextPollIn}s
              </span>
            ) : (
              <span className="text-yellow-500">Polling paused</span>
            )}
          </div>
          <button
            onClick={() => setIsPolling(!isPolling)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isPolling
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300'
                : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300'
            }`}
          >
            {isPolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPolling ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={runCheck}
            disabled={checkMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checkMutation.isPending ? 'animate-spin' : ''}`} />
            Check Now
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${data?.overall_healthy ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
              {data?.overall_healthy ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <p className={`text-lg font-bold ${data?.overall_healthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {data ? (data.overall_healthy ? 'All Healthy' : 'Issues') : '-'}
              </p>
              <p className="text-xs text-theme-text-muted">Overall Status</p>
            </div>
          </div>
        </div>
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{healthyCount}</p>
              <p className="text-xs text-theme-text-muted">Healthy</p>
            </div>
          </div>
        </div>
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{unhealthyCount}</p>
              <p className="text-xs text-theme-text-muted">Unhealthy</p>
            </div>
          </div>
        </div>
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-theme-text-primary">
                {data?.checked_at ? formatTime(data.checked_at) : '-'}
              </p>
              <p className="text-xs text-theme-text-muted">Last Check</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unhealthy Alert */}
      {unhealthyCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">
                {unhealthyCount} service{unhealthyCount > 1 ? 's' : ''} reporting issues
              </h3>
              <ul className="mt-2 space-y-1">
                {services.filter(s => !s.is_healthy).map((service) => (
                  <li key={service.service_name} className="text-sm text-red-700 dark:text-red-300">
                    <span className="font-medium">{service.service_name}</span>
                    {service.error_message && (
                      <span className="text-red-600 dark:text-red-400"> - {service.error_message}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Frontend Services Table */}
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
        <div className="px-4 py-3 border-b border-theme-border bg-theme-bg-elevated">
          <h2 className="font-semibold text-theme-text-primary flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Frontend Applications ({frontendServices.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-theme-bg-elevated text-left text-xs text-theme-text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Response</th>
                <th className="py-3 px-4">Checked</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {frontendServices.length === 0 && !checkMutation.isPending ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-theme-text-muted">
                    No frontend services found
                  </td>
                </tr>
              ) : (
                frontendServices.map((service) => (
                  <ServiceRow key={service.service_name} service={service} isChecking={checkMutation.isPending} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Services Table */}
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border overflow-hidden">
        <div className="px-4 py-3 border-b border-theme-border bg-theme-bg-elevated">
          <h2 className="font-semibold text-theme-text-primary flex items-center gap-2">
            <Server className="w-4 h-4" />
            Backend APIs ({apiServices.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-theme-bg-elevated text-left text-xs text-theme-text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Response</th>
                <th className="py-3 px-4">Checked</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {apiServices.length === 0 && !checkMutation.isPending ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-theme-text-muted">
                    No API services found
                  </td>
                </tr>
              ) : (
                apiServices.map((service) => (
                  <ServiceRow key={service.service_name} service={service} isChecking={checkMutation.isPending} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Note */}
      <div className="text-sm text-theme-text-muted bg-theme-bg-elevated rounded-lg p-4">
        <p>
          Health checks are performed server-side by the admin backend to avoid browser CORS restrictions.
          Each service's health endpoint is checked and response times are measured.
        </p>
      </div>
    </div>
  )
}
