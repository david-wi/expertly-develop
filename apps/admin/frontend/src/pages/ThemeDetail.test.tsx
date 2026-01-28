import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ThemeDetail } from './ThemeDetail'
import { themesApi } from '@/services/api'
import type { Theme, ThemeColors, ThemeVersionListResponse } from '@/types/theme'

// Mock the API
vi.mock('@/services/api', () => ({
  themesApi: {
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getVersions: vi.fn(),
    restoreVersion: vi.fn(),
  },
}))

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'theme-1' }),
    useNavigate: () => vi.fn(),
  }
})

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

const mockTheme: Theme = {
  id: 'theme-1',
  name: 'Test Theme',
  slug: 'test-theme',
  description: 'A test theme description',
  is_default: false,
  is_active: true,
  current_version: 3,
  colors: mockColors,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockVersionsResponse: ThemeVersionListResponse = {
  versions: [
    {
      id: 'v3',
      version_number: 3,
      snapshot: mockColors,
      change_summary: 'Latest changes',
      changed_by: 'admin',
      changed_at: '2024-01-03T00:00:00Z',
      status: 'active',
    },
  ],
  total: 1,
}

describe('ThemeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(themesApi.get).mockResolvedValue(mockTheme)
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)
  })

  it('renders loading state initially', () => {
    vi.mocked(themesApi.get).mockImplementation(() => new Promise(() => {}))

    render(<ThemeDetail />)

    expect(screen.getByText('Loading theme...')).toBeInTheDocument()
  })

  it('renders theme name when loaded', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })
  })

  it('renders theme version and slug', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Version 3 - test-theme')).toBeInTheDocument()
    })
  })

  it('renders back link to themes list', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: '' })
      expect(backLink).toHaveAttribute('href', '/themes')
    })
  })

  it('renders delete button', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  it('renders save changes button', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  it('save button is disabled by default (no changes)', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes').closest('button')
      expect(saveButton).toBeDisabled()
    })
  })

  it('renders basic info section', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Basic Info')).toBeInTheDocument()
    })
  })

  it('renders name input with theme name', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      const nameInputs = screen.getAllByRole('textbox')
      // First textbox should be the name input
      expect(nameInputs[0]).toHaveValue('Test Theme')
    })
  })

  it('renders description textarea', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Description')).toBeInTheDocument()
    })
  })

  it('renders change summary input', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Change Summary')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Describe your changes...')).toBeInTheDocument()
    })
  })

  it('enables save button when name is changed', async () => {
    const user = userEvent.setup()
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })

    const nameInputs = screen.getAllByRole('textbox')
    await user.clear(nameInputs[0])
    await user.type(nameInputs[0], 'Updated Theme')

    const saveButton = screen.getByText('Save Changes').closest('button')
    expect(saveButton).not.toBeDisabled()
  })

  it('shows default theme badge when theme is default', async () => {
    vi.mocked(themesApi.get).mockResolvedValue({ ...mockTheme, is_default: true })

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Default Theme')).toBeInTheDocument()
    })
  })

  it('shows inactive badge when theme is inactive', async () => {
    vi.mocked(themesApi.get).mockResolvedValue({ ...mockTheme, is_active: false })

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('renders color palette editor', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Color Palette')).toBeInTheDocument()
    })
  })

  it('renders theme preview', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument()
    })
  })

  it('renders version history', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Version History')).toBeInTheDocument()
    })
  })

  it('renders error state when theme not found', async () => {
    vi.mocked(themesApi.get).mockRejectedValue(new Error('Not found'))

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Theme not found')).toBeInTheDocument()
      expect(screen.getByText('Back to themes')).toBeInTheDocument()
    })
  })

  it('calls update API when save is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.update).mockResolvedValue(mockTheme)

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })

    // Change the name to enable save
    const nameInputs = screen.getAllByRole('textbox')
    await user.clear(nameInputs[0])
    await user.type(nameInputs[0], 'Updated Theme')

    // Click save
    await user.click(screen.getByText('Save Changes'))

    expect(themesApi.update).toHaveBeenCalledWith('theme-1', expect.objectContaining({
      name: 'Updated Theme',
    }))
  })

  it('calls delete API when delete is confirmed', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.delete).mockResolvedValue()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Delete'))

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this theme? This will deactivate it.')
    expect(themesApi.delete).toHaveBeenCalledWith('theme-1')

    confirmSpy.mockRestore()
  })

  it('does not call delete API when delete is cancelled', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Delete'))

    expect(confirmSpy).toHaveBeenCalled()
    expect(themesApi.delete).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('shows saving state when update is pending', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.update).mockImplementation(() => new Promise(() => {}))

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })

    // Change the name to enable save
    const nameInputs = screen.getAllByRole('textbox')
    await user.clear(nameInputs[0])
    await user.type(nameInputs[0], 'Updated Theme')

    // Click save
    await user.click(screen.getByText('Save Changes'))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  it('calls themesApi.get with correct id', async () => {
    render(<ThemeDetail />)

    await waitFor(() => {
      expect(themesApi.get).toHaveBeenCalledWith('theme-1')
    })
  })

  it('handles theme without description', async () => {
    vi.mocked(themesApi.get).mockResolvedValue({ ...mockTheme, description: null })

    render(<ThemeDetail />)

    await waitFor(() => {
      expect(screen.getByText('Test Theme')).toBeInTheDocument()
    })
  })
})
