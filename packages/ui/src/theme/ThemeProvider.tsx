import { createContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { ThemeId, ThemeMode, themes, getThemeColors } from './themes'

const THEME_STORAGE_KEY = 'expertly-theme'
const MODE_STORAGE_KEY = 'expertly-theme-mode'

export interface ThemeContextValue {
  themeId: ThemeId
  mode: ThemeMode
  setTheme: (id: ThemeId) => void
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'violet'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored && (stored === 'violet' || stored === 'ocean')) {
    return stored
  }
  return 'violet'
}

function getStoredMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(MODE_STORAGE_KEY)
  if (stored && (stored === 'light' || stored === 'dark')) {
    return stored
  }
  return null
}

function applyThemeToDOM(themeId: ThemeId, mode: ThemeMode) {
  const colors = getThemeColors(themeId, mode)
  const root = document.documentElement

  // Apply primary colors
  Object.entries(colors.primary).forEach(([shade, value]) => {
    root.style.setProperty(`--theme-primary-${shade}`, value)
  })

  // Apply background colors
  root.style.setProperty('--theme-bg-default', colors.background.default)
  root.style.setProperty('--theme-bg-surface', colors.background.surface)
  root.style.setProperty('--theme-bg-elevated', colors.background.elevated)

  // Apply text colors
  root.style.setProperty('--theme-text-primary', colors.text.primary)
  root.style.setProperty('--theme-text-secondary', colors.text.secondary)
  root.style.setProperty('--theme-text-muted', colors.text.muted)

  // Apply border colors
  root.style.setProperty('--theme-border-default', colors.border.default)
  root.style.setProperty('--theme-border-subtle', colors.border.subtle)

  // Set data attributes for CSS selectors
  root.setAttribute('data-theme', themeId)
  root.setAttribute('data-mode', mode)

  // Toggle dark class for Tailwind's dark mode
  if (mode === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: ThemeId
  defaultMode?: ThemeMode
}

export function ThemeProvider({
  children,
  defaultTheme = 'violet',
  defaultMode,
}: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ThemeId>(() => getStoredTheme() || defaultTheme)
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = getStoredMode()
    if (stored) return stored
    if (defaultMode) return defaultMode
    return getSystemMode()
  })

  // Apply theme on mount and when values change
  useEffect(() => {
    applyThemeToDOM(themeId, mode)
  }, [themeId, mode])

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly set a preference
      if (!getStoredMode()) {
        setModeState(e.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    if (themes[id]) {
      setThemeId(id)
      localStorage.setItem(THEME_STORAGE_KEY, id)
    }
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
    localStorage.setItem(MODE_STORAGE_KEY, newMode)
  }, [])

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(MODE_STORAGE_KEY, next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ themeId, mode, setTheme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
