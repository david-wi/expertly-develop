/**
 * Shared type declarations for @expertly/ui components
 *
 * This is the SINGLE SOURCE OF TRUTH for all UI component types.
 * All apps should import from here instead of maintaining their own type declarations.
 */

import type { ReactNode, ComponentType } from 'react'

// =============================================================================
// Navigation Types
// =============================================================================

export interface NavItem {
  name: string
  href: string
  icon: ComponentType<{ className?: string }>
}

// =============================================================================
// Product Switcher Types
// =============================================================================

export interface ExpertlyProduct {
  name: string
  code: string
  href: string
  icon: string
  description: string
}

// =============================================================================
// Language Types
// =============================================================================

export type SupportedLanguage = 'en' | 'es'

export interface LanguageOption {
  code: SupportedLanguage
  flag: string
  name: string
}

// =============================================================================
// Sidebar Types
// =============================================================================

export interface SidebarProps {
  productCode: string
  productName: string
  navigation: NavItem[]
  currentPath: string
  user?: {
    name: string
    role?: string
    organization?: string
  }
  basePath?: string
  orgSwitcher?: ReactNode
  bottomSection?: ReactNode
  buildInfo?: ReactNode
  currentLanguage?: SupportedLanguage
  onLanguageChange?: (lang: SupportedLanguage) => void
  showThemeSwitcher?: boolean
  renderLink: (props: {
    href: string
    className: string
    children: ReactNode
    onClick?: () => void
  }) => ReactNode
  versionCheck?: {
    currentCommit?: string
    safeMinutes?: number
  }
}

export interface MainLayoutProps {
  children: ReactNode
}

export interface MainContentProps {
  children: ReactNode
}

// =============================================================================
// Theme Types
// =============================================================================

export type ThemeId = 'violet' | 'blue' | 'green' | 'orange' | 'red' | 'pink' | 'cyan'
export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

export interface Theme {
  id: ThemeId
  name: string
  colors: ThemeColors
}

export interface ThemeContextValue {
  theme: ThemeId
  mode: ThemeMode
  setTheme: (theme: ThemeId) => void
  setMode: (mode: ThemeMode) => void
  toggleMode: () => void
}

export interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: ThemeId
  defaultMode?: ThemeMode
}
