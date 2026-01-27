const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  getHealth: () => request<{ status: string; database: string }>('/health'),

  // Images
  generateAvatar: (data: { user_type: string; description: string; name?: string }) =>
    request<{ url: string }>('/api/v1/images/generate-avatar', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Organizations
  getOrganizations: () => request<Organization[]>('/api/v1/organizations'),
  getOrganization: (id: string) => request<Organization>(`/api/v1/organizations/${id}`),

  // Users
  getCurrentUser: () => request<User>('/api/v1/users/me'),
  getUsers: (userType?: string) => {
    const query = userType ? `?user_type=${userType}` : ''
    return request<User[]>(`/api/v1/users${query}`)
  },
  getUser: (id: string) => request<User>(`/api/v1/users/${id}`),
  createUser: (data: CreateUserRequest) =>
    request<User & { api_key: string }>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: UpdateUserRequest) =>
    request<User>(`/api/v1/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    request<void>(`/api/v1/users/${id}`, {
      method: 'DELETE',
    }),
  regenerateApiKey: (id: string) =>
    request<{ api_key: string }>(`/api/v1/users/${id}/regenerate-api-key`, {
      method: 'POST',
    }),

  // Queues
  getQueues: () => request<Queue[]>('/api/v1/queues'),
  getQueue: (id: string) => request<Queue>(`/api/v1/queues/${id}`),
  createQueue: (data: CreateQueueRequest) =>
    request<Queue>('/api/v1/queues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateQueue: (id: string, data: UpdateQueueRequest) =>
    request<Queue>(`/api/v1/queues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteQueue: (id: string) =>
    request<void>(`/api/v1/queues/${id}`, {
      method: 'DELETE',
    }),

  // Tasks
  getTasks: (params?: { queue_id?: string; status?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.queue_id) searchParams.set('queue_id', params.queue_id)
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return request<Task[]>(`/api/v1/tasks${query ? `?${query}` : ''}`)
  },
  getTask: (id: string) => request<Task>(`/api/v1/tasks/${id}`),
  createTask: (data: CreateTaskRequest) =>
    request<Task>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Teams
  getTeams: () => request<Team[]>('/api/v1/teams'),
  getTeam: (id: string) => request<Team>(`/api/v1/teams/${id}`),
  createTeam: (data: CreateTeamRequest) =>
    request<Team>('/api/v1/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTeam: (id: string, data: UpdateTeamRequest) =>
    request<Team>(`/api/v1/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTeam: (id: string) =>
    request<void>(`/api/v1/teams/${id}`, {
      method: 'DELETE',
    }),
  addTeamMember: (teamId: string, userId: string) =>
    request<Team>(`/api/v1/teams/${teamId}/members/${userId}`, {
      method: 'POST',
    }),
  removeTeamMember: (teamId: string, userId: string) =>
    request<Team>(`/api/v1/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Recurring Tasks
  getRecurringTasks: (params?: { queue_id?: string; is_active?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.queue_id) searchParams.set('queue_id', params.queue_id)
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
    const query = searchParams.toString()
    return request<RecurringTask[]>(`/api/v1/recurring-tasks${query ? `?${query}` : ''}`)
  },
  getRecurringTask: (id: string) => request<RecurringTask>(`/api/v1/recurring-tasks/${id}`),
  createRecurringTask: (data: CreateRecurringTaskRequest) =>
    request<RecurringTask>('/api/v1/recurring-tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRecurringTask: (id: string, data: UpdateRecurringTaskRequest) =>
    request<RecurringTask>(`/api/v1/recurring-tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteRecurringTask: (id: string) =>
    request<void>(`/api/v1/recurring-tasks/${id}`, {
      method: 'DELETE',
    }),
  triggerRecurringTask: (id: string) =>
    request<Task>(`/api/v1/recurring-tasks/${id}/trigger`, {
      method: 'POST',
    }),

  // Playbooks
  getPlaybooks: (params?: { scope_type?: string; active_only?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.scope_type) searchParams.set('scope_type', params.scope_type)
    if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only))
    const query = searchParams.toString()
    return request<Playbook[]>(`/api/v1/playbooks${query ? `?${query}` : ''}`)
  },
  getPlaybook: (id: string) => request<Playbook>(`/api/v1/playbooks/${id}`),
  createPlaybook: (data: CreatePlaybookRequest) =>
    request<Playbook>('/api/v1/playbooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePlaybook: (id: string, data: UpdatePlaybookRequest) =>
    request<Playbook>(`/api/v1/playbooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePlaybook: (id: string) =>
    request<void>(`/api/v1/playbooks/${id}`, {
      method: 'DELETE',
    }),
  duplicatePlaybook: (id: string, newName?: string) => {
    const query = newName ? `?new_name=${encodeURIComponent(newName)}` : ''
    return request<Playbook>(`/api/v1/playbooks/${id}/duplicate${query}`, {
      method: 'POST',
    })
  },
  getPlaybookHistory: (id: string) =>
    request<PlaybookHistoryEntry[]>(`/api/v1/playbooks/${id}/history`),
}

// Types
export interface Organization {
  id: string
  name: string
  slug: string
  is_default: boolean
  created_at: string
}

export interface BotConfig {
  poll_interval_seconds?: number
  max_concurrent_tasks?: number
  allowed_queue_ids?: string[]
  capabilities?: string[]
  what_i_can_help_with?: string
}

export interface User {
  _id?: string
  id: string
  organization_id: string
  email: string
  name: string
  user_type: 'human' | 'virtual'
  role: 'owner' | 'admin' | 'member'
  is_active: boolean
  is_default: boolean
  avatar_url?: string
  title?: string
  responsibilities?: string
  bot_config?: BotConfig
  created_at: string
}

export interface Queue {
  _id?: string
  id: string
  organization_id: string
  purpose: string
  description?: string
  scope_type: 'user' | 'team' | 'organization'
  scope_id?: string
  is_system: boolean
  system_type?: string
  priority_default: number
  allow_bots: boolean
  created_at: string
}

export interface Task {
  _id?: string
  id: string
  queue_id: string
  title: string
  description?: string
  status: 'queued' | 'checked_out' | 'in_progress' | 'completed' | 'failed'
  priority: number
  assigned_to_id?: string
  created_at: string
  updated_at: string
}

export interface CreateTaskRequest {
  queue_id: string
  title: string
  description?: string
  priority?: number
}

export interface CreateQueueRequest {
  purpose: string
  description?: string
  scope_type?: 'user' | 'team' | 'organization'
  scope_id?: string
  priority_default?: number
  allow_bots?: boolean
}

export interface UpdateQueueRequest {
  purpose?: string
  description?: string
  priority_default?: number
  allow_bots?: boolean
}

export interface CreateUserRequest {
  email: string
  name: string
  user_type?: 'human' | 'virtual'
  role?: 'owner' | 'admin' | 'member'
  avatar_url?: string
  title?: string
  responsibilities?: string
  bot_config?: BotConfig
}

export interface UpdateUserRequest {
  email?: string
  name?: string
  role?: 'owner' | 'admin' | 'member'
  is_active?: boolean
  avatar_url?: string
  title?: string
  responsibilities?: string
  bot_config?: BotConfig
}

export interface Team {
  _id?: string
  id: string
  organization_id: string
  name: string
  description?: string
  member_ids: string[]
  lead_id?: string
  created_at?: string
}

export interface CreateTeamRequest {
  name: string
  description?: string
  member_ids?: string[]
  lead_id?: string
}

export interface UpdateTeamRequest {
  name?: string
  description?: string
  member_ids?: string[]
  lead_id?: string
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurringTask {
  _id?: string
  id: string
  organization_id: string
  queue_id: string
  title: string
  description?: string
  priority: number
  recurrence_type: RecurrenceType
  cron_expression?: string
  interval: number
  days_of_week: number[]
  day_of_month?: number
  start_date: string
  end_date?: string
  next_run?: string
  last_run?: string
  timezone: string
  is_active: boolean
  created_tasks_count: number
  input_data?: Record<string, unknown>
  max_retries: number
  created_at: string
}

export interface CreateRecurringTaskRequest {
  queue_id: string
  title: string
  description?: string
  priority?: number
  recurrence_type?: RecurrenceType
  cron_expression?: string
  interval?: number
  days_of_week?: number[]
  day_of_month?: number
  start_date?: string
  end_date?: string
  timezone?: string
  input_data?: Record<string, unknown>
  max_retries?: number
}

export interface UpdateRecurringTaskRequest {
  title?: string
  description?: string
  priority?: number
  queue_id?: string
  recurrence_type?: RecurrenceType
  cron_expression?: string
  interval?: number
  days_of_week?: number[]
  day_of_month?: number
  end_date?: string
  timezone?: string
  is_active?: boolean
  input_data?: Record<string, unknown>
  max_retries?: number
}

export type ScopeType = 'user' | 'team' | 'organization'

export type AssigneeType = 'user' | 'team' | 'anyone'

export interface PlaybookStep {
  id: string
  order: number
  title: string
  description?: string
  nested_playbook_id?: string
  assignee_type: AssigneeType
  assignee_id?: string
  queue_id?: string
  approval_required: boolean
  approver_type?: AssigneeType
  approver_id?: string
  approver_queue_id?: string
}

export interface PlaybookStepCreate {
  id?: string
  order?: number
  title: string
  description?: string
  nested_playbook_id?: string
  assignee_type?: AssigneeType
  assignee_id?: string
  queue_id?: string
  approval_required?: boolean
  approver_type?: AssigneeType
  approver_id?: string
  approver_queue_id?: string
}

export interface PlaybookHistoryEntry {
  version: number
  name: string
  description?: string
  steps: PlaybookStep[]
  changed_at: string
  changed_by?: string
}

export interface Playbook {
  id: string
  organization_id: string
  name: string
  description?: string
  steps: PlaybookStep[]
  scope_type: ScopeType
  scope_id?: string
  version: number
  history: PlaybookHistoryEntry[]
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

export interface CreatePlaybookRequest {
  name: string
  description?: string
  steps?: PlaybookStepCreate[]
  scope_type?: ScopeType
  scope_id?: string
}

export interface UpdatePlaybookRequest {
  name?: string
  description?: string
  steps?: PlaybookStepCreate[]
  scope_type?: ScopeType
  scope_id?: string
  is_active?: boolean
}
