import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Star, Archive } from 'lucide-react'
import { themesApi } from '@/services/api'
import { ThemeList } from '@/components/themes/ThemeList'
import { useState } from 'react'

export function Themes() {
  const [showInactive, setShowInactive] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['themes', showInactive],
    queryFn: () => themesApi.list(showInactive),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Themes</h1>
          <p className="text-theme-text-secondary mt-1">
            Manage color themes for all Expertly applications
          </p>
        </div>
        <Link
          to="/themes/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Theme
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowInactive(false)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !showInactive
              ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
              : 'text-theme-text-secondary hover:bg-theme-bg-elevated'
          }`}
        >
          <Star className="w-4 h-4" />
          Active Only
        </button>
        <button
          onClick={() => setShowInactive(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            showInactive
              ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
              : 'text-theme-text-secondary hover:bg-theme-bg-elevated'
          }`}
        >
          <Archive className="w-4 h-4" />
          Include Inactive
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-theme-text-muted">Loading themes...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error loading themes</div>
        </div>
      ) : data && data.themes.length > 0 ? (
        <ThemeList themes={data.themes} />
      ) : (
        <div className="flex flex-col items-center justify-center h-64 bg-theme-bg-surface rounded-xl border border-theme-border">
          <p className="text-theme-text-muted mb-4">No themes found</p>
          <Link
            to="/themes/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Theme
          </Link>
        </div>
      )}
    </div>
  )
}
