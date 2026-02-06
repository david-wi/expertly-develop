import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Lightbulb,
  Building2,
  FileText,
  ListTodo,
  Settings,
} from 'lucide-react'
import { Sidebar as SharedSidebar, formatBuildTimestamp, useCurrentUser, createDefaultUserMenu } from '@expertly/ui'
import { getCurrentUser } from '../../services/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Hypotheses', href: '/hypotheses', icon: Lightbulb },
  { name: 'Industries', href: '/industries', icon: Building2 },
  { name: 'Research Reports', href: '/reports', icon: FileText },
  { name: 'Research Queue', href: '/queue', icon: ListTodo },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const fetchCurrentUser = useCallback(() => getCurrentUser(), [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  const handleLogout = useCallback(() => {
    window.location.href = 'https://identity.ai.devintensive.com/login'
  }, [])

  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    currentAppCode: 'aipocalypse',
  }), [handleLogout])

  return (
    <SharedSidebar
      productCode="aipocalypse"
      productName="Aipocalypse Fund"
      productNamePrefix=""
      navigation={navigation}
      currentPath={location.pathname}
      user={sidebarUser}
      buildInfo={
        formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
          <span className="text-[10px] text-gray-400 block text-right">
            {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
          </span>
        )
      }
      userMenu={userMenu}
      navigate={navigate}
    />
  )
}
