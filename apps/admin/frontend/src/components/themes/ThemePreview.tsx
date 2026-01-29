import type { ThemeColors } from '@/types/theme'

interface ThemePreviewProps {
  colors: ThemeColors
  mode: 'light' | 'dark'
  onModeChange?: (mode: 'light' | 'dark') => void
}

export function ThemePreview({ colors, mode, onModeChange }: ThemePreviewProps) {
  const c = colors[mode]

  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-theme-text-primary">Preview</h2>

        {/* Mode toggle */}
        {onModeChange && (
          <div className="flex items-center gap-1 p-1 bg-theme-bg rounded-lg">
            <button
              onClick={() => onModeChange('light')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                mode === 'light'
                  ? 'bg-white shadow text-theme-text-primary dark:bg-gray-700'
                  : 'text-theme-text-muted'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => onModeChange('dark')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                mode === 'dark'
                  ? 'bg-white shadow text-theme-text-primary dark:bg-gray-700'
                  : 'text-theme-text-muted'
              }`}
            >
              Dark
            </button>
          </div>
        )}
      </div>

      {/* Preview container */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: c.background.default }}
      >
        {/* Simulated app header */}
        <div
          className="p-3 flex items-center gap-2"
          style={{ backgroundColor: c.background.surface, borderBottom: `1px solid ${c.border.default}` }}
        >
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: c.primary['600'] }}
          >
            E
          </div>
          <span className="text-sm font-medium" style={{ color: c.text.primary }}>
            Expertly
          </span>
        </div>

        {/* Content area */}
        <div className="p-3 space-y-3">
          {/* Card */}
          <div
            className="rounded-lg p-3"
            style={{ backgroundColor: c.background.surface, border: `1px solid ${c.border.default}` }}
          >
            <h3 className="text-sm font-medium mb-1" style={{ color: c.text.primary }}>
              Sample Card
            </h3>
            <p className="text-xs" style={{ color: c.text.secondary }}>
              This is how content looks with your theme colors.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs rounded-lg text-white"
              style={{ backgroundColor: c.primary['600'] }}
            >
              Primary
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-lg"
              style={{
                backgroundColor: c.primary['50'],
                color: c.primary['700'],
              }}
            >
              Secondary
            </button>
          </div>

          {/* Text samples */}
          <div className="space-y-1">
            <p className="text-sm" style={{ color: c.text.primary }}>Primary text</p>
            <p className="text-sm" style={{ color: c.text.secondary }}>Secondary text</p>
            <p className="text-sm" style={{ color: c.text.muted }}>Muted text</p>
          </div>

          {/* Color chips */}
          <div className="flex gap-1 pt-2">
            {(['500', '600', '700'] as const).map((shade) => (
              <div
                key={shade}
                className="flex-1 h-6 rounded"
                style={{ backgroundColor: c.primary[shade] }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
