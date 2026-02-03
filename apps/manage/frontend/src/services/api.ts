const API_BASE = import.meta.env.VITE_API_URL || ''
const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // Include cookies for cross-origin requests (Identity session cookie)
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401) {
      // Not authenticated - redirect to Identity login
      const returnUrl = encodeURIComponent(window.location.href)
      window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`
      throw new Error('Redirecting to login...')
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

export const api = {
  getHealth: () => request<{ status: string; database: string }>('/health'),

  // Documents
  getDocuments: (params?: { project_id?: string; task_id?: string; purpose?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.project_id) searchParams.set('project_id', params.project_id)
    if (params?.task_id) searchParams.set('task_id', params.task_id)
    if (params?.purpose) searchParams.set('purpose', params.purpose)
    const query = searchParams.toString()
    return request<Document[]>(`/api/v1/documents${query ? `?${query}` : ''}`)
  },
  getDocument: (id: string, includeHistory?: boolean) => {
    const query = includeHistory ? '?include_history=true' : ''
    return request<Document>(`/api/v1/documents/${id}${query}`)
  },
  getDocumentVersion: (id: string, version: number) =>
    request<DocumentVersionEntry>(`/api/v1/documents/${id}/version/${version}`),
  getDocumentHistory: (id: string) =>
    request<DocumentVersionEntry[]>(`/api/v1/documents/${id}/history`),
  createDocument: (data: CreateDocumentRequest) =>
    request<Document>('/api/v1/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDocument: (id: string, data: UpdateDocumentRequest) =>
    request<Document>(`/api/v1/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteDocument: (id: string) =>
    request<void>(`/api/v1/documents/${id}`, {
      method: 'DELETE',
    }),
  restoreDocument: (id: string) =>
    request<Document>(`/api/v1/documents/${id}/restore`, {
      method: 'POST',
    }),
  revertDocumentToVersion: (id: string, version: number) =>
    request<Document>(`/api/v1/documents/${id}/revert/${version}`, {
      method: 'POST',
    }),

  // Backlog
  getBacklogItems: (params?: { category?: string; status?: string; priority?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.category) searchParams.set('category', params.category)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.priority) searchParams.set('priority', params.priority)
    const query = searchParams.toString()
    return request<BacklogItem[]>(`/api/v1/backlog${query ? `?${query}` : ''}`)
  },
  getBacklogItem: (id: string) => request<BacklogItem>(`/api/v1/backlog/${id}`),
  createBacklogItem: (data: CreateBacklogItemRequest) =>
    request<BacklogItem>('/api/v1/backlog', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateBacklogItem: (id: string, data: UpdateBacklogItemRequest) =>
    request<BacklogItem>(`/api/v1/backlog/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteBacklogItem: (id: string) =>
    request<void>(`/api/v1/backlog/${id}`, {
      method: 'DELETE',
    }),

  // Ideas (convenience methods)
  getIdeas: (params?: { status?: string; priority?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.priority) searchParams.set('priority', params.priority)
    const query = searchParams.toString()
    return request<BacklogItem[]>(`/api/v1/backlog/ideas/list${query ? `?${query}` : ''}`)
  },
  createIdea: (data: CreateBacklogItemRequest) =>
    request<BacklogItem>('/api/v1/backlog/ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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
  getTasks: (params?: { queue_id?: string; status?: string; phase?: string; user_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.queue_id) searchParams.set('queue_id', params.queue_id)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.phase) searchParams.set('phase', params.phase)
    if (params?.user_id) searchParams.set('user_id', params.user_id)
    const query = searchParams.toString()
    return request<Task[]>(`/api/v1/tasks${query ? `?${query}` : ''}`)
  },
  getTask: (id: string) => request<Task>(`/api/v1/tasks/${id}`),
  createTask: (data: CreateTaskRequest) =>
    request<Task>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, data: UpdateTaskRequest) =>
    request<Task>(`/api/v1/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTask: (id: string) =>
    request<void>(`/api/v1/tasks/${id}`, {
      method: 'DELETE',
    }),
  reorderTasks: (items: TaskReorderItem[]) =>
    request<{ success: boolean; updated_count: number }>('/api/v1/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Task Phase Transitions
  markTaskReady: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/mark-ready`, {
      method: 'POST',
    }),
  submitForReview: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/submit-for-review`, {
      method: 'POST',
    }),
  startReview: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/start-review`, {
      method: 'POST',
    }),
  requestChanges: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/request-changes`, {
      method: 'POST',
    }),
  approveTask: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/approve`, {
      method: 'POST',
    }),
  resumeWork: (id: string) =>
    request<Task>(`/api/v1/tasks/${id}/resume-work`, {
      method: 'POST',
    }),

  // Task Attachments
  getTaskAttachments: (taskId: string, params?: { step_id?: string; task_level_only?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.step_id) searchParams.set('step_id', params.step_id)
    if (params?.task_level_only) searchParams.set('task_level_only', 'true')
    const query = searchParams.toString()
    return request<TaskAttachment[]>(`/api/v1/tasks/${taskId}/attachments${query ? `?${query}` : ''}`)
  },
  uploadTaskAttachment: async (taskId: string, file: File, note?: string, stepId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (note) formData.append('note', note)
    if (stepId) formData.append('step_id', stepId)

    const response = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/attachments/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        const returnUrl = encodeURIComponent(window.location.href)
        window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`
        throw new Error('Redirecting to login...')
      }
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json() as Promise<TaskAttachment>
  },
  addTaskLink: (taskId: string, data: CreateTaskLinkRequest) =>
    request<TaskAttachment>(`/api/v1/tasks/${taskId}/attachments/link`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAttachment: (attachmentId: string) =>
    request<TaskAttachment>(`/api/v1/attachments/${attachmentId}`),
  deleteAttachment: (attachmentId: string) =>
    request<void>(`/api/v1/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
  getAttachmentDownloadUrl: (attachmentId: string) =>
    `${API_BASE}/api/v1/attachments/${attachmentId}/download`,

  // Step Responses
  getStepResponses: (taskId: string) =>
    request<StepResponse[]>(`/api/v1/tasks/${taskId}/steps`),
  getStepResponse: (taskId: string, stepId: string) =>
    request<StepResponse>(`/api/v1/tasks/${taskId}/steps/${stepId}`),
  updateStepResponse: (taskId: string, stepId: string, data: UpdateStepResponseRequest) =>
    request<StepResponse>(`/api/v1/tasks/${taskId}/steps/${stepId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  completeStep: (taskId: string, stepId: string, data?: CompleteStepRequest) =>
    request<StepResponse>(`/api/v1/tasks/${taskId}/steps/${stepId}/complete`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  skipStep: (taskId: string, stepId: string) =>
    request<StepResponse>(`/api/v1/tasks/${taskId}/steps/${stepId}/skip`, {
      method: 'POST',
    }),
  getStepAttachments: (taskId: string, stepId: string) =>
    request<TaskAttachment[]>(`/api/v1/tasks/${taskId}/steps/${stepId}/attachments`),
  uploadStepAttachment: async (taskId: string, stepId: string, file: File, note?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (note) formData.append('note', note)

    const response = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/steps/${stepId}/attachments/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    if (!response.ok) {
      if (response.status === 401) {
        const returnUrl = encodeURIComponent(window.location.href)
        window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`
        throw new Error('Redirecting to login...')
      }
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(error.detail || `HTTP ${response.status}`)
    }

    return response.json() as Promise<TaskAttachment>
  },

  // Task Comments
  getTaskComments: (taskId: string) =>
    request<TaskComment[]>(`/api/v1/tasks/${taskId}/comments`),
  createTaskComment: (taskId: string, data: CreateTaskCommentRequest) =>
    request<TaskComment>(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getComment: (commentId: string) =>
    request<TaskComment>(`/api/v1/comments/${commentId}`),
  updateTaskComment: (commentId: string, data: UpdateTaskCommentRequest) =>
    request<TaskComment>(`/api/v1/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTaskComment: (commentId: string) =>
    request<void>(`/api/v1/comments/${commentId}`, {
      method: 'DELETE',
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
  getRecurringTasks: (params?: { queue_id?: string; project_id?: string; is_active?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.queue_id) searchParams.set('queue_id', params.queue_id)
    if (params?.project_id) searchParams.set('project_id', params.project_id)
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
  reorderPlaybooks: (items: PlaybookReorderItem[]) =>
    request<{ success: boolean }>('/api/v1/playbooks/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Projects
  getProjects: (params?: { status?: string; parent_project_id?: string; top_level_only?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.parent_project_id) searchParams.set('parent_project_id', params.parent_project_id)
    if (params?.top_level_only !== undefined) searchParams.set('top_level_only', String(params.top_level_only))
    const query = searchParams.toString()
    return request<Project[]>(`/api/v1/projects${query ? `?${query}` : ''}`)
  },
  getProject: (id: string) => request<Project>(`/api/v1/projects/${id}`),
  getProjectChildren: (id: string) => request<Project[]>(`/api/v1/projects/${id}/children`),
  getProjectTasks: (id: string, params?: { status?: string; include_subtasks?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.include_subtasks !== undefined) searchParams.set('include_subtasks', String(params.include_subtasks))
    const query = searchParams.toString()
    return request<Task[]>(`/api/v1/projects/${id}/tasks${query ? `?${query}` : ''}`)
  },
  getProjectRecurringTasks: (id: string, params?: { is_active?: boolean }) => {
    const searchParams = new URLSearchParams()
    if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active))
    const query = searchParams.toString()
    return request<RecurringTask[]>(`/api/v1/projects/${id}/recurring-tasks${query ? `?${query}` : ''}`)
  },
  createProject: (data: CreateProjectRequest) =>
    request<Project>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProject: (id: string, data: UpdateProjectRequest) =>
    request<Project>(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteProject: (id: string) =>
    request<void>(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    }),

  // Connections
  getConnections: () => request<Connection[]>('/api/v1/connections'),
  getConnection: (id: string) => request<Connection>(`/api/v1/connections/${id}`),
  deleteConnection: (id: string) =>
    request<void>(`/api/v1/connections/${id}`, {
      method: 'DELETE',
    }),
  startOAuthFlow: (provider: string) =>
    request<OAuthStartResponse>(`/api/v1/connections/oauth/${provider}/start`),
  refreshConnection: (id: string) =>
    request<Connection>(`/api/v1/connections/${id}/refresh`, {
      method: 'POST',
    }),
  getConnectionProviders: () => request<ConnectionProvider[]>('/api/v1/connections/providers'),

  // AI
  generatePlaybookSteps: (data: GenerateStepsRequest) =>
    request<GenerateStepsResponse>('/api/v1/ai/playbooks/generate-steps', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Monitors
  getMonitors: (params?: { status?: string; provider?: string; project_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.provider) searchParams.set('provider', params.provider)
    if (params?.project_id) searchParams.set('project_id', params.project_id)
    const query = searchParams.toString()
    return request<Monitor[]>(`/api/v1/monitors${query ? `?${query}` : ''}`)
  },
  getMonitor: (id: string) => request<Monitor>(`/api/v1/monitors/${id}`),
  createMonitor: (data: CreateMonitorRequest) =>
    request<Monitor>('/api/v1/monitors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMonitor: (id: string, data: UpdateMonitorRequest) =>
    request<Monitor>(`/api/v1/monitors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteMonitor: (id: string) =>
    request<void>(`/api/v1/monitors/${id}`, {
      method: 'DELETE',
    }),
  pollMonitor: (id: string) =>
    request<MonitorPollResult>(`/api/v1/monitors/${id}/poll`, {
      method: 'POST',
    }),
  pauseMonitor: (id: string) =>
    request<Monitor>(`/api/v1/monitors/${id}/pause`, {
      method: 'POST',
    }),
  resumeMonitor: (id: string) =>
    request<Monitor>(`/api/v1/monitors/${id}/resume`, {
      method: 'POST',
    }),
  getMonitorEvents: (id: string, limit?: number) => {
    const query = limit ? `?limit=${limit}` : ''
    return request<MonitorEvent[]>(`/api/v1/monitors/${id}/events${query}`)
  },
  getMonitorStats: () => request<MonitorStats>('/api/v1/monitors/stats/summary'),

  // Task Dependencies
  getTaskDependencies: (taskId: string) =>
    request<TaskDependencyInfo>(`/api/v1/tasks/${taskId}/dependencies`),
  updateTaskDependencies: (taskId: string, depends_on: string[]) =>
    request<Task>(`/api/v1/tasks/${taskId}/dependencies`, {
      method: 'PATCH',
      body: JSON.stringify({ depends_on }),
    }),

  // Notifications
  getNotifications: (params?: { unread_only?: boolean; notification_type?: string; limit?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.unread_only) searchParams.set('unread_only', 'true')
    if (params?.notification_type) searchParams.set('notification_type', params.notification_type)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    const query = searchParams.toString()
    return request<Notification[]>(`/api/v1/notifications${query ? `?${query}` : ''}`)
  },
  getUnreadNotificationCount: () =>
    request<{ count: number }>('/api/v1/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/api/v1/notifications/${id}/read`, {
      method: 'POST',
    }),
  markAllNotificationsRead: () =>
    request<{ success: boolean; marked_count: number }>('/api/v1/notifications/read-all', {
      method: 'POST',
    }),
  dismissNotification: (id: string) =>
    request<{ success: boolean }>(`/api/v1/notifications/${id}/dismiss`, {
      method: 'POST',
    }),

  // Bots
  getBots: (params?: { status_filter?: string; queue_id?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.status_filter) searchParams.set('status_filter', params.status_filter)
    if (params?.queue_id) searchParams.set('queue_id', params.queue_id)
    const query = searchParams.toString()
    return request<BotWithStatus[]>(`/api/v1/bots${query ? `?${query}` : ''}`)
  },
  getBot: (id: string) => request<BotWithStatus>(`/api/v1/bots/${id}`),
  getBotActivity: (id: string, params?: { limit?: number; activity_type?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.activity_type) searchParams.set('activity_type', params.activity_type)
    const query = searchParams.toString()
    return request<BotActivity[]>(`/api/v1/bots/${id}/activity${query ? `?${query}` : ''}`)
  },
  getBotStats: (id: string, days?: number) => {
    const query = days ? `?days=${days}` : ''
    return request<BotStats>(`/api/v1/bots/${id}/stats${query}`)
  },
  pauseBot: (id: string) =>
    request<{ success: boolean; bot_id: string; status: string }>(`/api/v1/bots/${id}/pause`, {
      method: 'POST',
    }),
  resumeBot: (id: string) =>
    request<{ success: boolean; bot_id: string; status: string }>(`/api/v1/bots/${id}/resume`, {
      method: 'POST',
    }),
  updateBotConfig: (id: string, data: BotConfigUpdate) =>
    request<BotWithStatus>(`/api/v1/bots/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getBotTasks: (id: string) =>
    request<Array<{
      id: string
      title: string
      status: string
      priority: number
      checked_out_at?: string
      started_at?: string
    }>>(`/api/v1/bots/${id}/tasks`),
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

export type TaskPhase =
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'pending_review'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'waiting_on_subplaybook'

export interface Task {
  _id?: string
  id: string
  queue_id: string
  title: string
  description?: string
  status: 'queued' | 'blocked' | 'checked_out' | 'in_progress' | 'completed' | 'failed'
  phase: TaskPhase
  priority: number
  assigned_to_id?: string
  project_id?: string
  sop_id?: string
  // Review fields
  reviewer_id?: string
  review_requested_at?: string
  // Approval fields
  approver_type?: 'user' | 'team' | 'anyone'
  approver_id?: string
  approver_queue_id?: string
  approval_required?: boolean
  // Dependencies
  depends_on?: string[]
  // Playbook tracking
  playbook_id?: string
  source_monitor_id?: string
  // Scheduling fields
  scheduled_start?: string
  scheduled_end?: string
  schedule_timezone?: string
  // Manual ordering
  sequence?: number
  created_at: string
  updated_at: string
}

export interface CreateTaskRequest {
  queue_id: string
  title: string
  description?: string
  priority?: number
  project_id?: string
  sop_id?: string
  // Approval fields
  approver_type?: 'user' | 'team' | 'anyone'
  approver_id?: string
  approver_queue_id?: string
  approval_required?: boolean
  // Dependencies
  depends_on?: string[]
  // Playbook tracking
  playbook_id?: string
  // Scheduling fields
  scheduled_start?: string
  scheduled_end?: string
  schedule_timezone?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: number
  queue_id?: string
  assigned_to_id?: string
  project_id?: string
  sop_id?: string
  // Approval fields
  approver_type?: 'user' | 'team' | 'anyone'
  approver_id?: string
  approver_queue_id?: string
  approval_required?: boolean
  // Dependencies
  depends_on?: string[]
  // Playbook tracking
  playbook_id?: string
  // Scheduling fields
  scheduled_start?: string | null
  scheduled_end?: string | null
  schedule_timezone?: string | null
  // Manual ordering
  sequence?: number
}

export interface TaskReorderItem {
  id: string
  sequence: number
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
  project_id?: string | null
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
  project_id?: string
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
  project_id?: string | null
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

export type PlaybookItemType = 'playbook' | 'group'

export interface PlaybookStep {
  id: string
  order: number
  title: string
  description?: string
  when_to_perform?: string
  parallel_group?: string
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
  when_to_perform?: string
  parallel_group?: string
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
  inputs_template?: string
  steps: PlaybookStep[]
  changed_at: string
  changed_by?: string
}

export interface Playbook {
  id: string
  organization_id: string
  name: string
  description?: string
  inputs_template?: string
  steps: PlaybookStep[]
  scope_type: ScopeType
  scope_id?: string
  version: number
  history: PlaybookHistoryEntry[]
  is_active: boolean
  instance_count: number
  last_instance_created_at?: string | null
  created_at: string
  updated_at: string
  created_by?: string
  item_type: PlaybookItemType
  parent_id?: string | null
  order_index: number
  // Assignment defaults
  default_queue_id?: string
  default_approver_type?: 'user' | 'team' | 'anyone'
  default_approver_id?: string
  default_approver_queue_id?: string
}

export interface CreatePlaybookRequest {
  name: string
  description?: string
  inputs_template?: string
  steps?: PlaybookStepCreate[]
  scope_type?: ScopeType
  scope_id?: string
  item_type?: PlaybookItemType
  parent_id?: string | null
  // Assignment defaults
  default_queue_id?: string
  default_approver_type?: 'user' | 'team' | 'anyone'
  default_approver_id?: string
  default_approver_queue_id?: string
}

export interface UpdatePlaybookRequest {
  name?: string
  description?: string
  inputs_template?: string
  steps?: PlaybookStepCreate[]
  scope_type?: ScopeType
  scope_id?: string
  is_active?: boolean
  parent_id?: string | null
  // Assignment defaults
  default_queue_id?: string
  default_approver_type?: 'user' | 'team' | 'anyone'
  default_approver_id?: string
  default_approver_queue_id?: string
}

export interface PlaybookReorderItem {
  id: string
  parent_id: string | null
  order_index: number
}

// Project types
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'

export interface ProjectResource {
  title: string
  url: string
  type: 'link' | 'file'
}

export interface ProjectCustomField {
  label: string
  value: string
}

export interface ProjectComment {
  id: string
  content: string
  author_id: string
  author_name: string
  created_at: string
}

export interface Project {
  _id?: string
  id: string
  organization_id: string
  name: string
  description?: string
  status: ProjectStatus
  parent_project_id?: string | null
  owner_user_id?: string
  team_id?: string
  resources?: ProjectResource[]
  custom_fields?: ProjectCustomField[]
  next_steps?: string
  ai_suggestions?: string
  comments?: ProjectComment[]
  created_at: string
  updated_at?: string
}

export interface CreateProjectRequest {
  name: string
  description?: string
  parent_project_id?: string | null
  owner_user_id?: string
  team_id?: string
  resources?: ProjectResource[]
  custom_fields?: ProjectCustomField[]
  next_steps?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  status?: ProjectStatus
  parent_project_id?: string | null
  owner_user_id?: string
  team_id?: string
  resources?: ProjectResource[]
  custom_fields?: ProjectCustomField[]
  next_steps?: string
  ai_suggestions?: string
  comments?: ProjectComment[]
}

// Backlog types
export type BacklogStatus = 'new' | 'in_progress' | 'done' | 'archived'
export type BacklogPriority = 'low' | 'medium' | 'high'
export type BacklogCategory = 'backlog' | 'idea'

export interface BacklogItem {
  _id?: string
  id: string
  organization_id: string
  title: string
  description?: string
  status: BacklogStatus
  priority: BacklogPriority
  category: BacklogCategory
  tags: string[]
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface CreateBacklogItemRequest {
  title: string
  description?: string
  status?: BacklogStatus
  priority?: BacklogPriority
  category?: BacklogCategory
  tags?: string[]
}

export interface UpdateBacklogItemRequest {
  title?: string
  description?: string
  status?: BacklogStatus
  priority?: BacklogPriority
  category?: BacklogCategory
  tags?: string[]
}

// Connection types
export type ConnectionProviderType = 'google' | 'slack' | 'microsoft' | 'teamwork'
export type ConnectionStatusType = 'active' | 'expired' | 'revoked'

export interface Connection {
  id: string
  provider: ConnectionProviderType
  provider_email?: string
  status: ConnectionStatusType
  scopes: string[]
  connected_at: string
  last_used_at?: string
}

export interface OAuthStartResponse {
  auth_url: string
  state: string
}

export interface ProviderSetupInstructions {
  steps: string[]
  console_url: string
  docs_url: string
}

export interface ConnectionProvider {
  id: string
  name: string
  description: string
  scopes: string[]
  configured: boolean
  setup?: ProviderSetupInstructions
}

// AI types
export interface GenerateStepsExistingStep {
  title: string
  description?: string
  when_to_perform?: string
}

export interface GenerateStepsRequest {
  playbook_name: string
  playbook_description?: string
  existing_steps: GenerateStepsExistingStep[]
  user_prompt?: string
}

export interface GeneratedStep {
  title: string
  description?: string | null
  when_to_perform?: string | null
}

export interface GenerateStepsResponse {
  steps: GeneratedStep[]
}

// Task Attachment types
export type AttachmentType = 'file' | 'link'

export interface TaskAttachment {
  id: string
  task_id: string
  organization_id: string
  attachment_type: AttachmentType
  // Step association (optional)
  step_id?: string
  // File fields
  filename?: string
  original_filename?: string
  mime_type?: string
  size_bytes?: number
  // Link fields
  url?: string
  link_title?: string
  // Common fields
  note?: string
  uploaded_by_id: string
  created_at: string
}

export interface CreateTaskLinkRequest {
  url: string
  link_title?: string
  note?: string
  step_id?: string
}

// Step Response types
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export interface StepResponse {
  id: string
  task_id: string
  organization_id: string
  step_id: string
  step_order: number
  status: StepStatus
  notes?: string
  output_data?: Record<string, unknown>
  completed_by_id?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface UpdateStepResponseRequest {
  notes?: string
  output_data?: Record<string, unknown>
}

export interface CompleteStepRequest {
  notes?: string
  output_data?: Record<string, unknown>
}

// Task Comment types
export interface TaskComment {
  id: string
  task_id: string
  organization_id: string
  user_id: string
  user_name?: string
  content: string
  attachment_ids: string[]
  created_at: string
  updated_at: string
}

export interface CreateTaskCommentRequest {
  content: string
  attachment_ids?: string[]
}

export interface UpdateTaskCommentRequest {
  content?: string
  attachment_ids?: string[]
}

// Monitor types
export type MonitorProviderType = 'slack' | 'google_drive' | 'gmail' | 'outlook' | 'teamwork' | 'github'
export type MonitorStatusType = 'active' | 'paused' | 'error'

export interface SlackConfig {
  channel_ids?: string[]
  workspace_wide?: boolean
  tagged_user_ids?: string[]
  keywords?: string[]
  context_messages?: number
}

export interface Monitor {
  _id?: string
  id: string
  organization_id: string
  name: string
  description?: string
  scope_type: ScopeType
  scope_id?: string
  provider: MonitorProviderType
  connection_id: string
  provider_config: SlackConfig | Record<string, unknown>
  playbook_id: string
  input_data_template?: Record<string, unknown>
  queue_id?: string
  project_id?: string
  poll_interval_seconds: number
  status: MonitorStatusType
  last_polled_at?: string
  last_event_at?: string
  last_error?: string
  poll_cursor?: Record<string, unknown>
  events_detected: number
  playbooks_triggered: number
  created_at: string
  updated_at?: string
}

export interface MonitorEvent {
  _id?: string
  id: string
  organization_id: string
  monitor_id: string
  provider_event_id: string
  event_type: string
  event_data: Record<string, unknown>
  context_data?: Record<string, unknown>
  processed: boolean
  task_id?: string
  provider_timestamp?: string
  created_at: string
}

export interface CreateMonitorRequest {
  name: string
  description?: string
  scope_type?: ScopeType
  scope_id?: string
  provider: MonitorProviderType
  connection_id: string
  provider_config: SlackConfig | Record<string, unknown>
  playbook_id: string
  input_data_template?: Record<string, unknown>
  queue_id?: string
  project_id?: string
  poll_interval_seconds?: number
}

export interface UpdateMonitorRequest {
  name?: string
  description?: string
  provider_config?: SlackConfig | Record<string, unknown>
  playbook_id?: string
  input_data_template?: Record<string, unknown>
  queue_id?: string
  project_id?: string
  poll_interval_seconds?: number
}

export interface MonitorPollResult {
  monitor_id: string
  events_found: number
  playbooks_triggered: number
  error?: string
}

export interface MonitorStats {
  total: number
  active: number
  paused: number
  error: number
  total_events_detected: number
  total_playbooks_triggered: number
}

// GitHub config for monitors
export interface GitHubConfig {
  owner: string
  repo: string
  event_types?: string[]
  branches?: string[]
  labels?: string[]
  exclude_bots?: boolean
  pr_actions?: string[]
  issue_actions?: string[]
  include_diff?: boolean
  include_comments?: number
}

// Task Dependency types
export interface TaskDependencyInfo {
  task_id: string
  upstream: Array<{
    id: string
    title: string
    status: string
  }>
  downstream: Array<{
    id: string
    title: string
    status: string
  }>
}

// Notification types
export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_failed'
  | 'task_unblocked'
  | 'approval_needed'
  | 'bot_failure_alert'
  | 'mention'

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  notification_type: NotificationType
  title: string
  message: string
  task_id?: string
  actor_id?: string
  actor_name?: string
  read: boolean
  read_at?: string
  dismissed: boolean
  action_url?: string
  created_at: string
}

// Bot types
export type BotStatusType = 'online' | 'offline' | 'paused' | 'busy'

export interface BotWithStatus {
  id: string
  organization_id: string
  email: string
  name: string
  avatar_url?: string
  title?: string
  responsibilities?: string
  is_active: boolean
  poll_interval_seconds: number
  max_concurrent_tasks: number
  allowed_queue_ids: string[]
  capabilities: string[]
  what_i_can_help_with?: string
  status: BotStatusType
  last_seen_at?: string
  current_task_count: number
  tasks_completed_7d: number
  tasks_failed_7d: number
  avg_task_duration_seconds?: number
  created_at: string
}

export type BotActivityType =
  | 'task_claimed'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_released'
  | 'heartbeat'
  | 'connected'
  | 'disconnected'

export interface BotActivity {
  id: string
  bot_id: string
  activity_type: BotActivityType
  task_id?: string
  task_title?: string
  duration_seconds?: number
  error_message?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface BotStats {
  bot_id: string
  period_days: number
  tasks_completed: number
  tasks_failed: number
  tasks_claimed: number
  avg_duration_seconds?: number
  min_duration_seconds?: number
  max_duration_seconds?: number
  last_activity_at?: string
}

export interface BotConfigUpdate {
  poll_interval_seconds?: number
  max_concurrent_tasks?: number
  allowed_queue_ids?: string[]
  capabilities?: string[]
  what_i_can_help_with?: string
}

// Document types
export interface Document {
  id: string
  organization_id: string
  title: string
  description?: string
  content?: string
  purpose?: string
  project_id?: string
  task_id?: string
  external_url?: string
  external_title?: string
  version: number
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface DocumentVersionEntry {
  version: number
  title: string
  description?: string
  content?: string
  changed_at: string
  changed_by?: string
  is_current: boolean
}

export interface CreateDocumentRequest {
  title: string
  description?: string
  content?: string
  purpose?: string
  project_id?: string
  task_id?: string
  external_url?: string
  external_title?: string
}

export interface UpdateDocumentRequest {
  title?: string
  description?: string
  content?: string
  purpose?: string
  project_id?: string
  task_id?: string
  external_url?: string
  external_title?: string
}
