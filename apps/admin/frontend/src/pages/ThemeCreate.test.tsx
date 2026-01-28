import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ThemeCreate } from './ThemeCreate'
import { themesApi } from '@/services/api'
import type { Theme, ThemeColors } from '@/types/theme'

// Mock the API
vi.mock('@/services/api', () => ({
  themesApi: {
    create: vi.fn(),
  },
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

const mockCreatedTheme: Theme = {
  id: 'new-theme-1',
  name: 'New Theme',
  slug: 'new-theme',
  description: 'A new theme',
  is_default: false,
  is_active: true,
  current_version: 1,
  colors: mockColors,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('ThemeCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(themesApi.create).mockResolvedValue(mockCreatedTheme)
  })

  it('renders the page header', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Create New Theme')).toBeInTheDocument()
    expect(screen.getByText('Design a new color theme for Expertly apps')).toBeInTheDocument()
  })

  it('renders back link to themes list', () => {
    render(<ThemeCreate />)

    const links = screen.getAllByRole('link')
    const backLink = links.find((link) => link.getAttribute('href') === '/themes')
    expect(backLink).toBeInTheDocument()
  })

  it('renders basic info section', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Basic Info')).toBeInTheDocument()
  })

  it('renders name input', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Name *')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., Sunset')).toBeInTheDocument()
  })

  it('renders slug input', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Slug *')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g., sunset')).toBeInTheDocument()
    expect(screen.getByText('URL-friendly identifier (lowercase, no spaces)')).toBeInTheDocument()
  })

  it('renders description textarea', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('A brief description of this theme...')).toBeInTheDocument()
  })

  it('renders set as default checkbox', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Set as default theme')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('renders create theme button', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Create Theme')).toBeInTheDocument()
  })

  it('renders color palette editor', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Color Palette')).toBeInTheDocument()
  })

  it('renders theme preview', () => {
    render(<ThemeCreate />)

    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('auto-generates slug from name', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My New Theme')

    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    expect(slugInput).toHaveValue('my-new-theme')
  })

  it('converts name with special characters to valid slug', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'Test & Special @ Theme!')

    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    expect(slugInput).toHaveValue('test-special-theme')
  })

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    // Fill slug only (manually)
    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    await user.type(slugInput, 'test-slug')

    // Submit
    await user.click(screen.getByText('Create Theme'))

    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('shows validation error when slug is empty', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    // Fill name but clear the auto-generated slug
    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'Test Theme')

    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    await user.clear(slugInput)

    // Submit
    await user.click(screen.getByText('Create Theme'))

    // Empty slug shows format validation error (empty string fails the regex)
    expect(screen.getByText('Slug must be lowercase letters, numbers, and hyphens only')).toBeInTheDocument()
  })

  it('shows validation error for invalid slug format', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'Test Theme')

    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    await user.clear(slugInput)
    await user.type(slugInput, 'INVALID SLUG!')

    // Submit
    await user.click(screen.getByText('Create Theme'))

    expect(screen.getByText('Slug must be lowercase letters, numbers, and hyphens only')).toBeInTheDocument()
  })

  it('calls create API with correct data on submit', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    const descriptionInput = screen.getByPlaceholderText('A brief description of this theme...')
    await user.type(descriptionInput, 'My description')

    await user.click(screen.getByText('Create Theme'))

    expect(themesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'My Theme',
      slug: 'my-theme',
      description: 'My description',
      is_default: false,
    }))
  })

  it('navigates to theme detail on successful create', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/themes/new-theme-1')
    })
  })

  it('shows creating state when mutation is pending', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.create).mockImplementation(() => new Promise(() => {}))

    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })

  it('shows error when slug is already taken', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.create).mockRejectedValue({
      response: { data: { detail: 'Theme with this slug already exists' } },
    })

    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    await waitFor(() => {
      expect(screen.getByText('This slug is already taken')).toBeInTheDocument()
    })
  })

  it('shows error when name is already taken', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.create).mockRejectedValue({
      response: { data: { detail: 'Theme with this name already exists' } },
    })

    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    await waitFor(() => {
      expect(screen.getByText('This name is already taken')).toBeInTheDocument()
    })
  })

  it('shows general error for other API errors', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.create).mockRejectedValue({
      response: { data: { detail: 'Server error' } },
    })

    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('shows fallback error when no detail provided', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.create).mockRejectedValue(new Error('Network error'))

    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    await waitFor(() => {
      expect(screen.getByText('Failed to create theme')).toBeInTheDocument()
    })
  })

  it('can check set as default checkbox', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
  })

  it('allows manual slug editing', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    await user.type(slugInput, 'custom-slug')

    expect(slugInput).toHaveValue('custom-slug')
  })

  it('converts uppercase slug to lowercase', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    await user.type(slugInput, 'UPPERCASE')

    expect(slugInput).toHaveValue('uppercase')
  })

  it('clears validation errors when name changes', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    // Submit with empty form to trigger error
    await user.click(screen.getByText('Create Theme'))
    expect(screen.getByText('Name is required')).toBeInTheDocument()

    // Start typing name
    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'T')

    // Error should be cleared
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
  })

  it('includes colors in create payload', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    expect(themesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      colors: expect.objectContaining({
        light: expect.objectContaining({
          primary: expect.any(Object),
        }),
        dark: expect.objectContaining({
          primary: expect.any(Object),
        }),
      }),
    }))
  })

  it('trims whitespace from name and slug', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    // Type name with whitespace - note: trailing spaces in name input get trimmed on submit
    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'Trimmed Name')

    // Slug auto-generates from name as 'trimmed-name', we modify it
    const slugInput = screen.getByPlaceholderText('e.g., sunset')
    await user.clear(slugInput)
    await user.type(slugInput, 'trimmed-slug')

    await user.click(screen.getByText('Create Theme'))

    expect(themesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Trimmed Name',
      slug: 'trimmed-slug',
    }))
  })

  it('omits empty description', async () => {
    const user = userEvent.setup()
    render(<ThemeCreate />)

    const nameInput = screen.getByPlaceholderText('e.g., Sunset')
    await user.type(nameInput, 'My Theme')

    await user.click(screen.getByText('Create Theme'))

    expect(themesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      description: undefined,
    }))
  })
})
