import React from 'react'

// Mock Sidebar component
export function Sidebar({
  productCode,
  productName,
  navigation,
  currentPath,
  buildInfo,
  renderLink,
  user,
}: {
  productCode: string
  productName: string
  navigation: Array<{ name: string; href: string; icon: React.ComponentType }>
  currentPath: string
  buildInfo?: React.ReactNode
  renderLink: (props: { href: string; className: string; children: React.ReactNode }) => React.ReactNode
  user?: { name: string } | null
}) {
  return React.createElement(
    'div',
    { 'data-testid': 'sidebar' },
    React.createElement('span', { 'data-testid': 'product-code', key: 'code' }, productCode),
    React.createElement('span', { 'data-testid': 'product-name', key: 'name' }, productName),
    React.createElement('span', { 'data-testid': 'current-path', key: 'path' }, currentPath),
    user && React.createElement('span', { 'data-testid': 'user-name', key: 'user' }, user.name),
    React.createElement(
      'nav',
      { key: 'nav' },
      navigation.map((item, index) =>
        React.createElement(
          React.Fragment,
          { key: item.href || index },
          renderLink({
            href: item.href,
            className: 'nav-link',
            children: item.name,
          })
        )
      )
    ),
    buildInfo
  )
}

// Mock MainContent component
export function MainContent({ children }: { children: React.ReactNode }) {
  return React.createElement('main', { 'data-testid': 'main-content' }, children)
}

// Mock formatBuildTimestamp function
export function formatBuildTimestamp(timestamp: string | undefined): string | null {
  return timestamp ? `Build: ${timestamp}` : null
}

// Mock useCurrentUser hook
export function useCurrentUser(fetchUser: () => Promise<{ id: string; name: string; email: string }>) {
  const [user, setUser] = React.useState<{ id: string; name: string; email: string } | null>(null)

  React.useEffect(() => {
    fetchUser()
      .then(setUser)
      .catch((err) => console.error(err))
  }, [fetchUser])

  return {
    currentUser: user,
    sidebarUser: user ? { name: user.name } : undefined,
    isLoading: !user,
  }
}
