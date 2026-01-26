import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, CheckCircle, XCircle, RefreshCw, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { monitoringApi } from '@/services/api'
import type { ServiceStatus } from '@/types/monitoring'

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  return date.toLocaleString()
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function UptimeBadge({ uptime }: { uptime: number | null }) {
  if (uptime === null) return <span className="text-gray-400 text-sm">-</span>

  let colorClass = 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/50'
  if (uptime < 99) colorClass = 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/50'
  if (uptime < 95) colorClass = 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/50'

  return (
    <span className={`px-2 py-0.5 rounded text-sm font-medium ${colorClass}`}>
      {uptime.toFixed(1)}%
    </span>
  )
}

function ServiceCard({
  service,
  onViewHistory,
}: {
  service: ServiceStatus
  onViewHistory: (serviceName: string) => void
}) {
  const statusIcon = service.is_healthy ? (
    <CheckCircle className="w-5 h-5 text-green-500" />
  ) : (
    <XCircle className="w-5 h-5 text-red-500" />
  )

  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-4 hover:border-primary-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <h3 className="font-medium text-theme-text-primary">{service.service_name}</h3>
            <a
              href={service.service_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-theme-text-muted hover:text-primary-500 flex items-center gap-1"
            >
              {service.service_url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <button
          onClick={() => onViewHistory(service.service_name)}
          className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          History
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-theme-text-muted text-xs mb-1">Status</p>
          <p className={`font-medium ${service.is_healthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {service.is_healthy ? 'Healthy' : 'Unhealthy'}
          </p>
          {service.error_message && (
            <p className="text-xs text-red-500 mt-1 truncate" title={service.error_message}>
              {service.error_message}
            </p>
          )}
        </div>
        <div>
          <p className="text-theme-text-muted text-xs mb-1">Response</p>
          <p className="text-theme-text-primary">
            {service.response_time_ms ? `${service.response_time_ms}ms` : '-'}
          </p>
        </div>
        <div>
          <p className="text-theme-text-muted text-xs mb-1">Last Check</p>
          <p className="text-theme-text-primary" title={formatDate(service.last_checked)}>
            {formatTimeAgo(service.last_checked)}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-theme-border grid grid-cols-2 gap-4">
        <div>
          <p className="text-theme-text-muted text-xs mb-1">24h Uptime</p>
          <UptimeBadge uptime={service.uptime_24h} />
        </div>
        <div>
          <p className="text-theme-text-muted text-xs mb-1">7d Uptime</p>
          <UptimeBadge uptime={service.uptime_7d} />
        </div>
      </div>
    </div>
  )
}

function HistoryPanel({
  serviceName,
  onClose,
}: {
  serviceName: string
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['monitoring-history', serviceName],
    queryFn: () => monitoringApi.getHistory(serviceName, 50),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-theme-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-text-primary">
            {serviceName} History
          </h2>
          <button
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text-primary"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : data?.checks.length === 0 ? (
            <p className="text-center text-theme-text-muted py-8">No history available</p>
          ) : (
            <div className="space-y-2">
              {data?.checks.map((check, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-theme-bg-elevated"
                >
                  {check.is_healthy ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={check.is_healthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {check.is_healthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                      {check.status_code && (
                        <span className="text-theme-text-muted">HTTP {check.status_code}</span>
                      )}
                      {check.response_time_ms && (
                        <span className="text-theme-text-muted">{check.response_time_ms}ms</span>
                      )}
                    </div>
                    {check.error_message && (
                      <p className="text-xs text-red-500 truncate">{check.error_message}</p>
                    )}
                  </div>
                  <span className="text-xs text-theme-text-muted flex-shrink-0">
                    {formatDate(check.checked_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Monitoring() {
  const queryClient = useQueryClient()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['monitoring'],
    queryFn: () => monitoringApi.getStatus(false),
    refetchInterval: 60000, // Auto-refresh every minute
  })

  const refreshMutation = useMutation({
    mutationFn: () => monitoringApi.runChecks(),
    onSuccess: (newData) => {
      queryClient.setQueryData(['monitoring'], newData)
    },
  })

  const healthyCount = data?.services.filter((s) => s.is_healthy).length ?? 0
  const totalCount = data?.services.length ?? 0
  const unhealthyServices = data?.services.filter((s) => !s.is_healthy) ?? []

  // Separate into frontend and API services for better organization
  const frontendServices = data?.services.filter(
    (s) => !s.service_name.includes('API')
  ) ?? []
  const apiServices = data?.services.filter(
    (s) => s.service_name.includes('API')
  ) ?? []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Service Monitoring</h1>
          <p className="text-theme-text-secondary mt-1">
            Real-time health status of all Expertly services
          </p>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${data?.overall_healthy ? 'bg-green-100 dark:bg-green-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
              <Activity className={`w-6 h-6 ${data?.overall_healthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
            </div>
            <div>
              <p className="text-sm text-theme-text-muted">Overall Status</p>
              <p className={`text-xl font-bold ${data?.overall_healthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isLoading ? '-' : data?.overall_healthy ? 'All Systems Operational' : 'Issues Detected'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-theme-text-muted">Healthy Services</p>
              <p className="text-2xl font-bold text-theme-text-primary">
                {isLoading ? '-' : `${healthyCount} / ${totalCount}`}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Clock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-theme-text-muted">Last Updated</p>
              <p className="text-lg font-semibold text-theme-text-primary">
                {isLoading ? '-' : formatTimeAgo(data?.checked_at ?? null)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unhealthy Services Alert */}
      {unhealthyServices.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">
                {unhealthyServices.length} service{unhealthyServices.length > 1 ? 's' : ''} reporting issues
              </h3>
              <ul className="mt-2 space-y-1">
                {unhealthyServices.map((service) => (
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

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* Frontend Services */}
          <div>
            <h2 className="text-lg font-semibold text-theme-text-primary mb-4">
              Frontend Applications ({frontendServices.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {frontendServices.map((service) => (
                <ServiceCard
                  key={service.service_name}
                  service={service}
                  onViewHistory={setSelectedService}
                />
              ))}
            </div>
          </div>

          {/* API Services */}
          <div>
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-2 text-lg font-semibold text-theme-text-primary mb-4 hover:text-primary-600"
            >
              API Services ({apiServices.length})
              {showAll ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {showAll && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apiServices.map((service) => (
                  <ServiceCard
                    key={service.service_name}
                    service={service}
                    onViewHistory={setSelectedService}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* History Modal */}
      {selectedService && (
        <HistoryPanel
          serviceName={selectedService}
          onClose={() => setSelectedService(null)}
        />
      )}
    </div>
  )
}
