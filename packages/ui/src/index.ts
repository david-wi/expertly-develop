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
} from './components/Sidebar'

// Current user hook for consistent user display in sidebar
export {
  useCurrentUser,
  type CurrentUser,
  type SidebarUser,
} from './hooks/useCurrentUser'

// Build info utilities
export { formatBuildTimestamp } from './utils/buildInfo'

// Version checker
export {
  VersionChecker,
  getVersionFromEnv,
  type VersionCheckerProps,
  type VersionInfo,
} from './components/VersionChecker'

// Theme system
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
} from './theme'

// Primitive UI components
export { Checkbox } from './primitives'

// Utilities
export { cn } from './utils/cn'
