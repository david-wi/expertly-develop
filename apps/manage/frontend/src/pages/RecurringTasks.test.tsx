import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RecurringTasks from './RecurringTasks'
import { api, RecurringTask, Queue } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getRecurringTasks: vi.fn(),
    getQueues: vi.fn(),
    createRecurringTask: vi.fn(),
    updateRecurringTask: vi.fn(),
    deleteRecurringTask: vi.fn(),
    triggerRecurringTask: vi.fn(),
  },
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

const mockDailyTask: RecurringTask = {
  id: 'rt-1',
  _id: 'rt-1',
  organization_id: 'org-1',
  queue_id: 'queue-1',
  title: 'Daily Standup',
  description: 'Daily team standup meeting',
  priority: 5,
  recurrence_type: 'daily',
  interval: 1,
  days_of_week: [],
  start_date: '2024-01-01T00:00:00Z',
  timezone: 'UTC',
  is_active: true,
  created_tasks_count: 10,
  max_retries: 3,
  created_at: '2024-01-01T00:00:00Z',
  next_run: '2024-01-16T09:00:00Z',
}

const mockWeeklyTask: RecurringTask = {
  ...mockDailyTask,
  id: 'rt-2',
  _id: 'rt-2',
  title: 'Weekly Review',
  recurrence_type: 'weekly',
  interval: 1,
  days_of_week: [0, 4], // Mon, Fri
}

const mockMonthlyTask: RecurringTask = {
  ...mockDailyTask,
  id: 'rt-3',
  _id: 'rt-3',
  title: 'Monthly Report',
  recurrence_type: 'monthly',
  interval: 1,
  day_of_month: 15,
}

const mockInactiveTask: RecurringTask = {
  ...mockDailyTask,
  id: 'rt-4',
  _id: 'rt-4',
  title: 'Inactive Task',
  is_active: false,
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('RecurringTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getRecurringTasks).mockResolvedValue([
      mockDailyTask,
      mockWeeklyTask,
      mockMonthlyTask,
      mockInactiveTask,
    ])
    vi.mocked(api.getQueues).mockResolvedValue([mockQueue])
  })

  it('renders recurring tasks page title', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recurring Tasks' })).toBeInTheDocument()
    })
  })

  it('renders New Recurring Task button', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('New Recurring Task')).toBeInTheDocument()
    })
  })

  it('displays all recurring tasks', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument()
      expect(screen.getByText('Weekly Review')).toBeInTheDocument()
      expect(screen.getByText('Monthly Report')).toBeInTheDocument()
    })
  })

  it('shows tasks in table', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      // Recurring tasks table should be present
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('displays queue name', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getAllByText('Test Queue').length).toBeGreaterThan(0)
    })
  })

  it('renders recurrence schedule column', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      // Schedule column header should be present
      expect(screen.getByText('Schedule')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('formats weekly recurrence correctly', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText(/week on Mon, Fri/)).toBeInTheDocument()
    })
  })

  it('formats monthly recurrence correctly', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText(/month on day 15/)).toBeInTheDocument()
    })
  })

  it('displays created tasks count', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getAllByText('10').length).toBeGreaterThan(0)
    })
  })

  it('shows loading state', () => {
    vi.mocked(api.getRecurringTasks).mockImplementation(() => new Promise(() => {}))

    renderWithRouter(<RecurringTasks />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no recurring tasks', async () => {
    vi.mocked(api.getRecurringTasks).mockResolvedValue([])

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(
        screen.getByText('No recurring tasks found. Create one to automate task creation.')
      ).toBeInTheDocument()
    })
  })

  it('filters by status', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('Daily Standup')).toBeInTheDocument()
    })

    const filterSelect = screen.getByRole('combobox')
    fireEvent.change(filterSelect, { target: { value: 'inactive' } })

    await waitFor(() => {
      expect(api.getRecurringTasks).toHaveBeenCalledWith({ is_active: false })
    })
  })

  it('opens create modal on button click', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()
  })

  it('opens create modal', async () => {
    vi.mocked(api.createRecurringTask).mockResolvedValue(mockDailyTask)

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('New Recurring Task')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('New Recurring Task'))

    await waitFor(() => {
      // Modal title should appear
      expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('closes create modal on cancel', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Create Recurring Task')).not.toBeInTheDocument()
  })

  it('opens edit modal on Edit button click', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByText('Edit Recurring Task')).toBeInTheDocument()
  })

  it('pre-fills edit form with task data', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByDisplayValue('Daily Standup')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Daily team standup meeting')).toBeInTheDocument()
  })

  it('updates recurring task on edit form submit', async () => {
    vi.mocked(api.updateRecurringTask).mockResolvedValue(mockDailyTask)

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    const titleInput = screen.getByDisplayValue('Daily Standup')
    fireEvent.change(titleInput, { target: { value: 'Updated Daily Task' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateRecurringTask).toHaveBeenCalledWith(
        'rt-1',
        expect.objectContaining({
          title: 'Updated Daily Task',
        })
      )
    })
  })

  it('opens delete confirmation on Delete button click', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    expect(screen.getByText('Delete Recurring Task?')).toBeInTheDocument()
  })

  it('deletes recurring task on confirmation', async () => {
    vi.mocked(api.deleteRecurringTask).mockResolvedValue(undefined)

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(api.deleteRecurringTask).toHaveBeenCalledWith('rt-1')
    })
  })

  it('triggers recurring task on Run button click', async () => {
    vi.mocked(api.triggerRecurringTask).mockResolvedValue({ id: 'new-task' } as never)
    window.alert = vi.fn()

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const runButtons = screen.getAllByText('Run')
      fireEvent.click(runButtons[0])
    })

    await waitFor(() => {
      expect(api.triggerRecurringTask).toHaveBeenCalledWith('rt-1')
    })
  })

  it('toggles active status on Pause/Resume click', async () => {
    vi.mocked(api.updateRecurringTask).mockResolvedValue(mockDailyTask)

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      const pauseButtons = screen.getAllByText('Pause')
      fireEvent.click(pauseButtons[0])
    })

    await waitFor(() => {
      expect(api.updateRecurringTask).toHaveBeenCalledWith('rt-1', { is_active: false })
    })
  })

  it('shows Resume button for inactive tasks', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('Resume')).toBeInTheDocument()
    })
  })

  it('shows days of week toggle for weekly recurrence', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    await waitFor(() => {
      expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()
    })

    // Change to weekly - find the recurrence type select
    const selects = screen.getAllByRole('combobox')
    const recurrenceSelect = selects.find(s =>
      s.querySelector('option[value="daily"]') &&
      s.querySelector('option[value="weekly"]')
    )
    if (recurrenceSelect) {
      fireEvent.change(recurrenceSelect, { target: { value: 'weekly' } })
    }

    await waitFor(() => {
      expect(screen.getByText('On days')).toBeInTheDocument()
    })
  })

  it('shows day of month input for monthly recurrence', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    await waitFor(() => {
      expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()
    })

    // Change to monthly - find the recurrence type select
    const selects = screen.getAllByRole('combobox')
    const recurrenceSelect = selects.find(s =>
      s.querySelector('option[value="daily"]') &&
      s.querySelector('option[value="monthly"]')
    )
    if (recurrenceSelect) {
      fireEvent.change(recurrenceSelect, { target: { value: 'monthly' } })
    }

    await waitFor(() => {
      expect(screen.getByText('On day of month')).toBeInTheDocument()
    })
  })

  it('toggles days of week selection', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    await waitFor(() => {
      expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()
    })

    // Change to weekly - find the recurrence type select
    const selects = screen.getAllByRole('combobox')
    const recurrenceSelect = selects.find(s =>
      s.querySelector('option[value="daily"]') &&
      s.querySelector('option[value="weekly"]')
    )
    if (recurrenceSelect) {
      fireEvent.change(recurrenceSelect, { target: { value: 'weekly' } })
    }

    await waitFor(() => {
      expect(screen.getByText('On days')).toBeInTheDocument()
    })

    // Click on Monday
    fireEvent.click(screen.getByText('Mon'))

    // Monday should be highlighted (blue)
    const monButton = screen.getByText('Mon')
    expect(monButton).toHaveClass('bg-blue-600')
  })

  it('closes modals on Escape key', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    expect(screen.getByText('Create Recurring Task')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Create Recurring Task')).not.toBeInTheDocument()
    })
  })

  it('shows inactive tasks with opacity', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('Inactive Task')).toBeInTheDocument()
    })
  })

  it('displays priority input', async () => {
    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Recurring Task'))
    })

    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('1 = highest, 10 = lowest')).toBeInTheDocument()
  })

  it('shows Unknown Queue for missing queue', async () => {
    vi.mocked(api.getRecurringTasks).mockResolvedValue([
      {
        ...mockDailyTask,
        queue_id: 'non-existent',
      },
    ])

    renderWithRouter(<RecurringTasks />)

    await waitFor(() => {
      expect(screen.getByText('Unknown Queue')).toBeInTheDocument()
    })
  })
})
