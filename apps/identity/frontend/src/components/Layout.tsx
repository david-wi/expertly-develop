import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  User,
  Bot,
  UsersRound,
  Building2,
  KeyRound,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp } from 'expertly_ui/index'

const navigation = [
  { name: 'Users', href: '/users', icon: User },
  { name: 'Bots', href: '/bots', icon: Bot },
  { name: 'Teams', href: '/teams', icon: UsersRound },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'Change Password', href: '/change-password', icon: KeyRound },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="identity"
        productName="Identity"
        navigation={navigation}
        currentPath={location.pathname}
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
