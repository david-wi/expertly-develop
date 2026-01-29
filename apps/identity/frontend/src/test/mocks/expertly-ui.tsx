/**
 * Mock implementation of @expertly/ui for testing
 * This file is used by vitest alias to replace the federated module
 */

import type { ReactNode } from 'react'

interface NavigationItem {
  name: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
}

interface SidebarUser {
  name: string
  email?: string
  organization?: string
}

interface RenderLinkProps {
  href: string
  className: string
  children: ReactNode
  key?: string
}

interface SidebarProps {
  productCode?: string
  productName?: string
  navigation: NavigationItem[]
  currentPath: string
  user?: SidebarUser
  orgSwitcher?: ReactNode
  buildInfo?: ReactNode
  versionCheck?: {
    currentCommit?: string
  }
  renderLink: (props: RenderLinkProps) => ReactNode
}

interface MainContentProps {
  children: ReactNode
}

interface CurrentUser {
  id: string
  name: string
  email: string
  role: string
  organization_id: string
  organization_name: string | null
}

type FetchUserFn = () => Promise<CurrentUser>

// Mock Sidebar component
export const Sidebar = ({
  productName,
  navigation,
  currentPath,
  user,
  orgSwitcher,
  renderLink,
}: SidebarProps) => (
  <div data-testid="sidebar">
    <div data-testid="product-name">{productName}</div>
    <nav data-testid="navigation">
      {navigation.map((item) => (
        <span key={item.name}>
          {renderLink({
            href: item.href,
            className: currentPath === item.href ? 'active' : '',
            children: item.name,
          })}
        </span>
      ))}
    </nav>
    {user && (
      <div data-testid="user-info">
        <span data-testid="user-name">{user.name}</span>
        {user.organization && <span data-testid="user-org">{user.organization}</span>}
      </div>
    )}
    {orgSwitcher && <div data-testid="org-switcher">{orgSwitcher}</div>}
  </div>
)

// Mock MainContent component
export const MainContent = ({ children }: MainContentProps) => (
  <main data-testid="main-content">{children}</main>
)

// Mock formatBuildTimestamp function
export const formatBuildTimestamp = (): string | null => null

// Mock useCurrentUser hook
export const useCurrentUser = (fetchFn: FetchUserFn) => {
  // Call the fetch function but don't wait for it in tests
  fetchFn().catch(() => {})
  return { sidebarUser: null }
}
