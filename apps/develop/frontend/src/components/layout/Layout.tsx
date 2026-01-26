import { useState, useEffect, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FileBox,
  Play,
} from 'lucide-react'
import { Sidebar, MainContent } from '@expertly/ui'
import OrganizationSwitcher from './OrganizationSwitcher'
import { usersApi, CurrentUser, TENANT_STORAGE_KEY } from '../../api/client'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Job Queue', href: '/jobs', icon: ListTodo },
  { name: 'Artifacts', href: '/artifacts', icon: FileBox },
  { name: 'New Walkthrough', href: '/walkthroughs/new', icon: Play },
]

// Format build timestamp as M.DD.HH.MM (e.g., "1.26.14.34" for Jan 26 at 14:34)
function formatBuildTimestamp(timestamp: string | undefined): string | null {
  if (!timestamp) return null
  try {
    const date = new Date(parseInt(timestamp) * 1000)
    if (isNaN(date.getTime())) return null
    const month = date.getMonth() + 1
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${month}.${day}.${hour}.${minute}`
  } catch {
    return null
  }
}

const buildTimestamp = formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)

export default function Layout() {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchCurrentUser = useCallback(async () => {
    try {
      const user = await usersApi.me()
      setCurrentUser(user)
    } catch (error) {
      console.error('Failed to fetch current user:', error)
    }
  }, [])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser, refreshKey])

  const handleOrgSwitch = () => {
    setRefreshKey((k) => k + 1)
    window.location.reload()
  }

  const currentTenantId = localStorage.getItem(TENANT_STORAGE_KEY) || currentUser?.tenant.id || null

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="develop"
        productName="Develop"
        navigation={navigation}
        currentPath={location.pathname}
        user={currentUser ? {
          name: currentUser.name,
          role: currentUser.role,
        } : undefined}
        orgSwitcher={
          <OrganizationSwitcher
            currentTenantId={currentTenantId}
            onSwitch={handleOrgSwitch}
          />
        }
        buildInfo={
          buildTimestamp ? (
            <span className="text-[10px] text-gray-400 block text-right">{buildTimestamp}</span>
          ) : undefined
        }
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
      />

      {/* Main content */}
      <MainContent>
        <Outlet />

        {/* Subtle marketing page link */}
        <div className="mt-12 flex justify-end">
          <Link
            to="/landing"
            className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
          >
            View marketing page
          </Link>
        </div>
      </MainContent>
    </div>
  )
}
