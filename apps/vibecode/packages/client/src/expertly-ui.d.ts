/**
 * AUTO-GENERATED - DO NOT EDIT DIRECTLY
 *
 * This file is synced from packages/ui/src/types/module-federation.d.ts
 * To update, modify the source file and run:
 *   node packages/ui/scripts/sync-types.js
 */

/**
 * Type declarations for Module Federation remote: expertly_ui
 *
 * IMPORTANT: This is the canonical type declaration for the expertly_ui module.
 * Apps should copy this file to their src/ directory as expertly-ui.d.ts
 *
 * When updating types in this file, run:
 *   node scripts/sync-types.js
 * to propagate changes to all apps.
 */

declare module 'expertly_ui/index' {
  import type { FC, ReactNode, ComponentType, Context } from 'react'

  // ==========================================================================
  // Navigation Types
  // ==========================================================================

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

  // ==========================================================================
  // Language Types
  // ==========================================================================

  export type SupportedLanguage = 'en' | 'es'

  export interface LanguageOption {
    code: SupportedLanguage
    flag: string
    name: string
  }

  // ==========================================================================
  // Sidebar Types
  // ==========================================================================

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
    /** Custom content rendered below navigation (e.g., widgets, agent status for Vibecode) */
    children?: ReactNode
  }

  // ==========================================================================
  // Current User Types (for sidebar user display)
  // ==========================================================================

  export interface CurrentUser {
    id: string
    name: string
    email: string
    role?: string
    organization_id?: string | null
    organization_name?: string | null
  }

  export interface SidebarUser {
    name: string
    role?: string
    organization?: string
  }

  // ==========================================================================
  // Theme Types
  // ==========================================================================

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

  // ==========================================================================
  // Exported Constants
  // ==========================================================================

  export const EXPERTLY_PRODUCTS: ExpertlyProduct[]
  export const SUPPORTED_LANGUAGES: LanguageOption[]
  export const violetPalette: ThemeColors
  export const themes: Record<ThemeId, Theme>
  export const themeList: Theme[]

  // ==========================================================================
  // Modal Types
  // ==========================================================================

  export interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    showCloseButton?: boolean
    className?: string
  }

  export interface ModalFooterProps {
    children: ReactNode
    className?: string
  }

  // ==========================================================================
  // Exported Components
  // ==========================================================================

  export function Sidebar(props: SidebarProps): JSX.Element
  export function MainLayout(props: { children: ReactNode }): JSX.Element
  export function MainContent(props: { children: ReactNode }): JSX.Element
  export function ExpertlyLogo(props: { className?: string }): JSX.Element
  export function ThemeProvider(props: { children: ReactNode; defaultTheme?: ThemeId; defaultMode?: ThemeMode }): JSX.Element
  export function ThemeSwitcher(): JSX.Element
  export const ThemeContext: Context<ThemeContextValue | null>
  export function Modal(props: ModalProps): JSX.Element | null
  export function ModalFooter(props: ModalFooterProps): JSX.Element

  // ==========================================================================
  // Exported Functions
  // ==========================================================================

  export function useTheme(): ThemeContextValue
  export function getTheme(id: ThemeId): Theme
  export function getThemeColors(id: ThemeId): ThemeColors
  export function formatBuildTimestamp(timestamp: string | undefined): string | null

  // Current user hook for consistent user display in sidebar
  export function useCurrentUser(fetchFn: () => Promise<CurrentUser>): {
    user: CurrentUser | null
    sidebarUser: SidebarUser | undefined
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>
  }
}
