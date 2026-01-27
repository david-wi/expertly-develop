import axios from 'axios'

// Use VITE_API_URL in production, fallback to relative path for local dev
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/v1`
  : '/api/v1'
const ORG_STORAGE_KEY = 'expertly-identity-org-id'

const api = axios.create({
  baseURL: API_BASE,
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
  create: async (user: CreateUserRequest): Promise<{ user: User; api_key: string }> => {
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
