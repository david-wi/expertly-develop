import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { Badge, getStatusBadgeVariant } from './Badge'

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Status</Badge>)
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('applies default variant styling', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge.className).toContain('bg-theme-bg-elevated')
    expect(badge.className).toContain('text-theme-text-secondary')
  })

  it('applies success variant styling', () => {
    render(<Badge variant="success">Success</Badge>)
    const badge = screen.getByText('Success')
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-700')
  })

  it('applies warning variant styling', () => {
    render(<Badge variant="warning">Warning</Badge>)
    const badge = screen.getByText('Warning')
    expect(badge.className).toContain('bg-yellow-100')
    expect(badge.className).toContain('text-yellow-700')
  })

  it('applies danger variant styling', () => {
    render(<Badge variant="danger">Danger</Badge>)
    const badge = screen.getByText('Danger')
    expect(badge.className).toContain('bg-red-100')
    expect(badge.className).toContain('text-red-700')
  })

  it('applies info variant styling', () => {
    render(<Badge variant="info">Info</Badge>)
    const badge = screen.getByText('Info')
    expect(badge.className).toContain('bg-blue-100')
    expect(badge.className).toContain('text-blue-700')
  })

  it('applies base styling for all variants', () => {
    render(<Badge>Badge</Badge>)
    const badge = screen.getByText('Badge')
    expect(badge.className).toContain('inline-flex')
    expect(badge.className).toContain('items-center')
    expect(badge.className).toContain('px-2.5')
    expect(badge.className).toContain('py-0.5')
    expect(badge.className).toContain('rounded-full')
    expect(badge.className).toContain('text-xs')
    expect(badge.className).toContain('font-medium')
  })
})

describe('getStatusBadgeVariant', () => {
  it('returns success for completed status', () => {
    expect(getStatusBadgeVariant('completed')).toBe('success')
  })

  it('returns success for complete status', () => {
    expect(getStatusBadgeVariant('complete')).toBe('success')
  })

  it('returns info for running status', () => {
    expect(getStatusBadgeVariant('running')).toBe('info')
  })

  it('returns info for in_progress status', () => {
    expect(getStatusBadgeVariant('in_progress')).toBe('info')
  })

  it('returns warning for pending status', () => {
    expect(getStatusBadgeVariant('pending')).toBe('warning')
  })

  it('returns danger for failed status', () => {
    expect(getStatusBadgeVariant('failed')).toBe('danger')
  })

  it('returns danger for cancelled status', () => {
    expect(getStatusBadgeVariant('cancelled')).toBe('danger')
  })

  it('returns default for unknown status', () => {
    expect(getStatusBadgeVariant('unknown')).toBe('default')
    expect(getStatusBadgeVariant('any_other_status')).toBe('default')
    expect(getStatusBadgeVariant('')).toBe('default')
  })
})
