import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Layout from './Layout'

// Mock the API module
vi.mock('../services/api', () => ({
  authApi: {
    me: vi.fn(),
  },
  organizationsApi: {
    list: vi.fn(),
  },
  getOrganizationId: vi.fn(),
  setOrganizationId: vi.fn(),
}))

// Mock window.location.reload
const mockReload = vi.fn()
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
})

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sidebar with product name', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    expect(screen.getByTestId('product-name')).toHaveTextContent('Identity')
  })

  it('renders navigation items', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Bots')).toBeInTheDocument()
    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getByText('Change Password')).toBeInTheDocument()
  })

  it('renders main content area', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('renders marketing page link', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    expect(screen.getByText('View marketing page')).toBeInTheDocument()
  })

  it('shows organization switcher when organizations exist', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: true, created_at: '', updated_at: '' },
    ])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('org-switcher')).toBeInTheDocument()
    })
  })

  it('selects first organization when none selected', async () => {
    const { organizationsApi, getOrganizationId, setOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
    ])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(setOrganizationId).toHaveBeenCalledWith('org-1')
    })
  })

  it('reloads page when organization is switched', async () => {
    const { organizationsApi, getOrganizationId, setOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: true, created_at: '', updated_at: '' },
    ])

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('org-switcher')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'org-2')

    expect(setOrganizationId).toHaveBeenCalledWith('org-2')
    expect(mockReload).toHaveBeenCalled()
  })

  it('displays organization names in switcher', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: true, created_at: '', updated_at: '' },
    ])

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    await waitFor(() => {
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
    })

    expect(screen.getByRole('option', { name: 'Org One' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Org Two' })).toBeInTheDocument()
  })

  it('handles organization list fetch error gracefully', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockRejectedValue(new Error('Network error'))

    // Should not throw
    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    // Should still render the layout
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })
})

describe('Layout - User info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls authApi.me to fetch user', async () => {
    const { authApi, organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([])
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      organization_id: 'org-1',
      organization_name: 'Test Org',
      role: 'member',
      avatar_url: null,
    })

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Layout />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(authApi.me).toHaveBeenCalled()
    })
  })
})
