import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import Dashboard from './Dashboard'

// Mock the API
vi.mock('../api/client', () => ({
  projectsApi: {
    list: vi.fn(),
  },
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'dashboard.welcome': 'Welcome',
        'dashboard.subtitle': 'Your testing dashboard',
        'dashboard.startQuickTest': 'Quick Test',
        'dashboard.createProject': 'Create Project',
        'dashboard.viewAllProjects': 'View Projects',
        'dashboard.recentProjects': 'Recent Projects',
        'dashboard.noProjects': 'No projects yet',
      }
      return translations[key] || key
    },
  }),
}))

describe('Dashboard', () => {
  it('renders welcome message', async () => {
    const { projectsApi } = await import('../api/client')
    vi.mocked(projectsApi.list).mockResolvedValue([])

    render(<Dashboard />)

    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Your testing dashboard')).toBeInTheDocument()
  })

  it('shows quick action cards', async () => {
    const { projectsApi } = await import('../api/client')
    vi.mocked(projectsApi.list).mockResolvedValue([])

    render(<Dashboard />)

    expect(screen.getByText('Quick Test')).toBeInTheDocument()
    expect(screen.getByText('Create Project')).toBeInTheDocument()
    expect(screen.getByText('View Projects')).toBeInTheDocument()
  })

  it('links to quick-start page', async () => {
    const { projectsApi } = await import('../api/client')
    vi.mocked(projectsApi.list).mockResolvedValue([])

    render(<Dashboard />)

    const quickStartLink = screen.getByRole('link', { name: /quick test/i })
    expect(quickStartLink).toHaveAttribute('href', '/quick-start')
  })

  it('links to projects page', async () => {
    const { projectsApi } = await import('../api/client')
    vi.mocked(projectsApi.list).mockResolvedValue([])

    render(<Dashboard />)

    const projectLinks = screen.getAllByRole('link', { name: /project/i })
    const hasProjectsLink = projectLinks.some((link) => link.getAttribute('href') === '/projects')
    expect(hasProjectsLink).toBe(true)
  })

  it('displays projects when loaded', async () => {
    const { projectsApi } = await import('../api/client')
    vi.mocked(projectsApi.list).mockResolvedValue([
      {
        id: '1',
        name: 'Test Project 1',
        base_url: 'https://example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'Test Project 2',
        base_url: 'https://example2.com',
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ])

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
    })
    expect(screen.getByText('Test Project 2')).toBeInTheDocument()
  })

  it('handles loading state', async () => {
    const { projectsApi } = await import('../api/client')

    // Create a promise that never resolves to simulate loading
    vi.mocked(projectsApi.list).mockImplementation(() => new Promise(() => {}))

    render(<Dashboard />)

    // The welcome message should still be visible during loading
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })
})
