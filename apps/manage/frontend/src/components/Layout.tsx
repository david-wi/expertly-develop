import { useState, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ListTodo,
  Layers,
  RefreshCw,
  Users,
  Users2,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser } from 'expertly_ui/index'
import ViewAsSwitcher, { ViewAsState, getViewAsState } from './ViewAsSwitcher'
import { api } from '../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Queues', href: '/queues', icon: Layers },
  { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
  { name: 'Recurring', href: '/recurring', icon: RefreshCw },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Teams', href: '/teams', icon: Users2 },
  { name: 'Wins', href: '/wins', icon: Sparkles, spacerBefore: true },
]

export default function Layout() {
  const location = useLocation()
  const [viewAs, setViewAs] = useState<ViewAsState>(getViewAsState())

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(() => api.getCurrentUser(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  const handleViewChange = (newState: ViewAsState) => {
    setViewAs(newState)
    // Reload page to refresh data with new view context
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="manage"
        productName="Manage"
        navigation={navigation}
        currentPath={location.pathname}
        orgSwitcher={
          <ViewAsSwitcher onViewChange={handleViewChange} />
        }
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-gray-400 block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
        user={sidebarUser}
      />
      <MainContent>
        <Outlet context={{ viewAs }} />
      </MainContent>
    </div>
  )
}
