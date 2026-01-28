import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import OrganizationsPage from './OrganizationsPage'

// Mock the API module
vi.mock('../services/api', () => ({
  organizationsApi: {
    list: vi.fn(),
    create: vi.fn(),
  },
  setOrganizationId: vi.fn(),
  getOrganizationId: vi.fn(),
}))

describe('OrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders organizations page', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    render(<OrganizationsPage />)

    expect(screen.getByRole('heading', { name: /organizations/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create organization/i })).toBeInTheDocument()
  })

  it('shows loading state', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<OrganizationsPage />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no organizations', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    render(<OrganizationsPage />)

    await waitFor(() => {
      expect(screen.getByText(/no organizations yet/i)).toBeInTheDocument()
    })
  })

  it('displays list of organizations', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: true, created_at: '', updated_at: '' },
    ])

    render(<OrganizationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Org One')).toBeInTheDocument()
      expect(screen.getByText('Org Two')).toBeInTheDocument()
    })
  })

  it('shows current badge for selected organization', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
    ])

    render(<OrganizationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument()
    })
  })

  it('shows switch to this button for non-current organization', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: true, created_at: '', updated_at: '' },
    ])

    render(<OrganizationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to this/i })).toBeInTheDocument()
    })
  })

  it('opens create organization modal', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    const user = userEvent.setup()
    render(<OrganizationsPage />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create organization/i }))

    // Use findBy which has built-in waiting - look for the modal heading
    expect(await screen.findByRole('heading', { name: /create organization/i, level: 3 })).toBeInTheDocument()
  })

  it('creates organization on form submit', async () => {
    const { organizationsApi, getOrganizationId, setOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])
    vi.mocked(organizationsApi.create).mockResolvedValue({
      id: 'org-new',
      name: 'New Org',
      slug: 'new-org',
      is_active: true,
      created_at: '',
      updated_at: '',
    })

    const user = userEvent.setup()
    render(<OrganizationsPage />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create organization/i }))

    // Wait for modal heading
    await screen.findByRole('heading', { name: /create organization/i, level: 3 })

    // Fill form using placeholders
    await user.type(screen.getByPlaceholderText(/acme inc/i), 'New Org')
    await user.clear(screen.getByPlaceholderText(/acme-inc/i))
    await user.type(screen.getByPlaceholderText(/acme-inc/i), 'new-org')

    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(organizationsApi.create).toHaveBeenCalledWith('New Org', 'new-org')
      expect(setOrganizationId).toHaveBeenCalledWith('org-new')
    })
  })

  it('closes modal on cancel', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue([])

    const user = userEvent.setup()
    render(<OrganizationsPage />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /create organization/i }))

    // Wait for modal heading to appear
    await screen.findByRole('heading', { name: /create organization/i, level: 3 })

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /create organization/i })).not.toBeInTheDocument()
    })
  })

  it('switches organization when button is clicked', async () => {
    const { organizationsApi, getOrganizationId, setOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: true, created_at: '', updated_at: '' },
    ])

    const user = userEvent.setup()
    render(<OrganizationsPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to this/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /switch to this/i }))

    expect(setOrganizationId).toHaveBeenCalledWith('org-2')
  })

  it('shows active/inactive status', async () => {
    const { organizationsApi, getOrganizationId } = await import('../services/api')
    vi.mocked(getOrganizationId).mockReturnValue('org-1')
    vi.mocked(organizationsApi.list).mockResolvedValue([
      { id: 'org-1', name: 'Org One', slug: 'org-one', is_active: true, created_at: '', updated_at: '' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', is_active: false, created_at: '', updated_at: '' },
    ])

    render(<OrganizationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })
})
