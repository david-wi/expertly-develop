import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import ProjectDetailPage from './ProjectDetailPage'
import { projectsApi, artifactsApi, jobsApi, personasApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  projectsApi: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  artifactsApi: {
    list: vi.fn(),
    download: vi.fn((id: string) => `/api/v1/artifacts/${id}/download`),
  },
  jobsApi: {
    list: vi.fn(),
  },
  personasApi: {
    list: vi.fn(),
  },
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}))

// Mock useNavigate and useParams
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'proj-1' }),
  }
})

describe('ProjectDetailPage', () => {
  const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A comprehensive test project for walkthroughs',
    visibility: 'private',
    site_url: 'https://example.com',
    has_credentials: true,
    is_owner: true,
    can_edit: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
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
        current_step: 'Processing',
        created_at: '2024-01-02T00:00:00Z',
        started_at: '2024-01-02T00:00:01Z',
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
    stats: { completed: 1, running: 1 },
  }

  const mockArtifacts = {
    items: [
      {
        id: 'art-1',
        label: 'Homepage Walkthrough',
        description: 'Visual guide',
        artifact_type_code: 'walkthrough',
        format: 'pdf',
        status: 'ready',
        project_id: 'proj-1',
        project_name: 'Test Project',
        job_id: 'job-1',
        created_by_name: 'John Doe',
        created_at: '2024-01-01T00:05:00Z',
      },
    ],
    total: 1,
  }

  const mockPersonas = {
    items: [
      {
        id: 'pers-1',
        project_id: 'proj-1',
        name: 'Admin User',
        role_description: 'Administrator with full access',
        goals: ['Manage system'],
        task_types: ['admin'],
        has_credentials: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'pers-2',
        project_id: 'proj-1',
        name: 'Regular User',
        role_description: 'Standard user',
        goals: ['Use features'],
        task_types: ['user'],
        has_credentials: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.get).mockResolvedValue(mockProject)
    vi.mocked(projectsApi.delete).mockResolvedValue(undefined)
    vi.mocked(jobsApi.list).mockResolvedValue(mockJobs)
    vi.mocked(artifactsApi.list).mockResolvedValue(mockArtifacts)
    vi.mocked(personasApi.list).mockResolvedValue(mockPersonas)
  })

  describe('Loading State', () => {
    it('displays loading state initially', async () => {
      vi.mocked(projectsApi.get).mockReturnValue(new Promise(() => {})) // Never resolves

      render(<ProjectDetailPage />)

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })
  })

  describe('Not Found State', () => {
    it('displays not found message when project does not exist', async () => {
      vi.mocked(projectsApi.get).mockResolvedValue(null as unknown as typeof mockProject)

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Project not found')).toBeInTheDocument()
      })
    })
  })

  describe('Header', () => {
    it('renders project name', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })
    })

    it('renders project description', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('A comprehensive test project for walkthroughs')).toBeInTheDocument()
      })
    })

    it('renders back link to projects page', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        const backLink = screen.getByRole('link', { name: '' })
        expect(backLink).toHaveAttribute('href', '/projects')
      })
    })

    it('renders Run Walkthrough button', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /run walkthrough/i })).toBeInTheDocument()
      })
    })

    it('Run Walkthrough links to new walkthrough page with project param', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        const runButton = screen.getByRole('link', { name: /run walkthrough/i })
        expect(runButton).toHaveAttribute('href', '/walkthroughs/new?project=proj-1')
      })
    })

    it('renders Delete button when user can edit', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })
    })

    it('does not render Delete button when user cannot edit', async () => {
      vi.mocked(projectsApi.get).mockResolvedValue({
        ...mockProject,
        can_edit: false,
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    })

    it('renders visibility icon', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        // Private project should have Lock icon
        const icons = document.querySelectorAll('.text-theme-text-muted')
        expect(icons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Project Details Card', () => {
    it('displays project details section', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Project Details')).toBeInTheDocument()
      })
    })

    it('displays visibility', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Visibility')).toBeInTheDocument()
        expect(screen.getByText('private')).toBeInTheDocument()
      })
    })

    it('displays credentials status', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Credentials')).toBeInTheDocument()
        expect(screen.getByText('Configured')).toBeInTheDocument()
      })
    })

    it('displays "Not set" when no credentials', async () => {
      vi.mocked(projectsApi.get).mockResolvedValue({
        ...mockProject,
        has_credentials: false,
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Not set')).toBeInTheDocument()
      })
    })

    it('displays site URL with external link', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Site URL')).toBeInTheDocument()
        const urlLink = screen.getByText('https://example.com')
        expect(urlLink).toHaveAttribute('href', 'https://example.com')
        expect(urlLink).toHaveAttribute('target', '_blank')
      })
    })

    it('displays creation time', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText(/Created 2 hours ago/)).toBeInTheDocument()
      })
    })
  })

  describe('Recent Jobs Card', () => {
    it('displays recent jobs section', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Recent Jobs')).toBeInTheDocument()
      })
    })

    it('displays job types', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('walkthrough')).toBeInTheDocument()
        expect(screen.getByText('generate report')).toBeInTheDocument()
      })
    })

    it('displays job status badges', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument()
        expect(screen.getByText('running')).toBeInTheDocument()
      })
    })

    it('links to job detail pages', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        const jobLink = screen.getByText('walkthrough').closest('a')
        expect(jobLink).toHaveAttribute('href', '/jobs/job-1')
      })
    })

    it('displays "No jobs yet" when no jobs exist', async () => {
      vi.mocked(jobsApi.list).mockResolvedValue({
        items: [],
        total: 0,
        stats: {},
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('No jobs yet')).toBeInTheDocument()
      })
    })
  })

  describe('Personas Card', () => {
    it('displays personas section', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Personas')).toBeInTheDocument()
      })
    })

    it('displays persona names', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.getByText('Regular User')).toBeInTheDocument()
      })
    })

    it('displays persona role descriptions', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Administrator with full access')).toBeInTheDocument()
        expect(screen.getByText('Standard user')).toBeInTheDocument()
      })
    })

    it('displays Auth badge for personas with credentials', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Auth')).toBeInTheDocument()
      })
    })

    it('displays "No personas configured" when no personas exist', async () => {
      vi.mocked(personasApi.list).mockResolvedValue({
        items: [],
        total: 0,
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('No personas configured')).toBeInTheDocument()
      })
    })
  })

  describe('Artifacts Card', () => {
    it('displays artifacts section', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Artifacts')).toBeInTheDocument()
      })
    })

    it('displays artifact labels', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Homepage Walkthrough')).toBeInTheDocument()
      })
    })

    it('links to artifact download', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        const artifactLink = screen.getByText('Homepage Walkthrough').closest('a')
        expect(artifactLink).toHaveAttribute('href', '/api/v1/artifacts/art-1/download')
      })
    })

    it('displays "No artifacts yet" when no artifacts exist', async () => {
      vi.mocked(artifactsApi.list).mockResolvedValue({
        items: [],
        total: 0,
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('No artifacts yet')).toBeInTheDocument()
      })
    })
  })

  describe('Delete Modal', () => {
    it('shows delete confirmation modal when Delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })
    })

    it('displays project name in confirmation modal', async () => {
      const user = userEvent.setup()
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
        expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
      })
    })

    it('closes modal when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Project' })).not.toBeInTheDocument()
      })
    })

    it('closes modal when overlay is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })

      // Click the overlay (the element with bg-black/50)
      const overlay = document.querySelector('.bg-black\\/50')
      if (overlay) {
        await user.click(overlay)
      }

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Project' })).not.toBeInTheDocument()
      })
    })

    it('deletes project when Delete Project button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete project/i }))

      await waitFor(() => {
        expect(projectsApi.delete).toHaveBeenCalledWith('proj-1')
      })
    })

    it('navigates to projects page after successful deletion', async () => {
      const user = userEvent.setup()
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete project/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/projects')
      })
    })

    it('shows loading state during deletion', async () => {
      const user = userEvent.setup()
      vi.mocked(projectsApi.delete).mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete project/i }))

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })
    })

    it('displays error message on deletion failure', async () => {
      const user = userEvent.setup()
      vi.mocked(projectsApi.delete).mockRejectedValue(new Error('Permission denied'))

      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Delete Project' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /delete project/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to delete project. You may not have permission.')).toBeInTheDocument()
      })
    })
  })

  describe('Visibility Icons', () => {
    it('displays Lock icon for private projects', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        // We can verify by checking the title attribute on the icon container
        const iconContainer = screen.getByTitle('Private - Only you can see this project')
        expect(iconContainer).toBeInTheDocument()
      })
    })

    it('displays Users icon for team projects', async () => {
      vi.mocked(projectsApi.get).mockResolvedValue({
        ...mockProject,
        visibility: 'team',
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        const iconContainer = screen.getByTitle('Team - Visible to your team members')
        expect(iconContainer).toBeInTheDocument()
      })
    })

    it('displays Globe icon for companywide projects', async () => {
      vi.mocked(projectsApi.get).mockResolvedValue({
        ...mockProject,
        visibility: 'companywide',
      })

      render(<ProjectDetailPage />)

      await waitFor(() => {
        const iconContainer = screen.getByTitle('Company-wide - Visible to everyone in the organization')
        expect(iconContainer).toBeInTheDocument()
      })
    })
  })

  describe('Data Fetching', () => {
    it('fetches project on mount', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(projectsApi.get).toHaveBeenCalledWith('proj-1')
      })
    })

    it('fetches jobs for the project', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(jobsApi.list).toHaveBeenCalledWith({ project_id: 'proj-1' })
      })
    })

    it('fetches artifacts for the project', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(artifactsApi.list).toHaveBeenCalledWith({ project_id: 'proj-1' })
      })
    })

    it('fetches personas for the project', async () => {
      render(<ProjectDetailPage />)

      await waitFor(() => {
        expect(personasApi.list).toHaveBeenCalledWith('proj-1')
      })
    })
  })
})
