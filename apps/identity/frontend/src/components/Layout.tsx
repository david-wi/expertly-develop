import { useEffect, useState, useCallback } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  User,
  UsersRound,
  Building2,
  KeyRound,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp, useCurrentUser } from 'expertly_ui/index'
import { authApi, organizationsApi, Organization, getOrganizationId, setOrganizationId } from '../services/api'

const navigation = [
  { name: 'Users and Bots', href: '/users', icon: User },
  { name: 'Teams', href: '/teams', icon: UsersRound },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'Change Password', href: '/change-password', icon: KeyRound },
]

export default function Layout() {
  const location = useLocation()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(getOrganizationId())

  // Use shared hook for consistent user fetching
  const fetchCurrentUser = useCallback(async () => {
    const user = await authApi.me('')
    // If user has an organization and none is selected, select it
    if (user.organization_id && !selectedOrgId) {
      setSelectedOrgId(user.organization_id)
      setOrganizationId(user.organization_id)
    }
    // Transform AuthUser to CurrentUser format
    return {
      id: user.id,
      name: user.name,
      email: user.email || '',
      role: user.role,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
    }
  }, [selectedOrgId])
  const { sidebarUser } = useCurrentUser(fetchCurrentUser)

  useEffect(() => {
    // Fetch organizations
    const fetchOrgs = async () => {
      try {
        const orgs = await organizationsApi.list()
        setOrganizations(orgs)
        // If we have orgs but none selected, select the first one
        if (orgs.length > 0 && !selectedOrgId) {
          setSelectedOrgId(orgs[0].id)
          setOrganizationId(orgs[0].id)
        }
      } catch {
        // Error fetching orgs - ignore
      }
    }
    fetchOrgs()
  }, [selectedOrgId])

  const handleOrgChange = (orgId: string) => {
    setSelectedOrgId(orgId)
    setOrganizationId(orgId)
    // Reload the page to refresh data with new org
    window.location.reload()
  }

  const selectedOrg = organizations.find(o => o.id === selectedOrgId)

  // Merge organization name from selected org if not in user data
  const userWithOrg = sidebarUser
    ? {
        ...sidebarUser,
        organization: sidebarUser.organization || selectedOrg?.name,
      }
    : undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="identity"
        productName="Identity"
        navigation={navigation}
        currentPath={location.pathname}
        user={userWithOrg}
        orgSwitcher={organizations.length > 0 ? (
          <select
            value={selectedOrgId || ''}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : undefined}
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
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
      />

      {/* Main content */}
      <MainContent>
        <Outlet />
      </MainContent>

      {/* Subtle marketing page link - fixed to bottom-right of page */}
      <Link
        to="/landing"
        className="fixed bottom-4 right-4 text-xs text-gray-400 hover:text-primary-600 transition-colors"
      >
        View marketing page
      </Link>
    </div>
  )
}
