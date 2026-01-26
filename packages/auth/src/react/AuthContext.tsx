import { createContext } from 'react'
import type { AuthUser, AuthState } from '../types'

export interface AuthContextValue extends AuthState {
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
