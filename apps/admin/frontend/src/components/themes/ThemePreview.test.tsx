import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ThemePreview } from './ThemePreview'
import type { ThemeColors } from '@/types/theme'

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

describe('ThemePreview', () => {
  it('renders preview title', () => {
    render(<ThemePreview colors={mockColors} />)

    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders light and dark mode toggle buttons', () => {
    render(<ThemePreview colors={mockColors} />)

    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument()
  })

  it('shows light mode by default', () => {
    render(<ThemePreview colors={mockColors} />)

    const lightButton = screen.getByRole('button', { name: /light/i })
    expect(lightButton.className).toContain('bg-white')
  })

  it('can switch to dark mode', async () => {
    const user = userEvent.setup()
    render(<ThemePreview colors={mockColors} />)

    const darkButton = screen.getByRole('button', { name: /dark/i })
    await user.click(darkButton)

    expect(darkButton.className).toContain('bg-white')
  })

  it('renders sample card section', () => {
    render(<ThemePreview colors={mockColors} />)

    expect(screen.getByText('Sample Card')).toBeInTheDocument()
    expect(screen.getByText('This is how content looks with your theme colors.')).toBeInTheDocument()
  })

  it('renders primary and secondary buttons', () => {
    render(<ThemePreview colors={mockColors} />)

    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument()
  })

  it('renders text samples', () => {
    render(<ThemePreview colors={mockColors} />)

    expect(screen.getByText('Primary text')).toBeInTheDocument()
    expect(screen.getByText('Secondary text')).toBeInTheDocument()
    expect(screen.getByText('Muted text')).toBeInTheDocument()
  })

  it('renders Expertly branding', () => {
    render(<ThemePreview colors={mockColors} />)

    expect(screen.getByText('E')).toBeInTheDocument()
    expect(screen.getByText('Expertly')).toBeInTheDocument()
  })

  it('applies light mode colors correctly', () => {
    render(<ThemePreview colors={mockColors} />)

    // Check that the primary text has the light mode color
    const primaryText = screen.getByText('Primary text')
    expect(primaryText).toHaveStyle({ color: mockColors.light.text.primary })
  })

  it('applies dark mode colors after toggle', async () => {
    const user = userEvent.setup()
    render(<ThemePreview colors={mockColors} />)

    const darkButton = screen.getByRole('button', { name: /dark/i })
    await user.click(darkButton)

    // Check that the primary text has the dark mode color
    const primaryText = screen.getByText('Primary text')
    expect(primaryText).toHaveStyle({ color: mockColors.dark.text.primary })
  })

  it('renders color chips', () => {
    render(<ThemePreview colors={mockColors} />)

    // Should have 3 color chips (500, 600, 700)
    const colorChips = document.querySelectorAll('.flex.gap-1.pt-2 > div')
    expect(colorChips).toHaveLength(3)
  })

  it('applies primary button color correctly', () => {
    render(<ThemePreview colors={mockColors} />)

    const primaryButton = screen.getByRole('button', { name: 'Primary' })
    expect(primaryButton).toHaveStyle({ backgroundColor: mockColors.light.primary['600'] })
  })

  it('applies secondary button colors correctly', () => {
    render(<ThemePreview colors={mockColors} />)

    const secondaryButton = screen.getByRole('button', { name: 'Secondary' })
    expect(secondaryButton).toHaveStyle({
      backgroundColor: mockColors.light.primary['50'],
      color: mockColors.light.primary['700'],
    })
  })
})
