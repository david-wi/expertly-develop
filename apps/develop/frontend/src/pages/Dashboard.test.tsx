import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '../test/test-utils'
import Dashboard from './Dashboard'
import { projectsApi, jobsApi, artifactsApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  projectsApi: {
    list: vi.fn(),
  },
  jobsApi: {
    list: vi.fn(),
  },
  artifactsApi: {
    list: vi.fn(),
    download: vi.fn((id: string) => `/api/v1/artifacts/${id}/download`),
  },
}))

// Mock date-fns to have consistent output
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}))

describe('Dashboard', () => {
  const mockProjects = {
    items: [
      {
        id: 'proj-1',
        name: 'Test Project',
        description: 'A test project',
        visibility: 'private',
        site_url: null,
        has_credentials: false,
        is_owner: true,
        can_edit: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 1,
  }

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
        completed_at: '2024-01-01T00:00:30Z',
        elapsed_ms: 29000,
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
        current_step: 'Processing',
        created_at: '2024-01-01T00:00:00Z',
        started_at: '2024-01-01T00:00:01Z',
        completed_at: null,
        elapsed_ms: null,
        project_id: 'proj-1',
        project_name: 'Test Project',
        requested_by_name: 'Jane Smith',
        result: null,
        error: null,
      },
    ],
    total: 2,
    stats: { completed: 1, running: 1, pending: 0 },
  }

  const mockArtifacts = {
    items: [
      {
        id: 'art-1',
        label: 'Walkthrough Report',
        description: 'A walkthrough report',
        artifact_type_code: 'walkthrough',
        format: 'pdf',
        status: 'ready',
        project_id: 'proj-1',
        project_name: 'Test Project',
        job_id: 'job-1',
        created_by_name: 'John Doe',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.list).mockResolvedValue(mockProjects)
    vi.mocked(jobsApi.list).mockResolvedValue(mockJobs)
    vi.mocked(artifactsApi.list).mockResolvedValue(mockArtifacts)
  })

  it('renders the dashboard header', async () => {
    render(<Dashboard />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Welcome back, David')).toBeInTheDocument()
  })

  it('renders the New Walkthrough button', async () => {
    render(<Dashboard />)

    const newWalkthroughLink = screen.getByRole('link', { name: /new walkthrough/i })
    expect(newWalkthroughLink).toBeInTheDocument()
    expect(newWalkthroughLink).toHaveAttribute('href', '/walkthroughs/new')
  })

  it('displays stats cards', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Active Jobs')).toBeInTheDocument()
      expect(screen.getByText('Artifacts')).toBeInTheDocument()
    })
  })

  it('displays recent jobs section header', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument()
    })
  })

  it('displays job types in recent jobs list', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('walkthrough')).toBeInTheDocument()
      expect(screen.getByText('generate report')).toBeInTheDocument()
    })
  })

  it('displays recent artifacts section header', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Recent Artifacts')).toBeInTheDocument()
    })
  })

  it('displays artifact labels', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Walkthrough Report')).toBeInTheDocument()
    })
  })

  it('displays "No jobs yet" when there are no jobs', async () => {
    vi.mocked(jobsApi.list).mockResolvedValue({
      items: [],
      total: 0,
      stats: {},
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('No jobs yet')).toBeInTheDocument()
    })
  })

  it('displays "No artifacts yet" when there are no artifacts', async () => {
    vi.mocked(artifactsApi.list).mockResolvedValue({
      items: [],
      total: 0,
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('No artifacts yet')).toBeInTheDocument()
    })
  })

  it('displays job status badges', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('running')).toBeInTheDocument()
    })
  })

  it('displays artifact format badges', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('PDF')).toBeInTheDocument()
    })
  })

  it('displays progress bar for running jobs', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      // Find the progress bar by its style
      const progressBars = document.querySelectorAll('[style*="width: 50%"]')
      expect(progressBars.length).toBeGreaterThan(0)
    })
  })

  it('has View all links for jobs and artifacts', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      const viewAllLinks = screen.getAllByText('View all')
      expect(viewAllLinks.length).toBe(2)
    })
  })

  it('links to jobs page from View all', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      const recentJobsSection = screen.getByText('Recent Jobs').closest('div')
      if (recentJobsSection) {
        const viewAllLink = within(recentJobsSection).getByText('View all').closest('a')
        expect(viewAllLink).toHaveAttribute('href', '/jobs')
      }
    })
  })

  it('links to artifacts page from View all', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      const recentArtifactsSection = screen.getByText('Recent Artifacts').closest('div')
      if (recentArtifactsSection) {
        const viewAllLink = within(recentArtifactsSection).getByText('View all').closest('a')
        expect(viewAllLink).toHaveAttribute('href', '/artifacts')
      }
    })
  })

  it('links to individual job details', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      const jobLink = screen.getByText('walkthrough').closest('a')
      expect(jobLink).toHaveAttribute('href', '/jobs/job-1')
    })
  })

  it('fetches data on mount', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(projectsApi.list).toHaveBeenCalled()
      expect(jobsApi.list).toHaveBeenCalled()
      expect(artifactsApi.list).toHaveBeenCalled()
    })
  })

  it('displays requester name in job list', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      const elements = screen.getAllByText(/John Doe/)
      expect(elements.length).toBeGreaterThan(0)
    })
  })
})
