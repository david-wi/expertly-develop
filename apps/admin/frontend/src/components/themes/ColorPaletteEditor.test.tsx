import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ColorPaletteEditor } from './ColorPaletteEditor'
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

describe('ColorPaletteEditor', () => {
  const defaultProps = {
    colors: mockColors,
    onChange: vi.fn(),
    activeMode: 'light' as const,
    onModeChange: vi.fn(),
  }

  it('renders with initial colors', () => {
    render(<ColorPaletteEditor {...defaultProps} />)

    expect(screen.getByText('Color Palette')).toBeInTheDocument()
    expect(screen.getByText('Brand Color Scale')).toBeInTheDocument()
    expect(screen.getByText('Background Colors')).toBeInTheDocument()
    expect(screen.getByText('Text Colors')).toBeInTheDocument()
    expect(screen.getByText('Border Colors')).toBeInTheDocument()
  })

  it('shows light mode when activeMode is light', () => {
    render(<ColorPaletteEditor {...defaultProps} activeMode="light" />)

    const lightButton = screen.getByRole('button', { name: /light/i })
    expect(lightButton.className).toContain('bg-white')
  })

  it('calls onModeChange when dark mode is clicked', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    render(<ColorPaletteEditor {...defaultProps} onModeChange={onModeChange} />)

    const darkButton = screen.getByRole('button', { name: /dark/i })
    await user.click(darkButton)

    expect(onModeChange).toHaveBeenCalledWith('dark')
  })

  it('shows all primary color shades', () => {
    render(<ColorPaletteEditor {...defaultProps} />)

    const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
    shades.forEach((shade) => {
      expect(screen.getByText(shade)).toBeInTheDocument()
    })
  })

  it('shows background color inputs', () => {
    render(<ColorPaletteEditor {...defaultProps} />)

    // Check for background color labels (there are 3)
    const defaultLabels = screen.getAllByText('Default')
    expect(defaultLabels.length).toBeGreaterThan(0)
    expect(screen.getByText('Surface')).toBeInTheDocument()
    expect(screen.getByText('Elevated')).toBeInTheDocument()
  })

  it('shows text color inputs', () => {
    render(<ColorPaletteEditor {...defaultProps} />)

    // Check for text color labels
    const primaryLabels = screen.getAllByText('Primary')
    expect(primaryLabels.length).toBeGreaterThan(0)
    const secondaryLabels = screen.getAllByText('Secondary')
    expect(secondaryLabels.length).toBeGreaterThan(0)
    expect(screen.getByText('Muted')).toBeInTheDocument()
  })

  it('shows border color inputs', () => {
    render(<ColorPaletteEditor {...defaultProps} />)

    // Check for border color labels
    const defaultLabels = screen.getAllByText('Default')
    expect(defaultLabels.length).toBeGreaterThan(0)
    expect(screen.getByText('Subtle')).toBeInTheDocument()
  })

  it('calls onChange when a color is updated via text input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ColorPaletteEditor {...defaultProps} onChange={onChange} />)

    // Find a text input and change it (the first text input should be for primary 50)
    const textInputs = screen.getAllByRole('textbox')
    expect(textInputs.length).toBeGreaterThan(0)

    // Clear and type new value
    await user.clear(textInputs[0])
    await user.type(textInputs[0], '#ff0000')

    expect(onChange).toHaveBeenCalled()
  })
})
