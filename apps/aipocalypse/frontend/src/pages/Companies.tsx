import { Building2 } from 'lucide-react'

export function Companies() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 mt-1">Track companies and their AI exposure</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">No Companies Yet</h2>
        <p className="text-gray-500">Add companies to start tracking their AI-driven valuation changes.</p>
      </div>
    </div>
  )
}
