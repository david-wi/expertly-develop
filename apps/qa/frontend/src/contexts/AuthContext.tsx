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

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    fullName: string,
    organizationName: string
  ) => Promise<void>
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
      tokenStorage.clearTokens()
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      if (tokenStorage.getAccessToken()) {
        try {
          await refreshUser()
          setIsLoading(false)
          return
        } catch {
          // Token invalid, try auto-login
        }
      }

      // Auto-login with default credentials (temporary - remove when adding real auth)
      try {
        await authApi.login({ email: 'david@bodnick.com', password: 'david123' })
        await refreshUser()
      } catch {
        // Auto-login failed, user needs to register/login manually
      }
      setIsLoading(false)
    }

    initAuth()
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    await authApi.login({ email, password })
    await refreshUser()
  }

  const register = async (
    email: string,
    password: string,
    fullName: string,
    organizationName: string
  ) => {
    await authApi.register({
      email,
      password,
      full_name: fullName,
      organization_name: organizationName,
    })
    await refreshUser()
  }

  const logout = () => {
    authApi.logout()
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
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
