import { TrendingUp } from 'lucide-react'

export function Predictions() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Predictions</h1>
          <p className="text-gray-500 mt-1">AI impact predictions on company valuations</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">No Predictions Yet</h2>
        <p className="text-gray-500">Create predictions about how AI will impact specific company valuations.</p>
      </div>
    </div>
  )
}
