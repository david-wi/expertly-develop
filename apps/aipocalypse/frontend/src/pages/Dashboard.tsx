import { TrendingUp, Building2, Brain, AlertTriangle } from 'lucide-react'

export function Dashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Aipocalypse Fund</h1>
        <p className="text-gray-500 mt-1">AI-impact investment research dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Building2} label="Companies Tracked" value="0" color="blue" />
        <StatCard icon={TrendingUp} label="Active Predictions" value="0" color="green" />
        <StatCard icon={Brain} label="AI Impact Analyses" value="0" color="purple" />
        <StatCard icon={AlertTriangle} label="High-Impact Alerts" value="0" color="amber" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Getting Started</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          Add companies to track and create AI impact predictions to begin building your investment thesis.
        </p>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  const iconColor = colorMap[color] || colorMap.blue

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
