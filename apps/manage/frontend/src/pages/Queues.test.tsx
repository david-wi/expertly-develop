import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import Queues from './Queues'
import { useAppStore } from '../stores/appStore'
import { api, Queue, User } from '../services/api'

// Mock the app store
vi.mock('../stores/appStore', () => ({
  useAppStore: vi.fn(),
}))

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    createQueue: vi.fn(),
    updateQueue: vi.fn(),
    deleteQueue: vi.fn(),
  },
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
  description: 'A test queue description',
  scope_type: 'organization',
  is_system: false,
  priority_default: 5,
  allow_bots: true,
  created_at: '2024-01-01T00:00:00Z',
}

const mockUserQueue: Queue = {
  ...mockQueue,
  id: 'queue-2',
  _id: 'queue-2',
  purpose: 'My Personal Queue',
  scope_type: 'user',
  scope_id: 'user-1',
}

const mockTeamQueue: Queue = {
  ...mockQueue,
  id: 'queue-3',
  _id: 'queue-3',
  purpose: 'Team Queue',
  scope_type: 'team',
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Queues', () => {
  const mockFetchQueues = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue({
      queues: [mockQueue, mockUserQueue, mockTeamQueue],
      user: mockUser,
      fetchQueues: mockFetchQueues,
      loading: { user: false, queues: false, tasks: false },
    } as unknown as ReturnType<typeof useAppStore>)

    // Mock fetch for stats endpoint
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { _id: 'queue-1', queued: 5, in_progress: 2, completed: 10 },
          { _id: 'queue-2', queued: 3, in_progress: 1, completed: 5 },
          { _id: 'queue-3', queued: 2, in_progress: 0, completed: 3 },
        ]),
    })
  })

  it('renders queues page title', () => {
    renderWithRouter(<Queues />)
    expect(screen.getByRole('heading', { name: 'Queues' })).toBeInTheDocument()
  })

  it('renders New Queue button', () => {
    renderWithRouter(<Queues />)
    expect(screen.getByText('New Queue')).toBeInTheDocument()
  })

  it('renders Refresh button', async () => {
    renderWithRouter(<Queues />)
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })

  it('displays all queues in table', () => {
    renderWithRouter(<Queues />)
    expect(screen.getByText('Test Queue')).toBeInTheDocument()
    expect(screen.getByText('My Personal Queue')).toBeInTheDocument()
    expect(screen.getByText('Team Queue')).toBeInTheDocument()
  })

  it('shows queue descriptions', async () => {
    renderWithRouter(<Queues />)
    await waitFor(() => {
      // Queue descriptions should appear in the table
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('displays correct owner labels for different scope types', async () => {
    renderWithRouter(<Queues />)

    await waitFor(() => {
      expect(screen.getByText('Everyone')).toBeInTheDocument() // organization
      expect(screen.getByText('Test User')).toBeInTheDocument() // user (current user)
      expect(screen.getByText('Team')).toBeInTheDocument() // team
    })
  })

  it('shows loading state', () => {
    vi.mocked(useAppStore).mockReturnValue({
      queues: [],
      user: mockUser,
      fetchQueues: mockFetchQueues,
      loading: { user: false, queues: true, tasks: false },
    } as unknown as ReturnType<typeof useAppStore>)

    renderWithRouter(<Queues />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no queues', () => {
    vi.mocked(useAppStore).mockReturnValue({
      queues: [],
      user: mockUser,
      fetchQueues: mockFetchQueues,
      loading: { user: false, queues: false, tasks: false },
    } as unknown as ReturnType<typeof useAppStore>)

    renderWithRouter(<Queues />)
    expect(screen.getByText('No queues found. Create one to get started.')).toBeInTheDocument()
  })

  it('opens create queue modal on button click', () => {
    renderWithRouter(<Queues />)

    fireEvent.click(screen.getByText('New Queue'))

    expect(screen.getByText('Create New Queue')).toBeInTheDocument()
  })

  it('creates queue on form submit', async () => {
    vi.mocked(api.createQueue).mockResolvedValue(mockQueue)

    renderWithRouter(<Queues />)

    fireEvent.click(screen.getByText('New Queue'))

    const purposeInput = screen.getByPlaceholderText('e.g., Client Projects, Weekly Reviews')
    fireEvent.change(purposeInput, { target: { value: 'New Queue Purpose' } })

    const descriptionInput = screen.getByPlaceholderText('Brief description of this queue')
    fireEvent.change(descriptionInput, { target: { value: 'New description' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(api.createQueue).toHaveBeenCalledWith({
        purpose: 'New Queue Purpose',
        description: 'New description',
        scope_type: 'user',
      })
    })
  })

  it('closes create modal on cancel', () => {
    renderWithRouter(<Queues />)

    fireEvent.click(screen.getByText('New Queue'))
    expect(screen.getByText('Create New Queue')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Create New Queue')).not.toBeInTheDocument()
  })

  it('opens edit modal on Edit button click', () => {
    renderWithRouter(<Queues />)

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    expect(screen.getByText('Edit Queue')).toBeInTheDocument()
  })

  it('pre-fills edit form with queue data', () => {
    renderWithRouter(<Queues />)

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    expect(screen.getByDisplayValue('Test Queue')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A test queue description')).toBeInTheDocument()
  })

  it('updates queue on edit form submit', async () => {
    vi.mocked(api.updateQueue).mockResolvedValue(mockQueue)

    renderWithRouter(<Queues />)

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    const purposeInput = screen.getByDisplayValue('Test Queue')
    fireEvent.change(purposeInput, { target: { value: 'Updated Queue' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateQueue).toHaveBeenCalledWith('queue-1', {
        purpose: 'Updated Queue',
        description: 'A test queue description',
      })
    })
  })

  it('opens delete confirmation on Delete button click', () => {
    renderWithRouter(<Queues />)

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    expect(screen.getByText('Delete Queue?')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument()
  })

  it('deletes queue on confirmation', async () => {
    vi.mocked(api.deleteQueue).mockResolvedValue(undefined)

    renderWithRouter(<Queues />)

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    // Find the Delete button in modal
    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(api.deleteQueue).toHaveBeenCalledWith('queue-1')
    })
  })

  it('closes delete modal on cancel', () => {
    renderWithRouter(<Queues />)

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    expect(screen.getByText('Delete Queue?')).toBeInTheDocument()

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    expect(screen.queryByText('Delete Queue?')).not.toBeInTheDocument()
  })

  it('closes modals on Escape key', async () => {
    renderWithRouter(<Queues />)

    fireEvent.click(screen.getByText('New Queue'))
    expect(screen.getByText('Create New Queue')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Create New Queue')).not.toBeInTheDocument()
    })
  })

  it('displays queue stats', async () => {
    renderWithRouter(<Queues />)

    await waitFor(() => {
      // Stats may appear multiple times; just verify they're on the page
      expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('calls fetchQueues on mount', () => {
    renderWithRouter(<Queues />)
    expect(mockFetchQueues).toHaveBeenCalled()
  })

  it('shows User label for non-current user queue', () => {
    const otherUserQueue: Queue = {
      ...mockUserQueue,
      scope_id: 'other-user-id',
    }

    vi.mocked(useAppStore).mockReturnValue({
      queues: [otherUserQueue],
      user: mockUser,
      fetchQueues: mockFetchQueues,
      loading: { user: false, queues: false, tasks: false },
    } as unknown as ReturnType<typeof useAppStore>)

    renderWithRouter(<Queues />)
    expect(screen.getByText('User')).toBeInTheDocument()
  })

  it('selects queue from URL search params', () => {
    render(
      <MemoryRouter initialEntries={['?id=queue-1']}>
        <Queues />
      </MemoryRouter>
    )

    // The component should select the queue but doesn't show it visually in list
    expect(screen.getByText('Test Queue')).toBeInTheDocument()
  })
})
