import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { authApi, tokenStorage } from '../api/client'
import { User } from '../types'

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me()
      setUser(userData)
    } catch (error) {
      setUser(null)
      // Clean up any old tokens from localStorage
      tokenStorage.clearTokens()
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a valid Identity session by calling /auth/me
        await refreshUser()
      } catch {
        // Not authenticated - user will be redirected to Identity login
        // when they try to access protected resources
      }
      setIsLoading(false)
    }

    initAuth()
  }, [refreshUser])

  const logout = () => {
    authApi.logout()
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
