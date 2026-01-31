import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { WidgetWrapper } from '../WidgetWrapper'
import { WidgetProps } from './types'
import { api, MonitorStats } from '../../../services/api'

export function MonitorsSummaryWidget({ widgetId }: WidgetProps) {
  const [monitorStats, setMonitorStats] = useState<MonitorStats | null>(null)

  useEffect(() => {
    api.getMonitorStats().then(setMonitorStats).catch(console.error)
  }, [])

  const headerAction = (
    <Link to="/monitors" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
      View all
    </Link>
  )

  if (!monitorStats || monitorStats.total === 0) {
    return (
      <WidgetWrapper widgetId={widgetId} title="Monitors" headerAction={headerAction}>
        <div className="p-4 text-gray-500">No monitors configured</div>
      </WidgetWrapper>
    )
  }

  return (
    <WidgetWrapper widgetId={widgetId} title="Monitors" headerAction={headerAction}>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{monitorStats.active}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Paused</p>
            <p className="text-2xl font-bold text-yellow-600">{monitorStats.paused}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Events Detected</p>
            <p className="text-2xl font-bold text-blue-600">{monitorStats.total_events_detected}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Playbooks Triggered</p>
            <p className="text-2xl font-bold text-purple-600">{monitorStats.total_playbooks_triggered}</p>
          </div>
        </div>
        {monitorStats.error > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-md">
            <p className="text-sm text-red-700">
              <span className="font-medium">{monitorStats.error}</span> monitor{monitorStats.error !== 1 ? 's' : ''} in error state
            </p>
          </div>
        )}
      </div>
    </WidgetWrapper>
  )
}
