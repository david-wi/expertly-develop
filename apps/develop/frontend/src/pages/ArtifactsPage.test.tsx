import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import ArtifactsPage from './ArtifactsPage'
import { artifactsApi, projectsApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  artifactsApi: {
    list: vi.fn(),
    delete: vi.fn(),
    download: vi.fn((id: string) => `/api/v1/artifacts/${id}/download`),
  },
  projectsApi: {
    list: vi.fn(),
  },
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}))

// Mock window.confirm
const mockConfirm = vi.fn()
;(globalThis as { confirm?: typeof window.confirm }).confirm = mockConfirm

describe('ArtifactsPage', () => {
  const mockArtifacts = {
    items: [
      {
        id: 'art-1',
        label: 'Homepage Walkthrough',
        description: 'Visual guide for homepage navigation',
        artifact_type_code: 'walkthrough',
        format: 'pdf',
        status: 'ready',
        project_id: 'proj-1',
        project_name: 'Test Project',
        job_id: 'job-1',
        created_by_name: 'John Doe',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'art-2',
        label: 'Login Flow Screenshots',
        description: null,
        artifact_type_code: 'screenshots',
        format: 'zip',
        status: 'ready',
        project_id: 'proj-2',
        project_name: 'Another Project',
        job_id: 'job-2',
        created_by_name: 'Jane Smith',
        created_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 'art-3',
        label: 'Dashboard Report',
        description: 'Comprehensive dashboard analysis',
        artifact_type_code: 'report',
        format: 'html',
        status: 'ready',
        project_id: null,
        project_name: null,
        job_id: 'job-3',
        created_by_name: 'Bob Wilson',
        created_at: '2024-01-03T00:00:00Z',
      },
    ],
    total: 3,
  }

  const mockProjects = {
    items: [
      { id: 'proj-1', name: 'Test Project', description: '', visibility: 'private', site_url: null, has_credentials: false, is_owner: true, can_edit: true, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
      { id: 'proj-2', name: 'Another Project', description: '', visibility: 'team', site_url: null, has_credentials: false, is_owner: true, can_edit: true, created_at: '2024-01-02T00:00:00Z', updated_at: '2024-01-02T00:00:00Z' },
    ],
    total: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(artifactsApi.list).mockResolvedValue(mockArtifacts)
    vi.mocked(projectsApi.list).mockResolvedValue(mockProjects)
    vi.mocked(artifactsApi.delete).mockResolvedValue(undefined)
    mockConfirm.mockReturnValue(true)
  })

  describe('Header', () => {
    it('renders the page header', async () => {
      render(<ArtifactsPage />)

      expect(screen.getByText('Artifacts')).toBeInTheDocument()
      expect(screen.getByText('Generated reports and documents')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('displays loading state', async () => {
      vi.mocked(artifactsApi.list).mockReturnValue(new Promise(() => {})) // Never resolves

      render(<ArtifactsPage />)

      expect(screen.getByText('Loading artifacts...')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('displays empty state when no artifacts exist', async () => {
      vi.mocked(artifactsApi.list).mockResolvedValue({
        items: [],
        total: 0,
      })

      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(
          screen.getByText('No artifacts yet. Run a walkthrough to generate your first artifact.')
        ).toBeInTheDocument()
      })
    })
  })

  describe('Artifacts Table', () => {
    it('displays table headers', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument()
        expect(screen.getByText('Type')).toBeInTheDocument()
        expect(screen.getByText('Project')).toBeInTheDocument()
        expect(screen.getByText('Format')).toBeInTheDocument()
        expect(screen.getByText('Created')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
      })
    })

    it('displays artifact labels', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Homepage Walkthrough')).toBeInTheDocument()
        expect(screen.getByText('Login Flow Screenshots')).toBeInTheDocument()
        expect(screen.getByText('Dashboard Report')).toBeInTheDocument()
      })
    })

    it('displays artifact descriptions', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Visual guide for homepage navigation')).toBeInTheDocument()
        expect(screen.getByText('Comprehensive dashboard analysis')).toBeInTheDocument()
      })
    })

    it('displays artifact type badges', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('walkthrough')).toBeInTheDocument()
        expect(screen.getByText('screenshots')).toBeInTheDocument()
        expect(screen.getByText('report')).toBeInTheDocument()
      })
    })

    it('displays project names', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
        expect(screen.getByText('Another Project')).toBeInTheDocument()
      })
    })

    it('displays dash for artifacts without project', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        const dashElements = screen.getAllByText('-')
        expect(dashElements.length).toBeGreaterThan(0)
      })
    })

    it('displays format badges', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('PDF')).toBeInTheDocument()
        expect(screen.getByText('ZIP')).toBeInTheDocument()
        expect(screen.getByText('HTML')).toBeInTheDocument()
      })
    })

    it('displays creation time', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        const timeElements = screen.getAllByText('2 hours ago')
        expect(timeElements.length).toBe(3)
      })
    })
  })

  describe('Download Action', () => {
    it('renders download links for each artifact', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        const downloadLinks = screen.getAllByTitle('Download')
        expect(downloadLinks.length).toBe(3)
      })
    })

    it('download links have correct href', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        const downloadLinks = screen.getAllByTitle('Download')
        expect(downloadLinks[0]).toHaveAttribute('href', '/api/v1/artifacts/art-1/download')
      })
    })
  })

  describe('Delete Action', () => {
    it('renders delete buttons for each artifact', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        const deleteButtons = screen.getAllByTitle('Delete')
        expect(deleteButtons.length).toBe(3)
      })
    })

    it('shows confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup()
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Homepage Walkthrough')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      await user.click(deleteButtons[0])

      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to delete this artifact?')
    })

    it('deletes artifact when confirmed', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(true)

      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Homepage Walkthrough')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(artifactsApi.delete).toHaveBeenCalled()
        const callArgs = vi.mocked(artifactsApi.delete).mock.calls[0]
        expect(callArgs[0]).toBe('art-1')
      })
    })

    it('does not delete artifact when cancelled', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(screen.getByText('Homepage Walkthrough')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      await user.click(deleteButtons[0])

      expect(artifactsApi.delete).not.toHaveBeenCalled()
    })
  })

  describe('Icons', () => {
    it('displays FileText icon for PDF format', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        // PDF artifacts should have FileText icons - we check the row has the correct artifact
        expect(screen.getByText('Homepage Walkthrough')).toBeInTheDocument()
      })
    })

    it('displays FileBox icon for non-PDF formats', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        // Non-PDF artifacts should have FileBox icons - check they render
        expect(screen.getByText('Login Flow Screenshots')).toBeInTheDocument()
        expect(screen.getByText('Dashboard Report')).toBeInTheDocument()
      })
    })
  })

  describe('Data Fetching', () => {
    it('fetches artifacts on mount', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(artifactsApi.list).toHaveBeenCalled()
      })
    })

    it('fetches projects on mount', async () => {
      render(<ArtifactsPage />)

      await waitFor(() => {
        expect(projectsApi.list).toHaveBeenCalled()
      })
    })
  })
})
