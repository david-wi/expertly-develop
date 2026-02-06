import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useWebSocket } from '../hooks/useWebSocket'
import { DashboardGrid, AddWidgetModal } from '../components/dashboard'
import { Tooltip } from '../components/ui/Tooltip'

export default function Dashboard() {
  const { user, wsConnected, fetchUser, fetchQueues, fetchTasks } = useAppStore()
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false)

  useWebSocket(user?.organization_id)

  useEffect(() => {
    fetchUser()
    fetchQueues()
    fetchTasks()
  }, [fetchUser, fetchQueues, fetchTasks])

  // Polling fallback: re-fetch tasks every 60s for resilience when WebSocket misses events
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTasks()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchTasks])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--theme-text-heading)]">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Tooltip
            content={wsConnected
              ? 'Real-time updates active. Changes will appear instantly without refreshing.'
              : 'Not connected to server. Updates require manual refresh. Reconnection will be attempted automatically.'
            }
            position="bottom"
          >
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-help ${
                wsConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              <span
                className={`w-2 h-2 mr-1.5 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-gray-400'}`}
              />
              {wsConnected ? 'Live' : 'Offline'}
            </span>
          </Tooltip>
        </div>
      </div>

      {user && (
        <div className="bg-white shadow rounded-lg p-4">
          <p className="text-gray-600">
            Welcome, <span className="font-medium text-gray-900">{user.name}</span>
          </p>
        </div>
      )}

      <DashboardGrid onAddWidget={() => setShowAddWidgetModal(true)} />

      <AddWidgetModal
        isOpen={showAddWidgetModal}
        onClose={() => setShowAddWidgetModal(false)}
      />
    </div>
  )
}
