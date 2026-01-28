import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConnectionStatus from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it('returns null when connected', () => {
    const { container } = render(<ConnectionStatus connected={true} />)

    expect(container.firstChild).toBeNull()
  })

  it('shows disconnected message when not connected', () => {
    render(<ConnectionStatus connected={false} />)

    expect(screen.getByText('Disconnected - Reconnecting...')).toBeInTheDocument()
  })

  it('displays the pulsing indicator when disconnected', () => {
    const { container } = render(<ConnectionStatus connected={false} />)

    const pulsingIndicator = container.querySelector('.animate-pulse')
    expect(pulsingIndicator).toBeInTheDocument()
  })
})
