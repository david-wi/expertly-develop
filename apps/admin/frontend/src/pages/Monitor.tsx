import { useState, useEffect, useCallback } from 'react'
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

interface ServiceCheck {
  name: string
  url: string
  type: 'api' | 'frontend'
  status: 'checking' | 'healthy' | 'unhealthy' | 'error'
  responseTime?: number
  statusCode?: number
  error?: string
  lastChecked?: Date
  renderCheck?: {
    hasRoot: boolean
    hasTitle: boolean
    contentLength: number
  }
}

const SERVICES = [
  // Frontend apps
  { name: 'Define', url: 'https://define.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Develop', url: 'https://develop.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Identity', url: 'https://identity.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Admin', url: 'https://admin.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Manage', url: 'https://manage.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Salon', url: 'https://salon.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Today', url: 'https://today.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Vibetest', url: 'https://vibetest.ai.devintensive.com', type: 'frontend' as const },
  { name: 'Vibecode', url: 'https://vibecode.ai.devintensive.com', type: 'frontend' as const },
  // Backend APIs
  { name: 'Define API', url: 'https://define-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Develop API', url: 'https://develop-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Identity API', url: 'https://identity-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Admin API', url: 'https://admin-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Manage API', url: 'https://manage-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Salon API', url: 'https://salon-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Today API', url: 'https://today-api.ai.devintensive.com/health', type: 'api' as const },
  { name: 'Vibetest API', url: 'https://vibetest.ai.devintensive.com/api/v1/health', type: 'api' as const },
]

const POLL_INTERVAL = 10000 // 10 seconds

function formatTime(date: Date | undefined): string {
  if (!date) return '-'
  return date.toLocaleTimeString()
}

function StatusIcon({ status }: { status: ServiceCheck['status'] }) {
  switch (status) {
    case 'checking':
      return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case 'unhealthy':
      return <XCircle className="w-5 h-5 text-red-500" />
    case 'error':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
  }
}

function ServiceRow({ service }: { service: ServiceCheck }) {
  return (
    <tr className="border-b border-theme-border hover:bg-theme-bg-elevated/50">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <StatusIcon status={service.status} />
          <div>
            <div className="font-medium text-theme-text-primary">{service.name}</div>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-theme-text-muted hover:text-primary-500"
            >
              {service.url}
            </a>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            service.type === 'api'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
          }`}
        >
          {service.type === 'api' ? <Server className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
          {service.type === 'api' ? 'API' : 'Frontend'}
        </span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
            service.status === 'healthy'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
              : service.status === 'unhealthy'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                : service.status === 'error'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          {service.status === 'checking' ? 'Checking...' : service.status}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-theme-text-secondary">
        {service.statusCode ?? '-'}
      </td>
      <td className="py-3 px-4 text-sm text-theme-text-secondary">
        {service.responseTime ? `${service.responseTime}ms` : '-'}
      </td>
      <td className="py-3 px-4 text-sm text-theme-text-secondary">
        {formatTime(service.lastChecked)}
      </td>
      <td className="py-3 px-4">
        {service.error && (
          <span className="text-xs text-red-500" title={service.error}>
            {service.error.substring(0, 30)}...
          </span>
        )}
        {service.renderCheck && (
          <div className="flex gap-2 text-xs">
            <span
              className={service.renderCheck.hasRoot ? 'text-green-500' : 'text-red-500'}
              title="Has #root element"
            >
              root:{service.renderCheck.hasRoot ? '✓' : '✗'}
            </span>
            <span
              className={service.renderCheck.hasTitle ? 'text-green-500' : 'text-red-500'}
              title="Has title"
            >
              title:{service.renderCheck.hasTitle ? '✓' : '✗'}
            </span>
            <span className="text-theme-text-muted">{service.renderCheck.contentLength}b</span>
          </div>
        )}
      </td>
    </tr>
  )
}

export function Monitor() {
  const [services, setServices] = useState<ServiceCheck[]>(
    SERVICES.map((s) => ({ ...s, status: 'checking' as const }))
  )
  const [isPolling, setIsPolling] = useState(true)
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null)
  const [nextPollIn, setNextPollIn] = useState(POLL_INTERVAL / 1000)

  const checkService = useCallback(async (service: { name: string; url: string; type: 'api' | 'frontend' }) => {
    const startTime = performance.now()

    try {
      const response = await fetch(service.url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      })

      const responseTime = Math.round(performance.now() - startTime)
      const text = await response.text()

      if (service.type === 'frontend') {
        // Check for React app markers
        const hasRoot = text.includes('id="root"') || text.includes("id='root'")
        const hasTitle = text.includes('<title>') && text.includes('</title>')
        const contentLength = text.length
        const status: ServiceCheck['status'] = response.ok && hasRoot && contentLength > 500 ? 'healthy' : 'unhealthy'

        return {
          ...service,
          status,
          statusCode: response.status,
          responseTime,
          lastChecked: new Date(),
          renderCheck: { hasRoot, hasTitle, contentLength },
        }
      } else {
        // API health check
        let isHealthy = response.ok
        if (response.ok) {
          try {
            const json = JSON.parse(text)
            isHealthy = json.status === 'healthy' || json.status === 'ok'
          } catch {
            // If can't parse as JSON but response is ok, consider it healthy
          }
        }
        const status: ServiceCheck['status'] = isHealthy ? 'healthy' : 'unhealthy'

        return {
          ...service,
          status,
          statusCode: response.status,
          responseTime,
          lastChecked: new Date(),
        }
      }
    } catch (err) {
      const responseTime = Math.round(performance.now() - startTime)
      const status: ServiceCheck['status'] = 'error'
      return {
        ...service,
        status,
        responseTime,
        error: err instanceof Error ? err.message : 'Unknown error',
        lastChecked: new Date(),
      }
    }
  }, [])

  const runAllChecks = useCallback(async () => {
    // Set all to checking state
    const checkingStatus: ServiceCheck['status'] = 'checking'
    setServices((prev) => prev.map((s) => ({ ...s, status: checkingStatus })))

    // Run all checks in parallel
    const results = await Promise.all(SERVICES.map(checkService))

    setServices(results)
    setLastPollTime(new Date())
    setNextPollIn(POLL_INTERVAL / 1000)
  }, [checkService])

  // Initial check and polling
  useEffect(() => {
    runAllChecks()

    if (!isPolling) return

    const pollInterval = setInterval(() => {
      runAllChecks()
    }, POLL_INTERVAL)

    return () => clearInterval(pollInterval)
  }, [runAllChecks, isPolling])

  // Countdown timer
  useEffect(() => {
    if (!isPolling) return

    const countdownInterval = setInterval(() => {
      setNextPollIn((prev) => (prev > 0 ? prev - 1 : POLL_INTERVAL / 1000))
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [isPolling])

  const healthyCount = services.filter((s) => s.status === 'healthy').length
  const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length
  const errorCount = services.filter((s) => s.status === 'error').length
  const frontendServices = services.filter((s) => s.type === 'frontend')
  const apiServices = services.filter((s) => s.type === 'api')

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
            onClick={runAllChecks}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Check Now
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{errorCount}</p>
              <p className="text-xs text-theme-text-muted">Errors (CORS/Network)</p>
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
                {lastPollTime ? formatTime(lastPollTime) : '-'}
              </p>
              <p className="text-xs text-theme-text-muted">Last Poll</p>
            </div>
          </div>
        </div>
      </div>

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
              {frontendServices.map((service) => (
                <ServiceRow key={service.name} service={service} />
              ))}
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
              {apiServices.map((service) => (
                <ServiceRow key={service.name} service={service} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Note */}
      <div className="text-sm text-theme-text-muted bg-theme-bg-elevated rounded-lg p-4">
        <p>
          <strong>Note:</strong> Frontend checks verify the page returns HTML with a{' '}
          <code className="bg-theme-bg-surface px-1 rounded">&lt;div id="root"&gt;</code> element
          (React mount point). "Error" status typically means CORS restrictions prevented the check
          from the browser. API checks verify the health endpoint returns a healthy status.
        </p>
      </div>
    </div>
  )
}
