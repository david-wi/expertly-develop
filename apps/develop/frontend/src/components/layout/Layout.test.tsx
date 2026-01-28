import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import Layout from './Layout'

// Mock the API client
vi.mock('../../api/client', () => ({
  usersApi: {
    me: vi.fn(),
  },
  organizationsApi: {
    list: vi.fn(),
  },
  TENANT_STORAGE_KEY: 'expertly-tenant-id',
}))

// Mock OrganizationSwitcher
vi.mock('./OrganizationSwitcher', () => ({
  default: ({ currentTenantId, onSwitch }: { currentTenantId: string | null; onSwitch: () => void }) => (
    <button data-testid="org-switcher-mock" data-tenant-id={currentTenantId} onClick={onSwitch}>
      Switch Org
    </button>
  ),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders the sidebar with product name', async () => {
    render(<Layout />)

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('product-name')).toHaveTextContent('Develop')
  })

  it('renders main content area', async () => {
    render(<Layout />)

    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('renders navigation links', async () => {
    render(<Layout />)

    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('nav-projects')).toBeInTheDocument()
    expect(screen.getByTestId('nav-job-queue')).toBeInTheDocument()
    expect(screen.getByTestId('nav-artifacts')).toBeInTheDocument()
    expect(screen.getByTestId('nav-new-walkthrough')).toBeInTheDocument()
  })

  it('renders organization switcher', async () => {
    render(<Layout />)

    expect(screen.getByTestId('org-switcher-mock')).toBeInTheDocument()
  })

  it('displays user information when available', async () => {
    render(<Layout />)

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Test User')
    })
  })

  it('renders link to marketing page', async () => {
    render(<Layout />)

    const marketingLink = screen.getByText('View marketing page')
    expect(marketingLink).toBeInTheDocument()
    expect(marketingLink).toHaveAttribute('href', '/landing')
  })

  it('uses tenant ID from localStorage when available', async () => {
    localStorageMock.getItem.mockReturnValue('tenant-123')

    render(<Layout />)

    const orgSwitcher = screen.getByTestId('org-switcher-mock')
    expect(orgSwitcher).toHaveAttribute('data-tenant-id', 'tenant-123')
  })

  it('falls back to user organization_id when no localStorage tenant', async () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(<Layout />)

    const orgSwitcher = screen.getByTestId('org-switcher-mock')
    expect(orgSwitcher).toHaveAttribute('data-tenant-id', 'org-1')
  })
})
