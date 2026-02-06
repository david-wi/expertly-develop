import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Connections from './Connections'
import { api } from '../services/api'

// Mock the api module
vi.mock('../services/api', () => ({
  api: {
    getConnections: vi.fn(),
    getConnectionProviders: vi.fn(),
    deleteConnection: vi.fn(),
    startOAuthFlow: vi.fn(),
    refreshConnection: vi.fn(),
  },
}))

// Mock @expertly/ui Modal component
vi.mock('@expertly/ui', () => ({
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title: string }) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="modal-footer">{children}</div>,
}))

const mockConnections = [
  {
    id: 'conn-1',
    provider: 'google' as const,
    provider_email: 'user@gmail.com',
    status: 'active' as const,
    scopes: ['gmail.readonly', 'drive.readonly'],
    connected_at: '2024-01-15T10:00:00Z',
  },
]

const mockProviders = [
  {
    id: 'google',
    name: 'Google',
    description: 'Connect Gmail, Drive, and Docs',
    scopes: ['Gmail (read/send)', 'Google Drive (read)'],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect to Slack workspaces',
    scopes: ['Messages', 'Channels'],
  },
]

describe('Connections Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(api.getConnections).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.getConnectionProviders).mockReturnValue(new Promise(() => {}))

    render(
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    )

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders empty state when no connections', async () => {
    vi.mocked(api.getConnections).mockResolvedValue([])
    vi.mocked(api.getConnectionProviders).mockResolvedValue(mockProviders)

    render(
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No connections')).toBeInTheDocument()
    })

    expect(screen.getByText('Connect external services like Google, Slack, or Microsoft.')).toBeInTheDocument()
    expect(screen.getByText('Add your first connection')).toBeInTheDocument()
  })

  it('renders connections list', async () => {
    vi.mocked(api.getConnections).mockResolvedValue(mockConnections)
    vi.mocked(api.getConnectionProviders).mockResolvedValue(mockProviders)

    render(
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('user@gmail.com')).toBeInTheDocument()
    })

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Remove')).toBeInTheDocument()
  })

  it('shows Add Connection button when providers available', async () => {
    vi.mocked(api.getConnections).mockResolvedValue([])
    vi.mocked(api.getConnectionProviders).mockResolvedValue(mockProviders)

    render(
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    )

    await waitFor(() => {
      // There should be buttons for adding connections
      const buttons = screen.getAllByRole('button', { name: /add.*connection/i })
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  it('displays page header and description', async () => {
    vi.mocked(api.getConnections).mockResolvedValue([])
    vi.mocked(api.getConnectionProviders).mockResolvedValue([])

    render(
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Connections')).toBeInTheDocument()
    })

    expect(screen.getByText('Connect external services to use with your tasks')).toBeInTheDocument()
  })

  it('shows permissions section when connections exist', async () => {
    vi.mocked(api.getConnections).mockResolvedValue(mockConnections)
    vi.mocked(api.getConnectionProviders).mockResolvedValue(mockProviders)

    render(
      <BrowserRouter>
        <Connections />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Permissions')).toBeInTheDocument()
    })

    // Check that scopes are displayed
    expect(screen.getByText('gmail (read)')).toBeInTheDocument()
    expect(screen.getByText('drive (read)')).toBeInTheDocument()
  })
})
