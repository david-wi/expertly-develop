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

// Organizations hook for org switching across all apps
export {
  useOrganizations,
  type UseOrganizationsOptions,
  type UseOrganizationsReturn,
  type OrganizationItem,
} from './hooks/useOrganizations'

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

// Modal component
export {
  Modal,
  ModalFooter,
  type ModalProps,
  type ModalFooterProps,
} from './components/Modal'

// Primitive UI components
export { Checkbox } from './primitives'

// Utilities
export { cn } from './utils/cn'
export { createRenderLink, type RenderLinkProps } from './utils/createRenderLink'

// User menu for sidebar
export {
  UserMenu,
  createDefaultUserMenu,
  type UserMenuItem,
  type UserMenuSection,
  type UserMenuConfig,
  type Organization,
  type CreateDefaultUserMenuOptions,
} from './components/UserMenu'

// Changelog page
export {
  ChangelogPage,
  type ChangelogEntry,
  type ChangelogPageProps,
  type GitCommitEntry,
} from './components/ChangelogPage'

// Voice Transcription
export { VoiceTranscription, VoiceTranscriptionButton, type VoiceTranscriptionProps, type VoiceTranscriptionButtonProps, type VoiceTranscriptionStatus, type VoiceTranscriptionPosition, type VoiceTranscriptionError, type PositionOffset, type TranscriptMessage } from './components/VoiceTranscription'
export { useActiveElement } from './hooks/useActiveElement'
export { useAudioRecorder } from './hooks/useAudioRecorder'
export { useDeepgramWebSocket } from './hooks/useDeepgramWebSocket'
export type { UseActiveElementReturn, UseAudioRecorderReturn, UseAudioRecorderOptions, UseDeepgramWebSocketReturn, UseDeepgramWebSocketOptions } from './components/VoiceTranscription'

// Error handling
export {
  ErrorState,
  type ErrorStateProps,
} from './components/ErrorState'

export {
  logError,
  createErrorLogger,
  type ErrorSeverity,
  type ErrorLogContext,
  type ErrorLogPayload,
} from './utils/errorLogger'
