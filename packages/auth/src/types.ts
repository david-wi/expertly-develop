export interface AuthUser {
  id: string
  name: string
  email: string | null
  organization_id: string
  organization_name: string | null
  role: string
  avatar_url: string | null
}

export interface ValidateResponse {
  valid: boolean
  user: AuthUser | null
  expires_at: string | null
}

export interface AuthConfig {
  identityApiUrl: string
  cookieDomain?: string
  loginPath?: string
}

export interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}
