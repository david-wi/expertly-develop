import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { api, Monitor, MonitorProviderType } from '../../../services/api'

const PROVIDER_ICONS: Record<MonitorProviderType, React.ReactNode> = {
  slack: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  ),
  gmail: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  outlook: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 0h11.377v11.377H0V0zm12.623 0H24v11.377H12.623V0zM0 12.623h11.377V24H0V12.623zm12.623 0H24V24H12.623V12.623z" fill="#0078D4"/>
    </svg>
  ),
  google_drive: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  teamwork: (
    <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
      TW
    </div>
  ),
  github: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  ),
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-400',
  paused: 'bg-yellow-400',
  error: 'bg-red-400',
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function MonitorsSummaryWidget({ widgetId }: WidgetProps) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMonitors()
      .then(setMonitors)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const headerAction = (
    <Link to="/monitors" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
      View all
    </Link>
  )

  if (loading) {
    return (
      <WidgetWrapper widgetId={widgetId} title="Monitors" headerAction={headerAction}>
        <div className="p-4 text-gray-500 text-sm">Loading...</div>
      </WidgetWrapper>
    )
  }

  if (monitors.length === 0) {
    return (
      <WidgetWrapper widgetId={widgetId} title="Monitors" headerAction={headerAction}>
        <div className="p-4 text-gray-500">No monitors configured</div>
      </WidgetWrapper>
    )
  }

  const errorCount = monitors.filter(m => m.status === 'error').length

  return (
    <WidgetWrapper widgetId={widgetId} title="Monitors" headerAction={headerAction}>
      <div className="p-3">
        {errorCount > 0 && (
          <div className="mb-3 p-2 bg-red-50 rounded-md">
            <p className="text-xs text-red-700">
              <span className="font-medium">{errorCount}</span> monitor{errorCount !== 1 ? 's' : ''} in error state
            </p>
          </div>
        )}
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wider">
              <th className="text-left pb-2 font-medium">Monitor</th>
              <th className="text-right pb-2 font-medium">Last Run</th>
              <th className="text-right pb-2 font-medium">Last Task</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monitors.map(monitor => (
              <tr key={monitor.id} className="group">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-shrink-0">
                      {PROVIDER_ICONS[monitor.provider]}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${STATUS_COLORS[monitor.status] || 'bg-gray-400'}`}
                        title={monitor.status}
                      />
                    </div>
                    <span className="text-sm text-gray-900 truncate" title={monitor.name}>
                      {monitor.name}
                    </span>
                  </div>
                </td>
                <td className="py-2 pl-2 text-right">
                  <span className="text-xs text-gray-500" title={monitor.last_polled_at || 'Never'}>
                    {formatRelativeTime(monitor.last_polled_at)}
                  </span>
                </td>
                <td className="py-2 pl-2 text-right">
                  <span className="text-xs text-gray-500" title={monitor.last_event_at || 'Never'}>
                    {formatRelativeTime(monitor.last_event_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetWrapper>
  )
}
