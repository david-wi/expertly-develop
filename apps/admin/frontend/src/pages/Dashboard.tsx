import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Palette, Plus, Settings } from 'lucide-react'
import { themesApi } from '@/services/api'

export function Dashboard() {
  const { data: themesData, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => themesApi.list(true),
  })

  const activeThemes = themesData?.themes.filter(t => t.is_active).length ?? 0
  const totalThemes = themesData?.total ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-theme-text-primary">Dashboard</h1>
        <p className="text-theme-text-secondary mt-1">
          Manage themes and configuration for all Expertly apps
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <Palette className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-theme-text-muted">Active Themes</p>
              <p className="text-2xl font-bold text-theme-text-primary">
                {isLoading ? '-' : activeThemes}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <Settings className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-theme-text-muted">Total Themes</p>
              <p className="text-2xl font-bold text-theme-text-primary">
                {isLoading ? '-' : totalThemes}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <span className="text-green-600 dark:text-green-400 text-xl">API</span>
            </div>
            <div>
              <p className="text-sm text-theme-text-muted">Public API</p>
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                Available
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
        <h2 className="text-lg font-semibold text-theme-text-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/themes/new"
            className="flex items-center gap-3 p-4 rounded-lg border border-theme-border hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <Plus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-medium text-theme-text-primary">Create New Theme</p>
              <p className="text-sm text-theme-text-muted">Add a new color theme</p>
            </div>
          </Link>

          <Link
            to="/themes"
            className="flex items-center gap-3 p-4 rounded-lg border border-theme-border hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <Palette className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-medium text-theme-text-primary">Manage Themes</p>
              <p className="text-sm text-theme-text-muted">View and edit all themes</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Themes */}
      {themesData && themesData.themes.length > 0 && (
        <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-theme-text-primary">Recent Themes</h2>
            <Link to="/themes" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {themesData.themes.slice(0, 5).map((theme) => (
              <Link
                key={theme.id}
                to={`/themes/${theme.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-theme-bg-elevated transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Color swatch */}
                  <div className="flex gap-0.5">
                    {['500', '600', '700'].map((shade) => (
                      <div
                        key={shade}
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: theme.colors?.light?.primary?.[shade as keyof typeof theme.colors.light.primary] || '#8b5cf6' }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-theme-text-primary">{theme.name}</p>
                    <p className="text-xs text-theme-text-muted">v{theme.current_version}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {theme.is_default && (
                    <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  {!theme.is_active && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
