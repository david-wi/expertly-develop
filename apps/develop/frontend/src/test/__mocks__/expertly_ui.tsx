// Mock implementation of expertly_ui for testing
import React from 'react'

interface SidebarProps {
  productCode: string
  productName: string
  navigation: Array<{ name: string; href: string; icon?: React.ComponentType }>
  currentPath: string
  user: { name: string; email: string } | null
  orgSwitcher?: React.ReactNode
  buildInfo?: React.ReactNode
  versionCheck?: { currentCommit?: string }
  renderLink: (props: { href: string; className: string; children: React.ReactNode }) => React.ReactNode
}

export const Sidebar: React.FC<SidebarProps> = ({
  productName,
  navigation,
  user,
  orgSwitcher,
  buildInfo,
  renderLink,
}) => (
  <nav data-testid="sidebar">
    <span data-testid="product-name">{productName}</span>
    {navigation.map((item) => (
      <div key={item.href} data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}>
        {renderLink({ href: item.href, className: '', children: item.name })}
      </div>
    ))}
    {orgSwitcher && <div data-testid="org-switcher">{orgSwitcher}</div>}
    {buildInfo && <div data-testid="build-info">{buildInfo}</div>}
    {user && <span data-testid="user-name">{user.name}</span>}
  </nav>
)

export const MainContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main data-testid="main-content">{children}</main>
)

export const formatBuildTimestamp = (ts: string | undefined): string | null => {
  return ts ? `Build: ${ts}` : null
}

export const useCurrentUser = (fetchFn: () => Promise<unknown>) => {
  // Return mock user data for tests
  return {
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: 'org-1',
    },
    sidebarUser: {
      name: 'Test User',
      email: 'test@example.com',
    },
  }
}
