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

// Build info utilities
export { formatBuildTimestamp } from './utils/buildInfo'

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
