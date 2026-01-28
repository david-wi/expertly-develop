import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Tasks from './Tasks'
import { useAppStore } from '../stores/appStore'
import { Queue, Task } from '../services/api'

// Mock the app store
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn(),
}))

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

const mockQueue2: Queue = {
  ...mockQueue,
  id: 'queue-2',
  _id: 'queue-2',
  purpose: 'Another Queue',
}

const mockTask: Task = {
  id: 'task-1',
  _id: 'task-1',
  queue_id: 'queue-1',
  title: 'Test Task',
  description: 'A test task description',
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
  queue_id: 'queue-2',
}

const mockCompletedTask: Task = {
  ...mockTask,
  id: 'task-3',
  _id: 'task-3',
  title: 'Completed Task',
  status: 'completed',
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Tasks', () => {
  const mockFetchTasks = vi.fn()
  const mockFetchQueues = vi.fn()
  const mockCreateTask = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue({
      tasks: [mockTask, mockInProgressTask, mockCompletedTask],
      queues: [mockQueue, mockQueue2],
      loading: { user: false, queues: false, tasks: false },
      fetchTasks: mockFetchTasks,
      fetchQueues: mockFetchQueues,
      createTask: mockCreateTask,
    } as unknown as ReturnType<typeof useAppStore>)
  })

  it('renders tasks page title', () => {
    renderWithRouter(<Tasks />)
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('renders New Task button', () => {
    renderWithRouter(<Tasks />)
    expect(screen.getByText('New Task')).toBeInTheDocument()
  })

  it('displays filter dropdowns', () => {
    renderWithRouter(<Tasks />)
    expect(screen.getByText('Queue')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('displays all tasks in list', () => {
    renderWithRouter(<Tasks />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('In Progress Task')).toBeInTheDocument()
    expect(screen.getByText('Completed Task')).toBeInTheDocument()
  })

  it('shows task list', async () => {
    renderWithRouter(<Tasks />)
    await waitFor(() => {
      // Tasks page should have the task titles displayed
      expect(screen.getByText('Test Task')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('displays task status badges with correct colors', () => {
    renderWithRouter(<Tasks />)
    expect(screen.getByText('queued')).toBeInTheDocument()
    expect(screen.getByText('in progress')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('shows task priority', () => {
    renderWithRouter(<Tasks />)
    expect(screen.getAllByText('P5')).toHaveLength(3)
  })

  it('shows queue name for each task', async () => {
    renderWithRouter(<Tasks />)
    await waitFor(() => {
      // Queue names should appear for tasks
      expect(screen.getAllByText(/Queue:/).length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('shows loading state', () => {
    vi.mocked(useAppStore).mockReturnValue({
      tasks: [],
      queues: [],
      loading: { user: false, queues: false, tasks: true },
      fetchTasks: mockFetchTasks,
      fetchQueues: mockFetchQueues,
      createTask: mockCreateTask,
    } as unknown as ReturnType<typeof useAppStore>)

    renderWithRouter(<Tasks />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no tasks', () => {
    vi.mocked(useAppStore).mockReturnValue({
      tasks: [],
      queues: [mockQueue],
      loading: { user: false, queues: false, tasks: false },
      fetchTasks: mockFetchTasks,
      fetchQueues: mockFetchQueues,
      createTask: mockCreateTask,
    } as unknown as ReturnType<typeof useAppStore>)

    renderWithRouter(<Tasks />)
    expect(screen.getByText('No tasks found')).toBeInTheDocument()
  })

  it('filters tasks by queue', () => {
    renderWithRouter(<Tasks />)

    const queueFilter = screen.getAllByRole('combobox')[0]
    fireEvent.change(queueFilter, { target: { value: 'queue-2' } })

    expect(screen.getByText('In Progress Task')).toBeInTheDocument()
    expect(screen.queryByText('Test Task')).not.toBeInTheDocument()
    expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
  })

  it('filters tasks by status', () => {
    renderWithRouter(<Tasks />)

    const statusFilter = screen.getAllByRole('combobox')[1]
    fireEvent.change(statusFilter, { target: { value: 'completed' } })

    expect(screen.getByText('Completed Task')).toBeInTheDocument()
    expect(screen.queryByText('Test Task')).not.toBeInTheDocument()
    expect(screen.queryByText('In Progress Task')).not.toBeInTheDocument()
  })

  it('opens create task modal on button click', () => {
    renderWithRouter(<Tasks />)

    fireEvent.click(screen.getByText('New Task'))

    expect(screen.getByText('Create New Task')).toBeInTheDocument()
  })

  it('creates task on form submit', async () => {
    mockCreateTask.mockResolvedValue({ ...mockTask, id: 'new-task' })

    renderWithRouter(<Tasks />)

    fireEvent.click(screen.getByText('New Task'))

    await waitFor(() => {
      expect(screen.getByText('Create New Task')).toBeInTheDocument()
    })

    // Fill form - find the queue select in the modal
    const selects = screen.getAllByRole('combobox')
    const modalQueueSelect = selects.find(s => s.querySelector('option[value=""]')?.textContent === 'Select a queue')
    if (modalQueueSelect) {
      fireEvent.change(modalQueueSelect, { target: { value: 'queue-1' } })
    }

    const titleInput = screen.getByPlaceholderText('Task title')
    fireEvent.change(titleInput, { target: { value: 'New Task Title' } })

    const descriptionInput = screen.getByPlaceholderText('Task description')
    fireEvent.change(descriptionInput, { target: { value: 'New description' } })

    // Submit
    fireEvent.click(screen.getByText('Create Task'))

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalled()
    })
  })

  it('closes create modal on cancel', () => {
    renderWithRouter(<Tasks />)

    fireEvent.click(screen.getByText('New Task'))
    expect(screen.getByText('Create New Task')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
  })

  it('closes modal on Escape key', async () => {
    renderWithRouter(<Tasks />)

    fireEvent.click(screen.getByText('New Task'))
    expect(screen.getByText('Create New Task')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Create New Task')).not.toBeInTheDocument()
    })
  })

  it('calls fetch functions on mount', () => {
    renderWithRouter(<Tasks />)
    expect(mockFetchQueues).toHaveBeenCalled()
    expect(mockFetchTasks).toHaveBeenCalled()
  })

  it('displays all status options in filter', () => {
    renderWithRouter(<Tasks />)

    const statusFilter = screen.getAllByRole('combobox')[1]
    expect(statusFilter).toHaveTextContent('All Statuses')

    const options = statusFilter.querySelectorAll('option')
    expect(options.length).toBe(6) // All + 5 statuses
  })

  it('shows Unknown queue for tasks with missing queue', () => {
    const taskWithMissingQueue: Task = {
      ...mockTask,
      queue_id: 'non-existent-queue',
    }

    vi.mocked(useAppStore).mockReturnValue({
      tasks: [taskWithMissingQueue],
      queues: [mockQueue],
      loading: { user: false, queues: false, tasks: false },
      fetchTasks: mockFetchTasks,
      fetchQueues: mockFetchQueues,
      createTask: mockCreateTask,
    } as unknown as ReturnType<typeof useAppStore>)

    renderWithRouter(<Tasks />)
    expect(screen.getByText('Queue: Unknown')).toBeInTheDocument()
  })
})
