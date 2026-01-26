import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type { AuthUser, AuthConfig } from '../types'
import { getSessionToken, clearSessionCookie } from '../cookie'
import { validateSession, logout as apiLogout } from '../validate'
import { redirectToLogin } from '../redirect'

interface AuthProviderProps {
  children: ReactNode
  config: AuthConfig
  /**
   * If true, automatically redirect to login when not authenticated
   * Default: true
   */
  requireAuth?: boolean
  /**
   * Callback when authentication check completes
   */
  onAuthStateChange?: (user: AuthUser | null) => void
}

export function AuthProvider({
  children,
  config,
  requireAuth = true,
  onAuthStateChange,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cookieDomain = config.cookieDomain || '.ai.devintensive.com'
  const identityUrl = config.identityApiUrl.replace('/api', '').replace('-api', '')

  const checkAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const token = getSessionToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      onAuthStateChange?.(null)

      if (requireAuth) {
        redirectToLogin(identityUrl)
      }
      return
    }

    const result = await validateSession(config.identityApiUrl, token)

    if (result.valid && result.user) {
      setUser(result.user)
      onAuthStateChange?.(result.user)
    } else {
      setUser(null)
      clearSessionCookie(cookieDomain)
      onAuthStateChange?.(null)

      if (requireAuth) {
        redirectToLogin(identityUrl)
      }
    }

    setIsLoading(false)
  }, [config.identityApiUrl, cookieDomain, identityUrl, requireAuth, onAuthStateChange])

  const logout = useCallback(async () => {
    const token = getSessionToken()
    await apiLogout(config.identityApiUrl, token || undefined)
    clearSessionCookie(cookieDomain)
    setUser(null)
    onAuthStateChange?.(null)
    redirectToLogin(identityUrl)
  }, [config.identityApiUrl, cookieDomain, identityUrl, onAuthStateChange])

  const refresh = useCallback(async () => {
    await checkAuth()
  }, [checkAuth])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    logout,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
