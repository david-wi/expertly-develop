import { createContext, useEffect, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { themes, getThemeColors } from './themes'
import type { ThemeId, ThemeMode, ThemeColors } from './themes'

const THEME_STORAGE_KEY = 'expertly-theme'
const MODE_STORAGE_KEY = 'expertly-theme-mode'

// Type for API themes
interface ApiTheme {
  id: string
  name: string
  slug: string
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
}

export interface ThemeContextValue {
  themeId: ThemeId | string
  mode: ThemeMode
  setTheme: (id: ThemeId | string) => void
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
  availableThemes: { id: string; name: string }[]
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): string {
  if (typeof window === 'undefined') return 'violet'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored || 'violet'
}

function getStoredMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(MODE_STORAGE_KEY)
  if (stored && (stored === 'light' || stored === 'dark')) {
    return stored
  }
  return null
}

function applyThemeToDOM(themeId: string, mode: ThemeMode, customThemes?: Map<string, ApiTheme>) {
  let colors: ThemeColors

  // Check if it's a custom theme from API
  if (customThemes?.has(themeId)) {
    const customTheme = customThemes.get(themeId)!
    colors = customTheme.colors[mode]
  } else if (themes[themeId as ThemeId]) {
    colors = getThemeColors(themeId as ThemeId, mode)
  } else {
    // Fallback to violet
    colors = getThemeColors('violet', mode)
  }

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

  // Apply sidebar colors (with fallbacks to background/text colors)
  const sidebar = colors.sidebar
  root.style.setProperty('--theme-sidebar-bg', sidebar?.background ?? colors.background.surface)
  root.style.setProperty('--theme-sidebar-bg-hover', sidebar?.backgroundHover ?? colors.background.elevated)
  root.style.setProperty('--theme-sidebar-text', sidebar?.text ?? colors.text.secondary)
  root.style.setProperty('--theme-sidebar-text-muted', sidebar?.textMuted ?? colors.text.muted)
  root.style.setProperty('--theme-sidebar-border', sidebar?.border ?? colors.border.default)

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
  /** Optional URL to fetch themes from Admin API */
  themesApiUrl?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'violet',
  defaultMode,
  themesApiUrl,
}: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<string>(() => getStoredTheme() || defaultTheme)
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = getStoredMode()
    if (stored) return stored
    if (defaultMode) return defaultMode
    return getSystemMode()
  })

  // Store custom themes from API
  const customThemesRef = useRef<Map<string, ApiTheme>>(new Map())
  const [availableThemes, setAvailableThemes] = useState<{ id: string; name: string }[]>(() => {
    // Start with hardcoded themes
    return Object.values(themes).map(t => ({ id: t.id, name: t.name }))
  })

  // Fetch themes from API if URL provided
  useEffect(() => {
    if (!themesApiUrl) return

    const fetchThemes = async () => {
      try {
        const response = await fetch(themesApiUrl)
        if (!response.ok) {
          console.warn('Failed to fetch themes from Admin API, using defaults')
          return
        }

        const apiThemes: ApiTheme[] = await response.json()

        // Store custom themes
        const customMap = new Map<string, ApiTheme>()
        apiThemes.forEach(theme => {
          customMap.set(theme.slug, theme)
        })
        customThemesRef.current = customMap

        // Update available themes list
        setAvailableThemes(apiThemes.map(t => ({ id: t.slug, name: t.name })))

        // Re-apply current theme in case it was updated
        applyThemeToDOM(themeId, mode, customMap)
      } catch (error) {
        console.warn('Error fetching themes from Admin API:', error)
        // Continue with hardcoded themes
      }
    }

    fetchThemes()
  }, [themesApiUrl, themeId, mode])

  // Apply theme on mount and when values change
  useEffect(() => {
    applyThemeToDOM(themeId, mode, customThemesRef.current)
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

  const setTheme = useCallback((id: string) => {
    // Accept both hardcoded themes and custom themes from API
    if (themes[id as ThemeId] || customThemesRef.current.has(id)) {
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
    <ThemeContext.Provider value={{ themeId, mode, setTheme, setMode, toggleMode, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  )
}
