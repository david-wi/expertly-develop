// Type declarations for Module Federation remote: expertly_ui
declare module 'expertly_ui/index' {
  export {
    Sidebar,
    MainLayout,
    MainContent,
    ExpertlyLogo,
    EXPERTLY_PRODUCTS,
    SUPPORTED_LANGUAGES,
    violetPalette,
    type NavItem,
    type ExpertlyProduct,
    type SidebarProps,
    type SupportedLanguage,
    type LanguageOption,
  } from '@expertly/ui'

  export {
    ThemeProvider,
    ThemeContext,
    useTheme,
    ThemeSwitcher,
    themes,
    themeList,
    getTheme,
    getThemeColors,
    type ThemeContextValue,
    type ThemeId,
    type ThemeMode,
    type Theme,
    type ThemeColors,
  } from '@expertly/ui'

  export { formatBuildTimestamp } from '@expertly/ui'
}

// Keep @expertly/ui types for local development
declare module '@expertly/ui' {
  import type { ReactNode, ComponentType } from 'react'

  export interface NavItem {
    name: string
    href: string
    icon: ComponentType<{ className?: string }>
  }

  export interface ExpertlyProduct {
    name: string
    code: string
    href: string
    icon: string
    description: string
  }

  export interface SidebarProps {
    productCode: string
    productName: string
    navigation: NavItem[]
    currentPath: string
    user?: {
      name: string
      role?: string
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

  export type SupportedLanguage = 'en' | 'es'

  export interface LanguageOption {
    code: SupportedLanguage
    flag: string
    name: string
  }

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

  export const EXPERTLY_PRODUCTS: ExpertlyProduct[]
  export const SUPPORTED_LANGUAGES: LanguageOption[]
  export const violetPalette: ThemeColors
  export const themes: Record<ThemeId, Theme>
  export const themeList: Theme[]

  export function Sidebar(props: SidebarProps): JSX.Element
  export function MainLayout(props: { children: ReactNode }): JSX.Element
  export function MainContent(props: { children: ReactNode }): JSX.Element
  export function ExpertlyLogo(props: { className?: string }): JSX.Element
  export function ThemeProvider(props: { children: ReactNode }): JSX.Element
  export function ThemeSwitcher(): JSX.Element
  export function useTheme(): ThemeContextValue
  export function getTheme(id: ThemeId): Theme
  export function getThemeColors(id: ThemeId): ThemeColors
  export function formatBuildTimestamp(timestamp: string | undefined): string | null
  export const ThemeContext: React.Context<ThemeContextValue | null>
}
