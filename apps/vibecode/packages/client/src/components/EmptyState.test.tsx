import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from './EmptyState'
import { useDashboardStore } from '../store/dashboard-store'

// Mock the store
vi.mock('../store/dashboard-store', () => ({
  useDashboardStore: vi.fn(),
}))

describe('EmptyState', () => {
  const mockAddWidget = vi.fn()
  const mockWs = {
    send: vi.fn(),
    createSession: vi.fn(),
    sendMessage: vi.fn(),
    interruptSession: vi.fn(),
    subscribeToSession: vi.fn(),
    setExecutionMode: vi.fn(),
    closeSession: vi.fn(),
    sendDirectChat: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useDashboardStore).mockReturnValue({
      addWidget: mockAddWidget,
    } as ReturnType<typeof useDashboardStore>)
  })

  it('renders welcome message', () => {
    render(<EmptyState ws={mockWs} />)

    expect(screen.getByText('Welcome to Expertly Vibecode')).toBeInTheDocument()
    expect(
      screen.getByText(/Manage multiple Claude Code sessions/)
    ).toBeInTheDocument()
  })

  it('renders the create widget button', () => {
    render(<EmptyState ws={mockWs} />)

    expect(screen.getByText('Create Your First Widget')).toBeInTheDocument()
  })

  it('calls addWidget when create button is clicked', () => {
    render(<EmptyState ws={mockWs} />)

    const button = screen.getByText('Create Your First Widget')
    fireEvent.click(button)

    expect(mockAddWidget).toHaveBeenCalledTimes(1)
  })

  it('renders feature icons and descriptions', () => {
    render(<EmptyState ws={mockWs} />)

    expect(screen.getByText('Focus on what matters')).toBeInTheDocument()
    expect(screen.getByText('Run tasks in parallel')).toBeInTheDocument()
    expect(screen.getByText('Local or remote execution')).toBeInTheDocument()
  })
})
