import { describe, it, expect, vi } from 'vitest'
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
  const defaultProps = {
    colors: mockColors,
    mode: 'light' as const,
  }

  it('renders preview title', () => {
    render(<ThemePreview {...defaultProps} />)

    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders light and dark mode toggle buttons when onModeChange provided', () => {
    render(<ThemePreview {...defaultProps} onModeChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument()
  })

  it('does not render mode toggle when onModeChange not provided', () => {
    render(<ThemePreview {...defaultProps} />)

    expect(screen.queryByRole('button', { name: /light/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /dark/i })).not.toBeInTheDocument()
  })

  it('shows light mode when mode is light', () => {
    const onModeChange = vi.fn()
    render(<ThemePreview {...defaultProps} mode="light" onModeChange={onModeChange} />)

    const lightButton = screen.getByRole('button', { name: /light/i })
    expect(lightButton.className).toContain('bg-white')
  })

  it('calls onModeChange when dark mode is clicked', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    render(<ThemePreview {...defaultProps} onModeChange={onModeChange} />)

    const darkButton = screen.getByRole('button', { name: /dark/i })
    await user.click(darkButton)

    expect(onModeChange).toHaveBeenCalledWith('dark')
  })

  it('renders sample card section', () => {
    render(<ThemePreview {...defaultProps} />)

    expect(screen.getByText('Sample Card')).toBeInTheDocument()
    expect(screen.getByText('This is how content looks with your theme colors.')).toBeInTheDocument()
  })

  it('renders primary and secondary buttons', () => {
    render(<ThemePreview {...defaultProps} />)

    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument()
  })

  it('renders text samples', () => {
    render(<ThemePreview {...defaultProps} />)

    expect(screen.getByText('Primary text')).toBeInTheDocument()
    expect(screen.getByText('Secondary text')).toBeInTheDocument()
    expect(screen.getByText('Muted text')).toBeInTheDocument()
  })

  it('renders Expertly branding', () => {
    render(<ThemePreview {...defaultProps} />)

    expect(screen.getByText('E')).toBeInTheDocument()
    expect(screen.getByText('Expertly')).toBeInTheDocument()
  })

  it('applies light mode colors correctly', () => {
    render(<ThemePreview {...defaultProps} mode="light" />)

    // Check that the primary text has the light mode color
    const primaryText = screen.getByText('Primary text')
    expect(primaryText).toHaveStyle({ color: mockColors.light.text.primary })
  })

  it('applies dark mode colors when mode is dark', () => {
    render(<ThemePreview {...defaultProps} mode="dark" />)

    // Check that the primary text has the dark mode color
    const primaryText = screen.getByText('Primary text')
    expect(primaryText).toHaveStyle({ color: mockColors.dark.text.primary })
  })

  it('renders color chips', () => {
    render(<ThemePreview {...defaultProps} />)

    // Should have 3 color chips (500, 600, 700)
    const colorChips = document.querySelectorAll('.flex.gap-1.pt-2 > div')
    expect(colorChips).toHaveLength(3)
  })

  it('applies primary button color correctly', () => {
    render(<ThemePreview {...defaultProps} />)

    const primaryButton = screen.getByRole('button', { name: 'Primary' })
    expect(primaryButton).toHaveStyle({ backgroundColor: mockColors.light.primary['600'] })
  })

  it('applies secondary button colors correctly', () => {
    render(<ThemePreview {...defaultProps} />)

    const secondaryButton = screen.getByRole('button', { name: 'Secondary' })
    expect(secondaryButton).toHaveStyle({
      backgroundColor: mockColors.light.primary['50'],
      color: mockColors.light.primary['700'],
    })
  })
})
