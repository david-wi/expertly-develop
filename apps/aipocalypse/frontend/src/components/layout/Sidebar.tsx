import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  BookOpen,
  Settings,
} from 'lucide-react'
import { Sidebar as SharedSidebar, formatBuildTimestamp, createDefaultUserMenu } from '@expertly/ui'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Companies', href: '/companies', icon: Building2 },
  { name: 'Predictions', href: '/predictions', icon: TrendingUp },
  { name: 'Research', href: '/research', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

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
      navigation={navigation}
      currentPath={location.pathname}
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
