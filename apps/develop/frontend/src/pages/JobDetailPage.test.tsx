import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import JobDetailPage from './JobDetailPage'
import { jobsApi, projectsApi, artifactsApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  jobsApi: {
    get: vi.fn(),
  },
  projectsApi: {
    get: vi.fn(),
  },
  artifactsApi: {
    list: vi.fn(),
    download: vi.fn((id: string) => `/api/v1/artifacts/${id}/download`),
  },
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
  formatDuration: vi.fn(() => '5 minutes'),
  intervalToDuration: vi.fn(() => ({ minutes: 5, seconds: 0 })),
  format: vi.fn(() => 'Jan 1, 2024 12:00 PM'),
}))

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'job-1' }),
  }
})

describe('JobDetailPage', () => {
  const mockJob = {
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
    result: { screenshots: 5, pages_visited: 3 },
    error: null,
  }

  const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project description',
    visibility: 'private',
    site_url: 'https://example.com',
    has_credentials: true,
    is_owner: true,
    can_edit: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockArtifacts = {
    items: [
      {
        id: 'art-1',
        label: 'Walkthrough Report',
        description: 'Generated walkthrough',
        artifact_type_code: 'walkthrough',
        format: 'pdf',
        status: 'ready',
        project_id: 'proj-1',
        project_name: 'Test Project',
        job_id: 'job-1',
        created_by_name: 'John Doe',
        created_at: '2024-01-01T00:05:00Z',
      },
      {
        id: 'art-2',
        label: 'Screenshots Archive',
        description: 'All screenshots',
        artifact_type_code: 'screenshots',
        format: 'zip',
        status: 'ready',
        project_id: 'proj-1',
        project_name: 'Test Project',
        job_id: 'job-1',
        created_by_name: 'John Doe',
        created_at: '2024-01-01T00:05:00Z',
      },
    ],
    total: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jobsApi.get).mockResolvedValue(mockJob)
    vi.mocked(projectsApi.get).mockResolvedValue(mockProject)
    vi.mocked(artifactsApi.list).mockResolvedValue(mockArtifacts)
  })

  describe('Loading State', () => {
    it('displays loading state initially', async () => {
      vi.mocked(jobsApi.get).mockReturnValue(new Promise(() => {})) // Never resolves

      render(<JobDetailPage />)

      expect(screen.getByText('Loading job...')).toBeInTheDocument()
    })
  })

  describe('Not Found State', () => {
    it('displays not found message when job does not exist', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue(null as unknown as typeof mockJob)

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Job not found')).toBeInTheDocument()
      })
    })
  })

  describe('Header', () => {
    it('renders job type in header', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        // Multiple instances may exist in header and details card
        const elements = screen.getAllByText('walkthrough')
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it('renders status badge', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        // Multiple instances may exist in header badge and details
        const elements = screen.getAllByText('completed')
        expect(elements.length).toBeGreaterThan(0)
      })
    })

    it('renders back link to jobs page', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: '' })
        expect(backLink).toHaveAttribute('href', '/jobs')
      })
    })

    it('displays creation time', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText(/Created 2 hours ago/)).toBeInTheDocument()
      })
    })
  })

  describe('Job Details Card', () => {
    it('displays job details section', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Job Details')).toBeInTheDocument()
      })
    })

    it('displays job type', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        const typeLabels = screen.getAllByText('Type')
        expect(typeLabels.length).toBeGreaterThan(0)
      })
    })

    it('displays job status', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        const statusLabels = screen.getAllByText('Status')
        expect(statusLabels.length).toBeGreaterThan(0)
      })
    })

    it('displays duration', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Duration')).toBeInTheDocument()
        expect(screen.getByText('5 minutes')).toBeInTheDocument()
      })
    })

    it('displays job ID', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Job ID')).toBeInTheDocument()
        expect(screen.getByText('job-1')).toBeInTheDocument()
      })
    })

    it('displays created timestamp', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Created')).toBeInTheDocument()
      })
    })

    it('displays started timestamp', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Started')).toBeInTheDocument()
      })
    })

    it('displays completed timestamp for completed jobs', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument()
      })
    })
  })

  describe('Progress Section (Running/Pending Jobs)', () => {
    it('shows progress section for running jobs', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        status: 'running',
        progress: 50,
        current_step: 'Taking screenshots',
        completed_at: null,
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Progress')).toBeInTheDocument()
        expect(screen.getByText('Taking screenshots')).toBeInTheDocument()
        expect(screen.getByText('50%')).toBeInTheDocument()
      })
    })

    it('shows progress section for pending jobs', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        status: 'pending',
        progress: 0,
        current_step: null,
        started_at: null,
        completed_at: null,
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Progress')).toBeInTheDocument()
        expect(screen.getByText('Waiting...')).toBeInTheDocument()
      })
    })

    it('does not show progress section for completed jobs', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Progress')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Section (Failed Jobs)', () => {
    it('shows error section for failed jobs', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        status: 'failed',
        error: 'Connection timeout: Unable to reach the target URL',
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText('Connection timeout: Unable to reach the target URL')).toBeInTheDocument()
      })
    })

    it('does not show error section for successful jobs', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        // Wait for job to load
        expect(screen.getByText('Job Details')).toBeInTheDocument()
      })

      expect(screen.queryByText('Error')).not.toBeInTheDocument()
    })
  })

  describe('Result Section', () => {
    it('displays result section when job has results', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Result')).toBeInTheDocument()
      })
    })

    it('displays result data as JSON', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText(/"screenshots": 5/)).toBeInTheDocument()
        expect(screen.getByText(/"pages_visited": 3/)).toBeInTheDocument()
      })
    })

    it('does not show result section when result is empty', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        result: {},
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Job Details')).toBeInTheDocument()
      })

      expect(screen.queryByText('Result')).not.toBeInTheDocument()
    })
  })

  describe('Project Card', () => {
    it('displays project section when job has project', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Project')).toBeInTheDocument()
      })
    })

    it('displays project name', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })
    })

    it('displays project description', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('A test project description')).toBeInTheDocument()
      })
    })

    it('links to project detail page', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        const projectLink = screen.getByText('Test Project').closest('a')
        expect(projectLink).toHaveAttribute('href', '/projects/proj-1')
      })
    })

    it('does not show project section when job has no project', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        project_id: null,
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Job Details')).toBeInTheDocument()
      })

      expect(screen.queryByText('Project')).not.toBeInTheDocument()
    })
  })

  describe('Artifacts Section', () => {
    it('displays artifacts section when job has artifacts', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Artifacts')).toBeInTheDocument()
      })
    })

    it('displays artifact labels', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Walkthrough Report')).toBeInTheDocument()
        expect(screen.getByText('Screenshots Archive')).toBeInTheDocument()
      })
    })

    it('displays artifact format badges', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('PDF')).toBeInTheDocument()
        expect(screen.getByText('ZIP')).toBeInTheDocument()
      })
    })

    it('links to artifact download', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        const artifactLinks = screen.getAllByRole('link')
        const downloadLink = artifactLinks.find(link =>
          link.getAttribute('href')?.includes('/artifacts/')
        )
        expect(downloadLink).toBeDefined()
      })
    })

    it('does not show artifacts section when there are no artifacts', async () => {
      vi.mocked(artifactsApi.list).mockResolvedValue({
        items: [],
        total: 0,
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Job Details')).toBeInTheDocument()
      })

      expect(screen.queryByText('Artifacts')).not.toBeInTheDocument()
    })
  })

  describe('Status Icons', () => {
    it('displays correct icon for completed status', async () => {
      render(<JobDetailPage />)

      await waitFor(() => {
        // CheckCircle icon should be present for completed jobs
        const icons = document.querySelectorAll('.text-green-500')
        expect(icons.length).toBeGreaterThan(0)
      })
    })

    it('displays correct icon for running status', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        status: 'running',
        progress: 50,
        completed_at: null,
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        // Loader icon should be present for running jobs
        const icons = document.querySelectorAll('.text-blue-500')
        expect(icons.length).toBeGreaterThan(0)
      })
    })

    it('displays correct icon for failed status', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        status: 'failed',
        error: 'Test error',
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        // AlertCircle icon should be present for failed jobs
        const icons = document.querySelectorAll('.text-red-500')
        expect(icons.length).toBeGreaterThan(0)
      })
    })

    it('displays correct icon for pending status', async () => {
      vi.mocked(jobsApi.get).mockResolvedValue({
        ...mockJob,
        status: 'pending',
        progress: 0,
        started_at: null,
        completed_at: null,
      })

      render(<JobDetailPage />)

      await waitFor(() => {
        // Clock icon should be present for pending jobs
        const icons = document.querySelectorAll('.text-yellow-500')
        expect(icons.length).toBeGreaterThan(0)
      })
    })
  })
})
