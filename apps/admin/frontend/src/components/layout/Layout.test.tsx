import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { Layout } from './Layout'
import { usersApi } from '@/services/api'

// Mock the API
vi.mock('@/services/api', () => ({
  usersApi: {
    me: vi.fn(),
  },
}))

// Mock react-router-dom's Outlet
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
    useLocation: () => ({ pathname: '/themes' }),
  }
})

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the sidebar with correct product info', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: null,
    })

    render(<Layout />)

    expect(screen.getByTestId('product-code')).toHaveTextContent('admin')
    expect(screen.getByTestId('product-name')).toHaveTextContent('Admin')
  })

  it('renders navigation links', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: null,
    })

    render(<Layout />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Themes')).toBeInTheDocument()
    expect(screen.getByText('Error Logs')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  it('renders the main content area with Outlet', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: null,
    })

    render(<Layout />)

    expect(screen.getByTestId('main-content')).toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('displays user name when user is loaded', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      organization_id: 'org1',
    })

    render(<Layout />)

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe')
    })
  })

  it('handles user API error gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(usersApi.me).mockRejectedValue(new Error('API Error'))

    render(<Layout />)

    // Should render without crashing
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled()
    })

    consoleError.mockRestore()
  })

  it('renders marketing page link', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: null,
    })

    render(<Layout />)

    const marketingLink = screen.getByText('View marketing page')
    expect(marketingLink).toBeInTheDocument()
    expect(marketingLink).toHaveAttribute('href', '/landing')
  })

  it('passes current path to sidebar', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: null,
    })

    render(<Layout />)

    expect(screen.getByTestId('current-path')).toHaveTextContent('/themes')
  })

  it('renders navigation links with correct hrefs', async () => {
    vi.mocked(usersApi.me).mockResolvedValue({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: null,
    })

    render(<Layout />)

    const dashboardLink = screen.getByText('Dashboard').closest('a')
    const themesLink = screen.getByText('Themes').closest('a')
    const errorLogsLink = screen.getByText('Error Logs').closest('a')
    const monitoringLink = screen.getByText('Monitoring').closest('a')

    expect(dashboardLink).toHaveAttribute('href', '/')
    expect(themesLink).toHaveAttribute('href', '/themes')
    expect(errorLogsLink).toHaveAttribute('href', '/error-logs')
    expect(monitoringLink).toHaveAttribute('href', '/monitoring')
  })

  it('does not show user name when user is not loaded yet', () => {
    vi.mocked(usersApi.me).mockImplementation(() => new Promise(() => {}))

    render(<Layout />)

    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument()
  })
})
