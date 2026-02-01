import axios from 'axios'

// Use VITE_API_URL in production, fallback to relative path for local dev
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/v1`
  : '/api/v1'
const ORG_STORAGE_KEY = 'expertly-identity-org-id'

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Required for cross-origin cookies to be set/sent
})

// Add organization header to all requests
api.interceptors.request.use((config) => {
  const orgId = localStorage.getItem(ORG_STORAGE_KEY)
  if (orgId) {
    config.headers['X-Organization-Id'] = orgId
  }
  return config
})

// Types
export interface BotConfig {
  what_i_can_help_with?: string
  capabilities?: string[]
}

export interface User {
  id: string
  organization_id: string
  name: string
  email: string | null
  user_type: 'human' | 'bot'
  role: 'owner' | 'admin' | 'member'
  is_active: boolean
  is_default: boolean
  is_expertly_admin: boolean
  avatar_url: string | null
  title: string | null
  responsibilities: string | null
  bot_config: BotConfig | null
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  name: string
  email?: string
  user_type: 'human' | 'bot'
  role: 'owner' | 'admin' | 'member'
  avatar_url?: string
  title?: string
  responsibilities?: string
  bot_config?: BotConfig
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  role?: 'owner' | 'admin' | 'member'
  is_active?: boolean
  is_expertly_admin?: boolean
  avatar_url?: string
  title?: string
  responsibilities?: string
  bot_config?: BotConfig
}

export interface Organization {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  organization_id: string
  name: string
  description: string | null
  member_count: number
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  user_id: string
  user_name: string
  user_avatar_url: string | null
  user_type: string
  role: string
  joined_at: string
}

export interface TeamDetail extends Team {
  members: TeamMember[]
}

// Organization Membership types
export interface OrganizationMember {
  id: string
  user_id: string
  organization_id: string
  role: 'owner' | 'admin' | 'member'
  is_primary: boolean
  joined_at: string
  user_name: string
  user_email: string | null
  user_avatar_url: string | null
  user_type: 'human' | 'bot'
}

export interface UserOrganization {
  id: string
  organization_id: string
  organization_name: string
  organization_slug: string
  role: 'owner' | 'admin' | 'member'
  is_primary: boolean
  joined_at: string
}

// API functions
export const organizationsApi = {
  list: async (): Promise<Organization[]> => {
    const { data } = await api.get('/organizations')
    return data.items
  },
  create: async (name: string, slug: string): Promise<Organization> => {
    const { data } = await api.post('/organizations', { name, slug })
    return data
  },
  get: async (id: string): Promise<Organization> => {
    const { data } = await api.get(`/organizations/${id}`)
    return data
  },
}

export const usersApi = {
  list: async (userType?: string): Promise<User[]> => {
    const params = userType ? { user_type: userType } : {}
    const { data } = await api.get('/users', { params })
    return data.items
  },
  create: async (user: CreateUserRequest): Promise<{ user: User }> => {
    const { data } = await api.post('/users', user)
    return data
  },
  get: async (id: string): Promise<User> => {
    const { data } = await api.get(`/users/${id}`)
    return data
  },
  update: async (id: string, updates: UpdateUserRequest): Promise<User> => {
    const { data } = await api.patch(`/users/${id}`, updates)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
  regenerateApiKey: async (id: string): Promise<{ api_key: string }> => {
    const { data } = await api.post(`/users/${id}/regenerate-api-key`)
    return data
  },
  setPassword: async (id: string, password: string): Promise<{ message: string }> => {
    const { data } = await api.post(`/users/${id}/set-password`, { password })
    return data
  },
}

export const teamsApi = {
  list: async (): Promise<Team[]> => {
    const { data } = await api.get('/teams')
    return data.items
  },
  create: async (name: string, description?: string): Promise<Team> => {
    const { data } = await api.post('/teams', { name, description })
    return data
  },
  get: async (id: string): Promise<TeamDetail> => {
    const { data } = await api.get(`/teams/${id}`)
    return data
  },
  update: async (id: string, updates: { name?: string; description?: string }): Promise<Team> => {
    const { data } = await api.patch(`/teams/${id}`, updates)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/teams/${id}`)
  },
  addMember: async (teamId: string, userId: string, role: string = 'member'): Promise<TeamMember> => {
    const { data } = await api.post(`/teams/${teamId}/members`, { user_id: userId, role })
    return data
  },
  removeMember: async (teamId: string, userId: string): Promise<void> => {
    await api.delete(`/teams/${teamId}/members/${userId}`)
  },
}

export const imagesApi = {
  generateAvatar: async (userType: string, description: string, name?: string): Promise<{ url: string }> => {
    const { data } = await api.post('/images/generate-avatar', {
      user_type: userType,
      description,
      name,
    })
    return data
  },
}

// Organization Memberships API
export const membershipsApi = {
  listOrgMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    const { data } = await api.get(`/memberships/${orgId}/members`)
    return data.items
  },
  addMember: async (
    orgId: string,
    params: { user_id?: string; email?: string; role?: string; is_primary?: boolean }
  ): Promise<OrganizationMember> => {
    const { data } = await api.post(`/memberships/${orgId}/members`, params)
    return data
  },
  updateMember: async (
    orgId: string,
    userId: string,
    params: { role?: string; is_primary?: boolean }
  ): Promise<OrganizationMember> => {
    const { data } = await api.patch(`/memberships/${orgId}/members/${userId}`, params)
    return data
  },
  removeMember: async (orgId: string, userId: string): Promise<void> => {
    await api.delete(`/memberships/${orgId}/members/${userId}`)
  },
  listUserOrgs: async (userId: string): Promise<UserOrganization[]> => {
    const { data } = await api.get(`/memberships/users/${userId}/organizations`)
    return data.items
  },
}

// Auth types
export interface AuthUser {
  id: string
  name: string
  email: string | null
  organization_id: string
  organization_name: string | null
  role: string
  avatar_url: string | null
}

export interface LoginResponse {
  session_token: string
  expires_at: string
  user: AuthUser
}

export interface ValidateResponse {
  valid: boolean
  user: AuthUser | null
  expires_at: string | null
}

// Magic Code types
export interface MagicCodeResponse {
  message: string
  expires_in_minutes: number
}

// Password types
export interface ChangePasswordResponse {
  message: string
}

export interface ForgotPasswordResponse {
  message: string
}

export interface ResetPasswordResponse {
  message: string
}

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },
  logout: async (sessionToken?: string): Promise<void> => {
    const headers = sessionToken ? { 'X-Session-Token': sessionToken } : {}
    await api.post('/auth/logout', null, { headers })
  },
  validate: async (sessionToken: string): Promise<ValidateResponse> => {
    const { data } = await api.get('/auth/validate', {
      headers: { 'X-Session-Token': sessionToken },
    })
    return data
  },
  me: async (sessionToken: string): Promise<AuthUser> => {
    const { data } = await api.get('/auth/me', {
      headers: { 'X-Session-Token': sessionToken },
    })
    return data
  },

  // Magic code (passwordless login)
  requestMagicCode: async (email: string): Promise<MagicCodeResponse> => {
    const { data } = await api.post('/auth/magic-code/request', { email })
    return data
  },
  verifyMagicCode: async (email: string, code: string): Promise<LoginResponse> => {
    const { data } = await api.post('/auth/magic-code/verify', { email, code })
    return data
  },

  // Password management
  changePassword: async (currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> => {
    const { data } = await api.post('/auth/password/change', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return data
  },
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const { data } = await api.post('/auth/password/forgot', { email })
    return data
  },
  resetPassword: async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
    const { data } = await api.post('/auth/password/reset', {
      token,
      new_password: newPassword,
    })
    return data
  },
}

export const setOrganizationId = (orgId: string) => {
  localStorage.setItem(ORG_STORAGE_KEY, orgId)
}

export const getOrganizationId = (): string | null => {
  return localStorage.getItem(ORG_STORAGE_KEY)
}

export const clearOrganizationId = () => {
  localStorage.removeItem(ORG_STORAGE_KEY)
}
