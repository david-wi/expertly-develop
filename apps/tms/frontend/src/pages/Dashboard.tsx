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
  DollarSign,
  FileText,
  Send,
  ArrowUpRight,
} from 'lucide-react'
import PageHelp from '../components/PageHelp'

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
      color: 'bg-emerald-500',
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
      color: 'bg-blue-500',
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <PageHelp pageId="dashboard" />
        </div>
        <p className="text-sm sm:text-base text-gray-500">Welcome back. Here's what needs your attention.</p>
      </div>

      {/* Stats Grid - 2 cols on mobile for compact view */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-all hover:border-gray-300 group active:scale-[0.98]"
          >
            <div className="flex items-center justify-between">
              <div className={`${stat.color} p-2 sm:p-3 rounded-xl`}>
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
            </div>
            <div className="mt-3 sm:mt-4">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs sm:text-sm font-medium text-gray-500 mt-0.5 sm:mt-1">{stat.name}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Urgent Items - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Urgent Items</h2>
            <Link to="/inbox" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium min-h-[36px] flex items-center">
              View all
            </Link>
          </div>
          {loading.workItems ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : urgentItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-gray-500">No urgent items</p>
              <p className="text-sm text-gray-400 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {urgentItems.map((item) => (
                <li key={item.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.is_overdue && (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-4 w-4 text-red-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500 capitalize">
                          {item.work_type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
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
        </div>

        {/* Quick Actions - Takes 1 column */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/quote-requests"
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                <FileText className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">New Quote Request</h3>
                <p className="text-sm text-gray-500">Paste email to extract</p>
              </div>
            </Link>
            <Link
              to="/dispatch"
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                <Send className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Dispatch Board</h3>
                <p className="text-sm text-gray-500">Assign carriers to loads</p>
              </div>
            </Link>
            <Link
              to="/shipments"
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                <Truck className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Track Shipments</h3>
                <p className="text-sm text-gray-500">View active loads</p>
              </div>
            </Link>
            <Link
              to="/invoices"
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Billing Queue</h3>
                <p className="text-sm text-gray-500">Generate invoices</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
