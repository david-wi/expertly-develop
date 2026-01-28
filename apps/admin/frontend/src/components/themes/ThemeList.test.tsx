import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { ThemeList } from './ThemeList'
import type { Theme, ThemeColors } from '@/types/theme'

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
    background: {
      default: '#ffffff',
      surface: '#f8fafc',
      elevated: '#f1f5f9',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      muted: '#94a3b8',
    },
    border: {
      default: '#e2e8f0',
      subtle: '#f1f5f9',
    },
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
    background: {
      default: '#0f172a',
      surface: '#1e293b',
      elevated: '#334155',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      muted: '#64748b',
    },
    border: {
      default: '#334155',
      subtle: '#1e293b',
    },
  },
}

const createMockTheme = (overrides: Partial<Theme> = {}): Theme => ({
  id: '1',
  name: 'Test Theme',
  slug: 'test-theme',
  description: 'A test theme description',
  is_default: false,
  is_active: true,
  current_version: 1,
  colors: mockColors,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('ThemeList', () => {
  it('renders a list of themes', () => {
    const themes = [
      createMockTheme({ id: '1', name: 'Theme One', slug: 'theme-one' }),
      createMockTheme({ id: '2', name: 'Theme Two', slug: 'theme-two' }),
      createMockTheme({ id: '3', name: 'Theme Three', slug: 'theme-three' }),
    ]

    render(<ThemeList themes={themes} />)

    expect(screen.getByText('Theme One')).toBeInTheDocument()
    expect(screen.getByText('Theme Two')).toBeInTheDocument()
    expect(screen.getByText('Theme Three')).toBeInTheDocument()
  })

  it('displays theme slugs', () => {
    const themes = [createMockTheme({ slug: 'custom-slug' })]

    render(<ThemeList themes={themes} />)

    expect(screen.getByText('custom-slug')).toBeInTheDocument()
  })

  it('displays theme descriptions', () => {
    const themes = [createMockTheme({ description: 'This is a custom description' })]

    render(<ThemeList themes={themes} />)

    expect(screen.getByText('This is a custom description')).toBeInTheDocument()
  })

  it('displays version numbers', () => {
    const themes = [createMockTheme({ current_version: 5 })]

    render(<ThemeList themes={themes} />)

    expect(screen.getByText('v5')).toBeInTheDocument()
  })

  it('shows star icon for default theme', () => {
    const themes = [createMockTheme({ is_default: true })]

    render(<ThemeList themes={themes} />)

    // The Star icon from lucide-react should be present
    const starIcon = document.querySelector('svg.text-yellow-500')
    expect(starIcon).toBeInTheDocument()
  })

  it('shows inactive badge for inactive themes', () => {
    const themes = [createMockTheme({ is_active: false })]

    render(<ThemeList themes={themes} />)

    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('does not show inactive badge for active themes', () => {
    const themes = [createMockTheme({ is_active: true })]

    render(<ThemeList themes={themes} />)

    expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
  })

  it('renders theme cards as links to theme detail page', () => {
    const themes = [createMockTheme({ id: 'theme-123' })]

    render(<ThemeList themes={themes} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/themes/theme-123')
  })

  it('renders color swatches for each theme', () => {
    const themes = [createMockTheme()]

    render(<ThemeList themes={themes} />)

    // Should have 11 color swatch divs (50, 100, 200, ..., 950)
    const themeCard = screen.getByRole('link')
    const colorSwatches = themeCard.querySelector('.h-16')?.children
    expect(colorSwatches).toHaveLength(11)
  })

  it('renders empty when no themes provided', () => {
    render(<ThemeList themes={[]} />)

    // Should render empty grid
    const grid = document.querySelector('.grid')
    expect(grid?.children).toHaveLength(0)
  })

  it('handles themes without descriptions gracefully', () => {
    const themes = [createMockTheme({ description: null })]

    render(<ThemeList themes={themes} />)

    // Should not crash and should render the theme name
    expect(screen.getByText('Test Theme')).toBeInTheDocument()
  })

  it('handles themes without colors gracefully', () => {
    const themes = [createMockTheme({ colors: undefined as unknown as ThemeColors })]

    // Should not crash
    render(<ThemeList themes={themes} />)
    expect(screen.getByText('Test Theme')).toBeInTheDocument()
  })
})
