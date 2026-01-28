import type { Page } from '@playwright/test'

// Mock data for E2E tests
export const mockUsers = [
  {
    id: 'user-1',
    organization_id: 'org-1',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    user_type: 'human',
    role: 'admin',
    is_active: true,
    is_default: false,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    organization_id: 'org-1',
    email: 'bob@example.com',
    name: 'Bob Smith',
    user_type: 'human',
    role: 'member',
    is_active: true,
    is_default: false,
    created_at: '2024-01-02T00:00:00Z',
  },
]

export const mockTeams = [
  {
    id: 'team-1',
    organization_id: 'org-1',
    name: 'Engineering',
    description: 'Engineering team',
    member_ids: ['user-1', 'user-2'],
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'team-2',
    organization_id: 'org-1',
    name: 'Support',
    description: 'Customer support team',
    member_ids: ['user-2'],
    created_at: '2024-01-02T00:00:00Z',
  },
]

export const mockQueues = [
  {
    id: 'queue-1',
    organization_id: 'org-1',
    purpose: 'General Tasks',
    description: 'Default task queue',
    scope_type: 'organization',
    is_system: false,
    priority_default: 5,
    allow_bots: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'queue-2',
    organization_id: 'org-1',
    purpose: 'Urgent Tasks',
    description: 'High priority queue',
    scope_type: 'organization',
    is_system: false,
    priority_default: 1,
    allow_bots: false,
    created_at: '2024-01-02T00:00:00Z',
  },
]

export const mockPlaybooks = [
  {
    id: 'playbook-1',
    organization_id: 'org-1',
    name: 'Customer Onboarding',
    description: 'Steps to onboard a new customer',
    inputs_template: 'Customer name, Email, Company',
    scope_type: 'organization',
    version: 1,
    is_active: true,
    steps: [
      {
        id: 'step-1',
        order: 1,
        title: 'Send welcome email',
        description: 'Send personalized welcome message',
        assignee_type: 'anyone',
        approval_required: false,
      },
      {
        id: 'step-2',
        order: 2,
        title: 'Schedule kickoff call',
        description: 'Set up initial meeting',
        when_to_perform: 'Within 24 hours of signup',
        assignee_type: 'user',
        assignee_id: 'user-1',
        approval_required: true,
        approver_type: 'team',
        approver_id: 'team-1',
      },
    ],
    history: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'user-1',
  },
  {
    id: 'playbook-2',
    organization_id: 'org-1',
    name: 'Bug Triage',
    description: 'Process for handling bug reports',
    scope_type: 'team',
    scope_id: 'team-1',
    version: 2,
    is_active: true,
    steps: [
      {
        id: 'step-3',
        order: 1,
        title: 'Verify bug',
        description: 'Reproduce the issue',
        assignee_type: 'team',
        assignee_id: 'team-1',
        approval_required: false,
      },
    ],
    history: [
      {
        version: 1,
        name: 'Bug Triage',
        description: 'Initial version',
        steps: [],
        changed_at: '2024-01-01T00:00:00Z',
        changed_by: 'user-1',
      },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    created_by: 'user-1',
  },
  {
    id: 'playbook-3',
    organization_id: 'org-1',
    name: 'My Private Playbook',
    description: 'Personal workflow',
    inputs_template: 'Task description',
    scope_type: 'user',
    scope_id: 'user-1',
    version: 1,
    is_active: true,
    steps: [],
    history: [],
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    created_by: 'user-1',
  },
]

export const currentUser = {
  id: 'user-1',
  organization_id: 'org-1',
  email: 'alice@example.com',
  name: 'Alice Johnson',
  user_type: 'human',
  role: 'admin',
  is_active: true,
  is_default: false,
  created_at: '2024-01-01T00:00:00Z',
}

/**
 * Sets up API mocks for Playbooks page tests
 */
export async function setupPlaybooksMocks(page: Page) {
  // Mock current user
  await page.route('**/api/v1/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentUser),
    })
  })

  // Mock users list
  await page.route('**/api/v1/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsers),
    })
  })

  // Mock teams list
  await page.route('**/api/v1/teams', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTeams),
    })
  })

  // Mock queues list
  await page.route('**/api/v1/queues', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockQueues),
    })
  })

  // Variable to track playbooks state (for mutable operations)
  let playbooksState = [...mockPlaybooks]

  // Mock playbooks list
  await page.route('**/api/v1/playbooks', async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(playbooksState),
      })
    } else if (method === 'POST') {
      const body = route.request().postDataJSON()
      const newPlaybook = {
        id: `playbook-${Date.now()}`,
        organization_id: 'org-1',
        name: body.name,
        description: body.description,
        inputs_template: body.inputs_template,
        scope_type: body.scope_type || 'user',
        scope_id: body.scope_id,
        version: 1,
        is_active: true,
        steps: body.steps || [],
        history: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
      }
      playbooksState.push(newPlaybook)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newPlaybook),
      })
    }
  })

  // Mock individual playbook operations
  await page.route('**/api/v1/playbooks/*', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    // Extract playbook ID from URL
    const urlMatch = url.match(/\/api\/v1\/playbooks\/([^/?]+)/)
    const playbookId = urlMatch ? urlMatch[1] : null

    if (!playbookId) {
      await route.fulfill({ status: 404 })
      return
    }

    // Handle duplicate endpoint
    if (url.includes('/duplicate')) {
      const original = playbooksState.find((p) => p.id === playbookId)
      if (original) {
        const duplicated = {
          ...original,
          id: `playbook-${Date.now()}`,
          name: `${original.name} (Copy)`,
          version: 1,
          history: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        playbooksState.push(duplicated)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(duplicated),
        })
      } else {
        await route.fulfill({ status: 404 })
      }
      return
    }

    // Handle history endpoint
    if (url.includes('/history')) {
      const playbook = playbooksState.find((p) => p.id === playbookId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(playbook?.history || []),
      })
      return
    }

    if (method === 'GET') {
      const playbook = playbooksState.find((p) => p.id === playbookId)
      if (playbook) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(playbook),
        })
      } else {
        await route.fulfill({ status: 404 })
      }
    } else if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      const index = playbooksState.findIndex((p) => p.id === playbookId)
      if (index !== -1) {
        const oldPlaybook = playbooksState[index]
        // Create history entry
        const historyEntry = {
          version: oldPlaybook.version,
          name: oldPlaybook.name,
          description: oldPlaybook.description,
          inputs_template: oldPlaybook.inputs_template,
          steps: oldPlaybook.steps,
          changed_at: new Date().toISOString(),
          changed_by: 'user-1',
        }
        // Update playbook
        playbooksState[index] = {
          ...oldPlaybook,
          ...body,
          version: oldPlaybook.version + 1,
          history: [...oldPlaybook.history, historyEntry],
          updated_at: new Date().toISOString(),
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(playbooksState[index]),
        })
      } else {
        await route.fulfill({ status: 404 })
      }
    } else if (method === 'DELETE') {
      const index = playbooksState.findIndex((p) => p.id === playbookId)
      if (index !== -1) {
        playbooksState[index].is_active = false
        playbooksState = playbooksState.filter((p) => p.id !== playbookId)
        await route.fulfill({ status: 204 })
      } else {
        await route.fulfill({ status: 404 })
      }
    }
  })
}

/**
 * Sets up mocks for empty state testing
 */
export async function setupEmptyPlaybooksMocks(page: Page) {
  await page.route('**/api/v1/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentUser),
    })
  })

  await page.route('**/api/v1/users*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUsers),
    })
  })

  await page.route('**/api/v1/teams', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTeams),
    })
  })

  await page.route('**/api/v1/queues', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockQueues),
    })
  })

  await page.route('**/api/v1/playbooks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    }
  })
}
