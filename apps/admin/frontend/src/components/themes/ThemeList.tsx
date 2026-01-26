import { Link } from 'react-router-dom'
import { Star, Edit } from 'lucide-react'
import type { Theme } from '@/types/theme'

interface ThemeListProps {
  themes: Theme[]
}

export function ThemeList({ themes }: ThemeListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {themes.map((theme) => (
        <ThemeCard key={theme.id} theme={theme} />
      ))}
    </div>
  )
}

function ThemeCard({ theme }: { theme: Theme }) {
  const primaryColors = theme.colors?.light?.primary
  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

  return (
    <Link
      to={`/themes/${theme.id}`}
      className="group bg-theme-bg-surface rounded-xl border border-theme-border hover:border-primary-500 transition-all hover:shadow-lg overflow-hidden"
    >
      {/* Color swatches */}
      <div className="h-16 flex">
        {shades.map((shade) => (
          <div
            key={shade}
            className="flex-1"
            style={{ backgroundColor: primaryColors?.[shade] || '#8b5cf6' }}
          />
        ))}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-theme-text-primary group-hover:text-primary-600 transition-colors">
              {theme.name}
            </h3>
            <p className="text-sm text-theme-text-muted">{theme.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            {theme.is_default && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            )}
            <Edit className="w-4 h-4 text-theme-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {theme.description && (
          <p className="text-sm text-theme-text-secondary mt-2 line-clamp-2">
            {theme.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-theme-border">
          <span className="text-xs text-theme-text-muted">
            v{theme.current_version}
          </span>
          {!theme.is_active && (
            <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
              Inactive
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
