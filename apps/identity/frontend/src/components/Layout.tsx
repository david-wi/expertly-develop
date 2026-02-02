import { useCallback, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  User,
  UsersRound,
  Building2,
  KeyRound,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser, useOrganizations, createDefaultUserMenu } from '@expertly/ui'
import { authApi } from '../services/api'

const navigation = [
  { name: 'Users and Bots', href: '/users', icon: User },
  { name: 'Teams', href: '/teams', icon: UsersRound },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'Change Password', href: '/change-password', icon: KeyRound },
]

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(async () => {
    const user = await authApi.me('')
    // Transform AuthUser to CurrentUser format
    return {
      id: user.id,
      name: user.name,
      email: user.email || '',
      role: user.role,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
    }
  }, [])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  // Use shared organizations hook
  const { organizationsConfig, currentOrg } = useOrganizations({
    storageKey: 'identity_selected_org_id',
  })

  const handleLogout = useCallback(() => {
    authApi.logout()
    window.location.href = '/login'
  }, [])

  // Merge organization name from selected org if not in user data
  const userWithOrg = sidebarUser
    ? {
        ...sidebarUser,
        organization: sidebarUser.organization || currentOrg?.name,
      }
    : undefined

  // Create user menu config - no Profile link since this IS the identity app
  const userMenu = useMemo(() => createDefaultUserMenu({
    onLogout: handleLogout,
    buildTimestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
    gitCommit: import.meta.env.VITE_GIT_COMMIT,
    includeProfile: false,
    currentAppCode: 'identity',
    organizations: organizationsConfig,
  }), [handleLogout, organizationsConfig])

  return (
    <div className="min-h-screen bg-theme-bg">
      <Sidebar
        productCode="identity"
        productName="Identity"
        navigation={navigation}
        currentPath={location.pathname}
        user={userWithOrg}
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-gray-400 block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
        versionCheck={{
          currentCommit: import.meta.env.VITE_GIT_COMMIT,
        }}
        userMenu={userMenu}
        navigate={navigate}
      />

      {/* Main content */}
      <MainContent>
        <Outlet />
      </MainContent>

    </div>
  )
}
