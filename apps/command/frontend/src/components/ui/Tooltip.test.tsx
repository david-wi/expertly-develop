import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders children', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Hover me</button>
      </Tooltip>
    )
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('shows tooltip on hover after delay', async () => {
    vi.useRealTimers() // Use real timers for this test

    render(
      <Tooltip content="Test tooltip content" delay={100}>
        <button>Hover me</button>
      </Tooltip>
    )

    const trigger = screen.getByText('Hover me')
    fireEvent.mouseEnter(trigger)

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument()
    }, { timeout: 500 })
  })

  it('hides tooltip on mouse leave', async () => {
    vi.useRealTimers()

    render(
      <Tooltip content="Test tooltip content" delay={50}>
        <button>Hover me</button>
      </Tooltip>
    )

    const trigger = screen.getByText('Hover me')

    fireEvent.mouseEnter(trigger)
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    }, { timeout: 200 })

    fireEvent.mouseLeave(trigger)
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('shows tooltip on focus', async () => {
    vi.useRealTimers()

    render(
      <Tooltip content="Test tooltip content" delay={50}>
        <button>Focus me</button>
      </Tooltip>
    )

    const trigger = screen.getByText('Focus me')
    fireEvent.focus(trigger)

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    }, { timeout: 200 })
  })

  it('hides tooltip on blur', async () => {
    vi.useRealTimers()

    render(
      <Tooltip content="Test tooltip content" delay={50}>
        <button>Focus me</button>
      </Tooltip>
    )

    const trigger = screen.getByText('Focus me')

    fireEvent.focus(trigger)
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    }, { timeout: 200 })

    fireEvent.blur(trigger)
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })
})
