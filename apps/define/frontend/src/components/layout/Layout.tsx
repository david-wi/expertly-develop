import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderTree,
  Package,
} from 'lucide-react'
import { Sidebar, MainContent, formatBuildTimestamp } from 'expertly_ui/index'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: FolderTree },
  { name: 'Releases', href: '/releases', icon: Package },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        productCode="define"
        productName="Define"
        navigation={navigation}
        currentPath={location.pathname}
        buildInfo={
          formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP) && (
            <span className="text-[10px] text-gray-400 block text-right">
              {formatBuildTimestamp(import.meta.env.VITE_BUILD_TIMESTAMP)}
            </span>
          )
        }
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
