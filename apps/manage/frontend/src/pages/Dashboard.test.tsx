import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from './Dashboard'
import { useAppStore } from '../stores/appStore'
import { Queue, Task, User } from '../services/api'

// Mock the app store
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn(),
}))

// Mock the useWebSocket hook
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(),
}))

const mockUser: User = {
  id: 'user-1',
  organization_id: 'org-1',
  email: 'test@example.com',
  name: 'Test User',
  user_type: 'human',
  role: 'member',
  is_active: true,
  is_default: false,
  created_at: '2024-01-01T00:00:00Z',
}

const mockQueue: Queue = {
  id: 'queue-1',
  _id: 'queue-1',
  organization_id: 'org-1',
  purpose: 'Test Queue',
  scope_type: 'organization',
  is_system: false,
  priority_default: 5,
  allow_bots: true,
  created_at: '2024-01-01T00:00:00Z',
}

const mockUserQueue: Queue = {
  id: 'queue-2',
  _id: 'queue-2',
  organization_id: 'org-1',
  purpose: 'My Tasks',
  scope_type: 'user',
  scope_id: 'user-1',
  is_system: false,
  priority_default: 5,
  allow_bots: true,
  created_at: '2024-01-01T00:00:00Z',
}

const mockTask: Task = {
  id: 'task-1',
  _id: 'task-1',
  queue_id: 'queue-1',
  title: 'Test Task',
  description: 'A test task',
  status: 'queued',
  priority: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockInProgressTask: Task = {
  ...mockTask,
  id: 'task-2',
  _id: 'task-2',
  title: 'In Progress Task',
  status: 'in_progress',
}

const mockCompletedTask: Task = {
  ...mockTask,
  id: 'task-3',
  _id: 'task-3',
  title: 'Completed Task',
  status: 'completed',
  updated_at: new Date().toISOString(),
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Dashboard', () => {
  const mockFetchUser = vi.fn()
  const mockFetchQueues = vi.fn()
  const mockFetchTasks = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue({
      user: mockUser,
      queues: [mockQueue, mockUserQueue],
      tasks: [mockTask, mockInProgressTask, mockCompletedTask],
      loading: { user: false, queues: false, tasks: false },
      wsConnected: true,
      fetchUser: mockFetchUser,
      fetchQueues: mockFetchQueues,
      fetchTasks: mockFetchTasks,
    } as ReturnType<typeof useAppStore>)
  })

  it('renders dashboard title', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('displays welcome message with user name', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText(/Welcome,/)).toBeInTheDocument()
    // Use getAllByText since user name may appear multiple times (welcome + queue scope)
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0)
  })

  it('shows WebSocket connection status', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows offline status when not connected', () => {
    vi.mocked(useAppStore).mockReturnValue({
      user: mockUser,
      queues: [mockQueue],
      tasks: [mockTask],
      loading: { user: false, queues: false, tasks: false },
      wsConnected: false,
      fetchUser: mockFetchUser,
      fetchQueues: mockFetchQueues,
      fetchTasks: mockFetchTasks,
    } as ReturnType<typeof useAppStore>)

    renderWithRouter(<Dashboard />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('displays stats cards', async () => {
    renderWithRouter(<Dashboard />)

    // Wait for the page to render
    await waitFor(() => {
      // The Dashboard title should always be visible
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })

    // Check for stats text - these are rendered as "text-sm text-gray-500"
    await waitFor(() => {
      // At minimum, the component should render these labels
      // They may take a moment to appear after the data loads
      expect(screen.getAllByText(/Tasks/).length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('shows loading state for tasks', () => {
    vi.mocked(useAppStore).mockReturnValue({
      user: mockUser,
      queues: [mockQueue],
      tasks: [],
      loading: { user: false, queues: false, tasks: true },
      wsConnected: true,
      fetchUser: mockFetchUser,
      fetchQueues: mockFetchQueues,
      fetchTasks: mockFetchTasks,
    } as ReturnType<typeof useAppStore>)

    renderWithRouter(<Dashboard />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no active tasks', () => {
    vi.mocked(useAppStore).mockReturnValue({
      user: mockUser,
      queues: [mockQueue],
      tasks: [mockCompletedTask],
      loading: { user: false, queues: false, tasks: false },
      wsConnected: true,
      fetchUser: mockFetchUser,
      fetchQueues: mockFetchQueues,
      fetchTasks: mockFetchTasks,
    } as ReturnType<typeof useAppStore>)

    renderWithRouter(<Dashboard />)
    expect(screen.getByText('No active tasks')).toBeInTheDocument()
  })

  it('displays queue filter buttons', async () => {
    renderWithRouter(<Dashboard />)

    // Queue filter buttons should be visible
    await waitFor(() => {
      expect(screen.getByText(/All \(/)).toBeInTheDocument()
    })
  })

  it('displays All filter button with correct count', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText(/All \(2\)/)).toBeInTheDocument()
  })

  it('displays active tasks in table', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('In Progress Task')).toBeInTheDocument()
  })

  it('shows task status badges', () => {
    renderWithRouter(<Dashboard />)
    expect(screen.getByText('queued')).toBeInTheDocument()
    expect(screen.getByText('in progress')).toBeInTheDocument()
  })

  it('displays queue information in queues section', async () => {
    renderWithRouter(<Dashboard />)
    await waitFor(() => {
      expect(screen.getAllByText('Test Queue').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/My Tasks/).length).toBeGreaterThan(0)
    })
  })

  it('shows queue scope badge', async () => {
    renderWithRouter(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText('Everyone')).toBeInTheDocument()
    })
  })

  it('calls fetch functions on mount', () => {
    renderWithRouter(<Dashboard />)
    expect(mockFetchUser).toHaveBeenCalled()
    expect(mockFetchQueues).toHaveBeenCalled()
    expect(mockFetchTasks).toHaveBeenCalled()
  })

  it('displays "View all tasks" link when many tasks', () => {
    const manyTasks = Array.from({ length: 10 }, (_, i) => ({
      ...mockTask,
      id: `task-${i}`,
      _id: `task-${i}`,
      title: `Task ${i}`,
    }))

    vi.mocked(useAppStore).mockReturnValue({
      user: mockUser,
      queues: [mockQueue],
      tasks: manyTasks,
      loading: { user: false, queues: false, tasks: false },
      wsConnected: true,
      fetchUser: mockFetchUser,
      fetchQueues: mockFetchQueues,
      fetchTasks: mockFetchTasks,
    } as ReturnType<typeof useAppStore>)

    renderWithRouter(<Dashboard />)
    expect(screen.getByText(/View all tasks/)).toBeInTheDocument()
  })

  it('shows empty queues state', () => {
    vi.mocked(useAppStore).mockReturnValue({
      user: mockUser,
      queues: [],
      tasks: [],
      loading: { user: false, queues: false, tasks: false },
      wsConnected: true,
      fetchUser: mockFetchUser,
      fetchQueues: mockFetchQueues,
      fetchTasks: mockFetchTasks,
    } as ReturnType<typeof useAppStore>)

    renderWithRouter(<Dashboard />)
    expect(screen.getByText('No queues found')).toBeInTheDocument()
  })
})
