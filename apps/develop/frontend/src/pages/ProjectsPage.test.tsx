import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import ProjectsPage from './ProjectsPage'
import { projectsApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  projectsApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
}))

// Mock date-fns to have consistent output
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}))

describe('ProjectsPage', () => {
  const mockProjects = {
    items: [
      {
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
      },
      {
        id: 'proj-2',
        name: 'Team Project',
        description: 'A team project',
        visibility: 'team',
        site_url: null,
        has_credentials: false,
        is_owner: false,
        can_edit: true,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 'proj-3',
        name: 'Company Project',
        description: null,
        visibility: 'companywide',
        site_url: null,
        has_credentials: false,
        is_owner: false,
        can_edit: false,
        created_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      },
    ],
    total: 3,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.list).mockResolvedValue(mockProjects)
    vi.mocked(projectsApi.create).mockResolvedValue({
      id: 'proj-new',
      name: 'New Project',
      description: 'New project description',
      visibility: 'private',
      site_url: null,
      has_credentials: false,
      is_owner: true,
      can_edit: true,
      created_at: '2024-01-04T00:00:00Z',
      updated_at: '2024-01-04T00:00:00Z',
    })
  })

  it('renders the page header', async () => {
    render(<ProjectsPage />)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(
      screen.getByText('Manage your applications and their configurations')
    ).toBeInTheDocument()
  })

  it('renders the New Project button in header', async () => {
    render(<ProjectsPage />)

    // Wait for loading to complete first
    await waitFor(() => {
      expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
    })

    // There should be a "New Project" button in the header
    const buttons = screen.getAllByRole('button')
    const newProjectButton = buttons.find(btn => btn.textContent?.includes('New Project'))
    expect(newProjectButton).toBeDefined()
  })

  it('displays loading state initially', () => {
    vi.mocked(projectsApi.list).mockReturnValue(new Promise(() => {})) // Never resolves
    render(<ProjectsPage />)

    expect(screen.getByText('Loading projects...')).toBeInTheDocument()
  })

  it('displays projects after loading', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('Team Project')).toBeInTheDocument()
      expect(screen.getByText('Company Project')).toBeInTheDocument()
    })
  })

  it('displays project descriptions', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('A test project description')).toBeInTheDocument()
      expect(screen.getByText('A team project')).toBeInTheDocument()
    })
  })

  it('displays project site URLs', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('https://example.com')).toBeInTheDocument()
    })
  })

  it('displays visibility badges', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('private')).toBeInTheDocument()
      expect(screen.getByText('team')).toBeInTheDocument()
      expect(screen.getByText('companywide')).toBeInTheDocument()
    })
  })

  it('displays credentials badge for projects with credentials', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      expect(screen.getByText('Credentials')).toBeInTheDocument()
    })
  })

  it('displays empty state when no projects exist', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue({ items: [], total: 0 })

    render(<ProjectsPage />)

    await waitFor(() => {
      expect(
        screen.getByText('No projects yet. Create your first project to get started.')
      ).toBeInTheDocument()
    })
  })

  it('displays Create Project button in empty state', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue({ items: [], total: 0 })

    render(<ProjectsPage />)

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create project/i })
      expect(createButton).toBeInTheDocument()
    })
  })

  it('links to project detail page', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      const projectLink = screen.getByText('Test Project').closest('a')
      expect(projectLink).toHaveAttribute('href', '/projects/proj-1')
    })
  })

  it('fetches projects on mount', async () => {
    render(<ProjectsPage />)

    await waitFor(() => {
      expect(projectsApi.list).toHaveBeenCalled()
    })
  })

  describe('Create Project Modal', () => {
    it('opens modal when New Project button is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
      })

      // Find and click the New Project button
      const buttons = screen.getAllByRole('button')
      const newProjectButton = buttons.find(btn => btn.textContent?.includes('New Project'))
      if (newProjectButton) {
        await user.click(newProjectButton)
      }

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument()
      })
    })

    it('displays form fields in modal', async () => {
      const user = userEvent.setup()
      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
      })

      const buttons = screen.getAllByRole('button')
      const newProjectButton = buttons.find(btn => btn.textContent?.includes('New Project'))
      if (newProjectButton) {
        await user.click(newProjectButton)
      }

      await waitFor(() => {
        expect(screen.getByText('Project Name')).toBeInTheDocument()
        expect(screen.getByText('Description')).toBeInTheDocument()
        expect(screen.getByText('Site URL')).toBeInTheDocument()
        expect(screen.getByText('Visibility')).toBeInTheDocument()
      })
    })

    it('closes modal when Cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
      })

      const buttons = screen.getAllByRole('button')
      const newProjectButton = buttons.find(btn => btn.textContent?.includes('New Project'))
      if (newProjectButton) {
        await user.click(newProjectButton)
      }

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Create Project' })).not.toBeInTheDocument()
      })
    })

    it('submits form with entered data', async () => {
      const user = userEvent.setup()
      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
      })

      const buttons = screen.getAllByRole('button')
      const newProjectButton = buttons.find(btn => btn.textContent?.includes('New Project'))
      if (newProjectButton) {
        await user.click(newProjectButton)
      }

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument()
      })

      // Fill in the form
      const nameInput = screen.getByPlaceholderText('My Application')
      const descriptionInput = screen.getByPlaceholderText('Brief description of the project...')
      const urlInput = screen.getByPlaceholderText('https://example.com')

      await user.type(nameInput, 'New Test Project')
      await user.type(descriptionInput, 'A new test project')
      await user.type(urlInput, 'https://test.com')

      // Find the submit button by looking at all buttons in the form
      const form = screen.getByRole('heading', { name: 'Create Project' }).parentElement!
      const formButtons = form.querySelectorAll('button[type="submit"]')
      const submitButton = formButtons[0] as HTMLButtonElement

      if (submitButton) {
        await user.click(submitButton)
      }

      await waitFor(() => {
        expect(projectsApi.create).toHaveBeenCalled()
        const callArg = vi.mocked(projectsApi.create).mock.calls[0][0]
        expect(callArg).toEqual({
          name: 'New Test Project',
          description: 'A new test project',
          site_url: 'https://test.com',
          visibility: 'private',
        })
      })
    })

    it('displays visibility options', async () => {
      const user = userEvent.setup()
      render(<ProjectsPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading projects...')).not.toBeInTheDocument()
      })

      const buttons = screen.getAllByRole('button')
      const newProjectButton = buttons.find(btn => btn.textContent?.includes('New Project'))
      if (newProjectButton) {
        await user.click(newProjectButton)
      }

      await waitFor(() => {
        expect(screen.getByText('Private - Only you')).toBeInTheDocument()
        expect(screen.getByText('Team - Your team members')).toBeInTheDocument()
        expect(screen.getByText('Company - Everyone in organization')).toBeInTheDocument()
      })
    })
  })
})
