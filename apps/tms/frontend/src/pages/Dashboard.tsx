import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import {
  Inbox,
  Truck,
  AlertTriangle,
  Package,
  TruckIcon,
  Clock,
} from 'lucide-react'

export default function Dashboard() {
  const { dashboardStats, workItems, loading, fetchDashboardStats, fetchWorkItems } = useAppStore()

  useEffect(() => {
    fetchDashboardStats()
    fetchWorkItems()
  }, [fetchDashboardStats, fetchWorkItems])

  const stats = [
    {
      name: 'Open Work Items',
      value: workItems.filter(w => w.status === 'open' || w.status === 'in_progress').length,
      icon: Inbox,
      color: 'bg-blue-500',
      href: '/inbox',
    },
    {
      name: 'At-Risk Shipments',
      value: dashboardStats?.at_risk_shipments || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      href: '/shipments?at_risk=true',
    },
    {
      name: "Today's Pickups",
      value: dashboardStats?.todays_pickups || 0,
      icon: Package,
      color: 'bg-green-500',
      href: '/shipments',
    },
    {
      name: "Today's Deliveries",
      value: dashboardStats?.todays_deliveries || 0,
      icon: TruckIcon,
      color: 'bg-purple-500',
      href: '/shipments',
    },
  ]

  const urgentItems = workItems
    .filter(w => (w.status === 'open' || w.status === 'in_progress') && (w.is_overdue || w.priority >= 70))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back. Here's what needs your attention.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Urgent Items */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Urgent Items</h2>
        </div>
        {loading.workItems ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : urgentItems.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No urgent items</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {urgentItems.map((item) => (
              <li key={item.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.is_overdue && (
                      <Clock className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {item.work_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    item.is_overdue
                      ? 'bg-red-100 text-red-700'
                      : item.priority >= 70
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {item.is_overdue ? 'Overdue' : `Priority ${item.priority}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <Link to="/inbox" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View all work items →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/quote-requests"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow text-center"
        >
          <Truck className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">New Quote Request</h3>
          <p className="text-sm text-gray-500">Enter a rate request</p>
        </Link>
        <Link
          to="/dispatch"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow text-center"
        >
          <Package className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Dispatch Board</h3>
          <p className="text-sm text-gray-500">View loads needing carriers</p>
        </Link>
        <Link
          to="/invoices"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow text-center"
        >
          <Inbox className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Billing Queue</h3>
          <p className="text-sm text-gray-500">Generate invoices</p>
        </Link>
      </div>
    </div>
  )
}
