// Types
export type { AuthUser, ValidateResponse, AuthConfig, AuthState } from './types'

// Cookie utilities
export {
  hasSessionCookie,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from './cookie'

// API validation
export { validateSession, getCurrentUser, logout } from './validate'

// Redirect helpers
export { redirectToLogin, buildLoginUrl } from './redirect'

// React components (re-exported for convenience)
export { AuthProvider, useAuth, ProtectedRoute, AuthContext } from './react'
export type { AuthContextValue } from './react'
