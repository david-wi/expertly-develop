import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ListTodo,
  Layers,
  RefreshCw,
  Users,
  Users2,
} from 'lucide-react'
import { Sidebar, MainContent, BuildTimestamp } from '@expertly/ui'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: ListTodo },
  { name: 'Queues', href: '/queues', icon: Layers },
  { name: 'Recurring', href: '/recurring', icon: RefreshCw },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Teams', href: '/teams', icon: Users2 },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="manage"
        productName="Manage"
        navigation={navigation}
        currentPath={location.pathname}
        buildInfo={<BuildTimestamp timestamp={import.meta.env.VITE_BUILD_TIMESTAMP} />}
        renderLink={({ href, className, children }) => (
          <Link to={href} className={className}>
            {children}
          </Link>
        )}
      />
      <MainContent>
        <Outlet />
      </MainContent>
    </div>
  )
}
