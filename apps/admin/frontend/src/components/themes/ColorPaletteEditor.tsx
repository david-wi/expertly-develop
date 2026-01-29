import type { ThemeColors, ThemePrimaryColors } from '@/types/theme'

interface ColorPaletteEditorProps {
  colors: ThemeColors
  onChange: (colors: ThemeColors) => void
  activeMode: 'light' | 'dark'
  onModeChange: (mode: 'light' | 'dark') => void
}

const PRIMARY_SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

export function ColorPaletteEditor({ colors, onChange, activeMode, onModeChange }: ColorPaletteEditorProps) {

  const updatePrimaryColor = (shade: keyof ThemePrimaryColors, value: string) => {
    const newColors = {
      ...colors,
      [activeMode]: {
        ...colors[activeMode],
        primary: {
          ...colors[activeMode].primary,
          [shade]: value,
        },
      },
    }
    onChange(newColors)
  }

  const updateBackgroundColor = (key: 'default' | 'surface' | 'elevated', value: string) => {
    const newColors = {
      ...colors,
      [activeMode]: {
        ...colors[activeMode],
        background: {
          ...colors[activeMode].background,
          [key]: value,
        },
      },
    }
    onChange(newColors)
  }

  const updateTextColor = (key: 'primary' | 'secondary' | 'muted', value: string) => {
    const newColors = {
      ...colors,
      [activeMode]: {
        ...colors[activeMode],
        text: {
          ...colors[activeMode].text,
          [key]: value,
        },
      },
    }
    onChange(newColors)
  }

  const updateBorderColor = (key: 'default' | 'subtle', value: string) => {
    const newColors = {
      ...colors,
      [activeMode]: {
        ...colors[activeMode],
        border: {
          ...colors[activeMode].border,
          [key]: value,
        },
      },
    }
    onChange(newColors)
  }

  const currentColors = colors[activeMode]

  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-theme-text-primary">Color Palette</h2>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-theme-bg rounded-lg">
          <button
            onClick={() => onModeChange('light')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeMode === 'light'
                ? 'bg-white shadow text-theme-text-primary dark:bg-gray-700'
                : 'text-theme-text-muted hover:text-theme-text-secondary'
            }`}
          >
            Light
          </button>
          <button
            onClick={() => onModeChange('dark')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeMode === 'dark'
                ? 'bg-white shadow text-theme-text-primary dark:bg-gray-700'
                : 'text-theme-text-muted hover:text-theme-text-secondary'
            }`}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Primary Colors - Brand color scale */}
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-medium text-theme-text-secondary">Brand Color Scale</h3>
            <p className="text-xs text-theme-text-muted mt-1">
              11 shades of your brand color. <span className="font-medium">500</span> is the base color,
              <span className="font-medium"> 600</span> for buttons, <span className="font-medium">700</span> for hover states.
              Lighter shades (50-200) for backgrounds, darker (800-950) for text on light backgrounds.
            </p>
          </div>
          <div className="grid grid-cols-11 gap-2">
            {PRIMARY_SHADES.map((shade) => (
              <ColorInput
                key={shade}
                label={shade}
                value={currentColors.primary[shade]}
                onChange={(v) => updatePrimaryColor(shade, v)}
                hint={shade === '500' ? 'Base' : shade === '600' ? 'Buttons' : shade === '700' ? 'Hover' : undefined}
              />
            ))}
          </div>
        </div>

        {/* Background Colors */}
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-medium text-theme-text-secondary">Background Colors</h3>
            <p className="text-xs text-theme-text-muted mt-1">
              Layered backgrounds create visual hierarchy. Default is the page background,
              Surface for cards, Elevated for modals and dropdowns.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <ColorInput
              label="Default"
              hint="Page background"
              value={currentColors.background.default}
              onChange={(v) => updateBackgroundColor('default', v)}
              large
            />
            <ColorInput
              label="Surface"
              hint="Cards, panels"
              value={currentColors.background.surface}
              onChange={(v) => updateBackgroundColor('surface', v)}
              large
            />
            <ColorInput
              label="Elevated"
              hint="Modals, dropdowns"
              value={currentColors.background.elevated}
              onChange={(v) => updateBackgroundColor('elevated', v)}
              large
            />
          </div>
        </div>

        {/* Text Colors */}
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-medium text-theme-text-secondary">Text Colors</h3>
            <p className="text-xs text-theme-text-muted mt-1">
              Text hierarchy for readability. Primary for headings and important text,
              Secondary for body text, Muted for labels and hints.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <ColorInput
              label="Primary"
              hint="Headings, bold text"
              value={currentColors.text.primary}
              onChange={(v) => updateTextColor('primary', v)}
              large
            />
            <ColorInput
              label="Secondary"
              hint="Body text"
              value={currentColors.text.secondary}
              onChange={(v) => updateTextColor('secondary', v)}
              large
            />
            <ColorInput
              label="Muted"
              hint="Labels, hints"
              value={currentColors.text.muted}
              onChange={(v) => updateTextColor('muted', v)}
              large
            />
          </div>
        </div>

        {/* Border Colors */}
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-medium text-theme-text-secondary">Border Colors</h3>
            <p className="text-xs text-theme-text-muted mt-1">
              Borders define boundaries. Default for visible borders, Subtle for dividers and lighter separations.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ColorInput
              label="Default"
              hint="Card borders, inputs"
              value={currentColors.border.default}
              onChange={(v) => updateBorderColor('default', v)}
              large
            />
            <ColorInput
              label="Subtle"
              hint="Dividers, light borders"
              value={currentColors.border.subtle}
              onChange={(v) => updateBorderColor('subtle', v)}
              large
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ColorInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  large?: boolean
  hint?: string
}

function ColorInput({ label, value, onChange, large, hint }: ColorInputProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-theme-text-muted">{label}</label>
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full cursor-pointer rounded-lg border border-theme-border ${
            large ? 'h-12' : 'h-8'
          }`}
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs px-1.5 py-1 bg-theme-bg border border-theme-border rounded text-theme-text-primary text-center uppercase"
      />
      {hint && (
        <p className="text-[10px] text-theme-text-muted text-center">{hint}</p>
      )}
    </div>
  )
}
