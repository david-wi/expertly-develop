import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import { Themes } from './Themes'
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
  ],
  total: 2,
}

describe('Themes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page header', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    expect(screen.getByText('Themes')).toBeInTheDocument()
    expect(screen.getByText('Manage color themes for all Expertly applications')).toBeInTheDocument()
  })

  it('renders new theme button', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    const newButton = screen.getByText('New Theme')
    expect(newButton).toBeInTheDocument()
    expect(newButton.closest('a')).toHaveAttribute('href', '/themes/new')
  })

  it('displays loading state', () => {
    vi.mocked(themesApi.list).mockImplementation(() => new Promise(() => {}))

    render(<Themes />)

    expect(screen.getByText('Loading themes...')).toBeInTheDocument()
  })

  it('displays themes when loaded', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    await waitFor(() => {
      expect(screen.getByText('Default Theme')).toBeInTheDocument()
      expect(screen.getByText('Dark Theme')).toBeInTheDocument()
    })
  })

  it('displays error state', async () => {
    vi.mocked(themesApi.list).mockRejectedValue(new Error('API Error'))

    render(<Themes />)

    await waitFor(() => {
      expect(screen.getByText('Error loading themes')).toBeInTheDocument()
    })
  })

  it('displays empty state when no themes', async () => {
    vi.mocked(themesApi.list).mockResolvedValue({ themes: [], total: 0 })

    render(<Themes />)

    await waitFor(() => {
      expect(screen.getByText('No themes found')).toBeInTheDocument()
      expect(screen.getByText('Create First Theme')).toBeInTheDocument()
    })
  })

  it('renders filter buttons', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    expect(screen.getByText('Active Only')).toBeInTheDocument()
    expect(screen.getByText('Include Inactive')).toBeInTheDocument()
  })

  it('shows active only filter as selected by default', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    const activeButton = screen.getByText('Active Only')
    expect(activeButton.className).toContain('bg-primary-100')
  })

  it('calls API with includeInactive=false by default', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    await waitFor(() => {
      expect(themesApi.list).toHaveBeenCalledWith(false)
    })
  })

  it('switches to include inactive filter when clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    await waitFor(() => {
      expect(screen.getByText('Default Theme')).toBeInTheDocument()
    })

    const includeInactiveButton = screen.getByText('Include Inactive')
    await user.click(includeInactiveButton)

    expect(includeInactiveButton.className).toContain('bg-primary-100')
    expect(themesApi.list).toHaveBeenCalledWith(true)
  })

  it('switches back to active only filter when clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    await waitFor(() => {
      expect(screen.getByText('Default Theme')).toBeInTheDocument()
    })

    // First click include inactive
    const includeInactiveButton = screen.getByText('Include Inactive')
    await user.click(includeInactiveButton)

    // Then click active only
    const activeOnlyButton = screen.getByText('Active Only')
    await user.click(activeOnlyButton)

    expect(activeOnlyButton.className).toContain('bg-primary-100')
    expect(themesApi.list).toHaveBeenLastCalledWith(false)
  })

  it('renders create first theme link in empty state', async () => {
    vi.mocked(themesApi.list).mockResolvedValue({ themes: [], total: 0 })

    render(<Themes />)

    await waitFor(() => {
      const createLink = screen.getByText('Create First Theme').closest('a')
      expect(createLink).toHaveAttribute('href', '/themes/new')
    })
  })

  it('passes themes to ThemeList component', async () => {
    vi.mocked(themesApi.list).mockResolvedValue(mockThemesResponse)

    render(<Themes />)

    await waitFor(() => {
      // ThemeList should render theme cards with links
      const links = screen.getAllByRole('link')
      const themeLinks = links.filter(
        (link) => link.getAttribute('href')?.startsWith('/themes/') && link.getAttribute('href') !== '/themes/new'
      )
      expect(themeLinks).toHaveLength(2)
    })
  })
})
