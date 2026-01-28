import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import { Dashboard } from './Dashboard'
import { themesApi } from '@/services/api'
import type { ThemeListResponse, ThemeColors } from '@/types/theme'

// Mock the API
vi.mock('@/services/api', () => ({
  themesApi: {
    list: vi.fn(),
  },
}))

const mockColors: ThemeColors = {
  light: {
    primary: {
      '50': '#f0f9ff',
      '100': '#e0f2fe',
      '200': '#bae6fd',
      '300': '#7dd3fc',
      '400': '#38bdf8',
      '500': '#0ea5e9',
      '600': '#0284c7',
      '700': '#0369a1',
      '800': '#075985',
      '900': '#0c4a6e',
      '950': '#082f49',
    },
    background: { default: '#fff', surface: '#f8fafc', elevated: '#f1f5f9' },
    text: { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8' },
    border: { default: '#e2e8f0', subtle: '#f1f5f9' },
  },
  dark: {
    primary: {
      '50': '#f0f9ff',
      '100': '#e0f2fe',
      '200': '#bae6fd',
      '300': '#7dd3fc',
      '400': '#38bdf8',
      '500': '#0ea5e9',
      '600': '#0284c7',
      '700': '#0369a1',
      '800': '#075985',
      '900': '#0c4a6e',
      '950': '#082f49',
    },
    background: { default: '#0f172a', surface: '#1e293b', elevated: '#334155' },
    text: { primary: '#f8fafc', secondary: '#cbd5e1', muted: '#64748b' },
    border: { default: '#334155', subtle: '#1e293b' },
  },
}

const mockThemesResponse: ThemeListResponse = {
  themes: [
    {
      id: '1',
      name: 'Default Theme',
      slug: 'default',
      description: 'The default theme',
      is_default: true,
      is_active: true,
      current_version: 1,
      colors: mockColors,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Dark Theme',
      slug: 'dark',
      description: 'A dark theme',
      is_default: false,
      is_active: true,
      current_version: 2,
      colors: mockColors,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: '3',
      name: 'Inactive Theme',
      slug: 'inactive',
      description: 'An inactive theme',
      is_default: false,
      is_active: false,
      current_version: 1,
      colors: mockColors,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    },
  ],
  total: 3,
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dashboard header', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Manage themes and configuration for all Expertly apps')).toBeInTheDocument()
  })

  it('displays loading state for stats', () => {
    vi.mocked(themesApi.list).mockImplementation(() => new Promise(() => {}))

    render(<Dashboard />)

    // Stats should show '-' while loading
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('displays active themes count', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      // 2 active themes out of 3
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('displays total themes count', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('displays stat labels', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    expect(screen.getByText('Active Themes')).toBeInTheDocument()
    expect(screen.getByText('Total Themes')).toBeInTheDocument()
    expect(screen.getByText('Public API')).toBeInTheDocument()
  })

  it('displays API status as available', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('displays quick actions section', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Create New Theme')).toBeInTheDocument()
    expect(screen.getByText('Manage Themes')).toBeInTheDocument()
  })

  it('renders create new theme link', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    const createLink = screen.getByText('Create New Theme').closest('a')
    expect(createLink).toHaveAttribute('href', '/themes/new')
  })

  it('renders manage themes link', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    const manageLink = screen.getByText('Manage Themes').closest('a')
    expect(manageLink).toHaveAttribute('href', '/themes')
  })

  it('displays recent themes section when themes exist', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Recent Themes')).toBeInTheDocument()
    })
  })

  it('displays theme names in recent themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Default Theme')).toBeInTheDocument()
      expect(screen.getByText('Dark Theme')).toBeInTheDocument()
      expect(screen.getByText('Inactive Theme')).toBeInTheDocument()
    })
  })

  it('shows default badge for default theme', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument()
    })
  })

  it('shows inactive badge for inactive themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('displays version numbers for themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      // There might be multiple v1 entries (inactive theme also has v1)
      const v1Elements = screen.getAllByText('v1')
      expect(v1Elements.length).toBeGreaterThan(0)
      expect(screen.getByText('v2')).toBeInTheDocument()
    })
  })

  it('renders view all link for recent themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      const viewAllLink = screen.getByText('View all')
      expect(viewAllLink).toHaveAttribute('href', '/themes')
    })
  })

  it('does not show recent themes section when no themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue({ themes: [], total: 0 })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Recent Themes')).not.toBeInTheDocument()
    })
  })

  it('limits recent themes to 5', async () => {
    const manyThemes: ThemeListResponse = {
      themes: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Theme ${i + 1}`,
        slug: `theme-${i + 1}`,
        description: null,
        is_default: i === 0,
        is_active: true,
        current_version: 1,
        colors: mockColors,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      })),
      total: 10,
    }
    vi.mocked(themesApi.list).mockResolvedValue(manyThemes)

    render(<Dashboard />)

    await waitFor(() => {
      // Should only show first 5 themes
      expect(screen.getByText('Theme 1')).toBeInTheDocument()
      expect(screen.getByText('Theme 5')).toBeInTheDocument()
      expect(screen.queryByText('Theme 6')).not.toBeInTheDocument()
    })
  })

  it('renders theme links in recent themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      const themeLink = screen.getByText('Default Theme').closest('a')
      expect(themeLink).toHaveAttribute('href', '/themes/1')
    })
  })

  it('calls themesApi.list with includeInactive=true', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Dashboard />)

    await waitFor(() => {
      expect(themesApi.list).toHaveBeenCalledWith(true)
    })
  })
})
