import { BookOpen } from 'lucide-react'

export function Research() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Research</h1>
          <p className="text-gray-500 mt-1">AI industry research and analysis</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">No Research Yet</h2>
        <p className="text-gray-500">Add research notes and analyses about AI trends and their market implications.</p>
      </div>
    </div>
  )
}
