import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import JobQueuePage from './JobQueuePage'
import { jobsApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  jobsApi: {
    list: vi.fn(),
    cancel: vi.fn(),
  },
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
  formatDuration: vi.fn(() => '5 minutes'),
  intervalToDuration: vi.fn(() => ({ minutes: 5, seconds: 0 })),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('JobQueuePage', () => {
  const mockJobs = {
    items: [
      {
        id: 'job-1',
        job_type: 'walkthrough',
        status: 'completed' as const,
        progress: 100,
        current_step: null,
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:01Z',
        completed_at: '2024-01-01T00:05:00Z',
        elapsed_ms: 299000,
        project_id: 'proj-1',
        project_name: 'Test Project',
        requested_by_name: 'John Doe',
        result: null,
        error: null,
      },
      {
        id: 'job-2',
        job_type: 'generate_report',
        status: 'running' as const,
        progress: 50,
        current_step: 'Processing screenshots',
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:01Z',
        completed_at: null,
        elapsed_ms: 150000,
        project_id: 'proj-1',
        project_name: 'Test Project',
        requested_by_name: 'Jane Smith',
        result: null,
        error: null,
      },
      {
        id: 'job-3',
        job_type: 'walkthrough',
        status: 'pending' as const,
        progress: 0,
        current_step: null,
        created_at: '2024-01-01T00:00:00Z',
        started_at: null,
        completed_at: null,
        elapsed_ms: null,
        project_id: 'proj-2',
        project_name: 'Another Project',
        requested_by_name: 'Bob Wilson',
        result: null,
        error: null,
      },
      {
        id: 'job-4',
        job_type: 'walkthrough',
        status: 'failed' as const,
        progress: 75,
        current_step: null,
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:01Z',
        completed_at: '2024-01-01T00:03:00Z',
        elapsed_ms: 179000,
        project_id: 'proj-1',
        project_name: 'Test Project',
        requested_by_name: 'Alice Brown',
        result: null,
        error: 'Connection timeout',
      },
    ],
    total: 4,
    stats: {
      pending: 1,
      running: 1,
      completed: 1,
      failed: 1,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobsApi.list).mockResolvedValue(mockJobs)
    vi.mocked(jobsApi.cancel).mockResolvedValue(undefined)
  })

  describe('Header', () => {
    it('renders the page header', async () => {
      render(<JobQueuePage />)

      expect(screen.getByText('Job Queue')).toBeInTheDocument()
      expect(screen.getByText('Monitor and manage running jobs')).toBeInTheDocument()
    })

    it('renders the Refresh button', async () => {
      render(<JobQueuePage />)

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })
  })

  describe('Stats Cards', () => {
    it('displays stats for each status', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
        expect(screen.getByText('Running')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
        expect(screen.getByText('Failed')).toBeInTheDocument()
      })
    })

    it('displays correct stat values', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        const statValues = screen.getAllByText('1')
        expect(statValues.length).toBeGreaterThanOrEqual(4)
      })
    })

    it('filters jobs when clicking a stat card', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Click on Pending stat card
      const pendingCard = screen.getByText('Pending').closest('div[class*="cursor-pointer"]')
      if (pendingCard) {
        await user.click(pendingCard)
      }

      await waitFor(() => {
        expect(jobsApi.list).toHaveBeenCalledWith({ status: 'pending' })
      })
    })
  })

  describe('Jobs Table', () => {
    it('displays loading state', async () => {
      vi.mocked(jobsApi.list).mockReturnValue(new Promise(() => {})) // Never resolves

      render(<JobQueuePage />)

      expect(screen.getByText('Loading jobs...')).toBeInTheDocument()
    })

    it('displays jobs in a table', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        // Multiple walkthrough jobs exist in the mock data
        const walkthroughElements = screen.getAllByText('walkthrough')
        expect(walkthroughElements.length).toBeGreaterThan(0)
        expect(screen.getByText('generate report')).toBeInTheDocument()
      })
    })

    it('displays table headers', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Type')).toBeInTheDocument()
        expect(screen.getByText('Status')).toBeInTheDocument()
        expect(screen.getByText('Progress')).toBeInTheDocument()
        expect(screen.getByText('Duration')).toBeInTheDocument()
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
      })
    })

    it('displays job status badges', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument()
        expect(screen.getByText('running')).toBeInTheDocument()
        expect(screen.getByText('pending')).toBeInTheDocument()
        expect(screen.getByText('failed')).toBeInTheDocument()
      })
    })

    it('displays progress bar for running jobs', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        const progressBars = document.querySelectorAll('[style*="width: 50%"]')
        expect(progressBars.length).toBeGreaterThan(0)
      })
    })

    it('displays current step for running jobs', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Processing screenshots')).toBeInTheDocument()
      })
    })

    it('displays "No jobs found" when list is empty', async () => {
      vi.mocked(jobsApi.list).mockResolvedValue({
        items: [],
        total: 0,
        stats: {},
      })

      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('No jobs found')).toBeInTheDocument()
      })
    })

    it('displays error message for failed jobs', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Connection timeout')).toBeInTheDocument()
      })
    })
  })

  describe('Job Actions', () => {
    it('shows cancel button for pending and running jobs', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        // Should have cancel buttons for pending and running jobs
        const cancelButtons = document.querySelectorAll('[class*="text-red-500"]')
        expect(cancelButtons.length).toBeGreaterThan(0)
      })
    })

    it('cancels a job when cancel button is clicked', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('running')).toBeInTheDocument()
      })

      // Find cancel button
      const cancelButtons = screen.getAllByRole('button').filter(
        btn => btn.querySelector('[class*="text-red-500"]')
      )

      if (cancelButtons.length > 0) {
        await user.click(cancelButtons[0])
      }

      await waitFor(() => {
        expect(jobsApi.cancel).toHaveBeenCalled()
      })
    })

    it('navigates to job detail when row is clicked', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        const walkthroughElements = screen.getAllByText('walkthrough')
        expect(walkthroughElements.length).toBeGreaterThan(0)
      })

      // Click on the first job row (first walkthrough)
      const walkthroughElements = screen.getAllByText('walkthrough')
      const jobRow = walkthroughElements[0].closest('tr')
      if (jobRow) {
        await user.click(jobRow)
      }

      expect(mockNavigate).toHaveBeenCalledWith('/jobs/job-1')
    })
  })

  describe('Filtering', () => {
    it('shows All Jobs header by default', async () => {
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('All Jobs')).toBeInTheDocument()
      })
    })

    it('shows filtered header when status filter is active', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Running')).toBeInTheDocument()
      })

      // Click on Running stat card
      const runningCard = screen.getByText('Running').closest('div[class*="cursor-pointer"]')
      if (runningCard) {
        await user.click(runningCard)
      }

      await waitFor(() => {
        expect(screen.getByText('Running Jobs')).toBeInTheDocument()
      })
    })

    it('shows Clear filter button when filter is active', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Click on Pending stat card
      const pendingCard = screen.getByText('Pending').closest('div[class*="cursor-pointer"]')
      if (pendingCard) {
        await user.click(pendingCard)
      }

      await waitFor(() => {
        expect(screen.getByText('Clear filter')).toBeInTheDocument()
      })
    })

    it('clears filter when Clear filter is clicked', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument()
      })

      // Click on Pending stat card to set filter
      const pendingCard = screen.getByText('Pending').closest('div[class*="cursor-pointer"]')
      if (pendingCard) {
        await user.click(pendingCard)
      }

      await waitFor(() => {
        expect(screen.getByText('Clear filter')).toBeInTheDocument()
      })

      // Clear the filter
      await user.click(screen.getByText('Clear filter'))

      await waitFor(() => {
        expect(screen.getByText('All Jobs')).toBeInTheDocument()
      })
    })
  })

  describe('Refresh', () => {
    it('refetches data when Refresh button is clicked', async () => {
      const user = userEvent.setup()
      render(<JobQueuePage />)

      await waitFor(() => {
        expect(screen.getByText('Job Queue')).toBeInTheDocument()
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      // Should have called list again
      await waitFor(() => {
        expect(jobsApi.list).toHaveBeenCalledTimes(2)
      })
    })
  })
})
