import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, ChevronDown, Palette } from 'lucide-react'
import { useTheme } from './useTheme'
import { themeList } from './themes'
import type { ThemeId } from './themes'

interface ThemeSwitcherProps {
  showThemeSelector?: boolean
  className?: string
}

export function ThemeSwitcher({ showThemeSelector = true, className = '' }: ThemeSwitcherProps) {
  const { themeId, mode, setTheme, toggleMode } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentTheme = themeList.find((t) => t.id === themeId) || themeList[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`flex items-center gap-2 ${className}`} ref={dropdownRef}>
      {/* Light/Dark Mode Toggle */}
      <button
        onClick={toggleMode}
        className="p-2 rounded-lg transition-colors hover:bg-[var(--theme-bg-elevated)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
        title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {mode === 'light' ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>

      {/* Theme Selector Dropdown */}
      {showThemeSelector && (
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--theme-bg-elevated)] text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]"
            title="Change theme"
          >
            <Palette className="w-4 h-4" />
            <span className="text-sm">{currentTheme.name}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute bottom-full left-0 mb-1 min-w-[140px] bg-[var(--theme-bg-surface)] border border-[var(--theme-border-default)] rounded-lg shadow-lg overflow-hidden z-50">
              {themeList.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setTheme(theme.id as ThemeId)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    theme.id === themeId
                      ? 'bg-[var(--theme-primary-50)] text-[var(--theme-primary-700)]'
                      : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-elevated)] hover:text-[var(--theme-text-primary)]'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: theme.colors.light.primary[500] }}
                  />
                  {theme.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
