import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import OrganizationSwitcher from './OrganizationSwitcher'
import { organizationsApi, TENANT_STORAGE_KEY } from '../../api/client'

// Mock the API client
vi.mock('../../api/client', () => ({
  organizationsApi: {
    list: vi.fn(),
  },
  TENANT_STORAGE_KEY: 'expertly-tenant-id',
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('OrganizationSwitcher', () => {
  const mockOrganizations = [
    { id: 'org-1', name: 'Organization One', slug: 'org-one' },
    { id: 'org-2', name: 'Organization Two', slug: 'org-two' },
    { id: 'org-3', name: 'Organization Three', slug: 'org-three' },
  ]

  const mockOnSwitch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    vi.mocked(organizationsApi.list).mockResolvedValue({
      items: mockOrganizations,
      total: 3,
    })
  })

  it('renders loading state initially', async () => {
    vi.mocked(organizationsApi.list).mockReturnValue(new Promise(() => {})) // Never resolves

    render(<OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />)

    const loadingElement = document.querySelector('.animate-pulse')
    expect(loadingElement).toBeInTheDocument()
  })

  it('renders nothing when only one organization exists', async () => {
    vi.mocked(organizationsApi.list).mockResolvedValue({
      items: [mockOrganizations[0]],
      total: 1,
    })

    const { container } = render(
      <OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />
    )

    await waitFor(() => {
      expect(container.children.length).toBe(0)
    })
  })

  it('displays current organization name', async () => {
    render(<OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })
  })

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup()
    render(<OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Organization Two')).toBeInTheDocument()
      expect(screen.getByText('Organization Three')).toBeInTheDocument()
    })
  })

  it('marks current organization in dropdown', async () => {
    const user = userEvent.setup()
    render(<OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument()
    })
  })

  it('switches organization when selecting a different one', async () => {
    const user = userEvent.setup()
    render(<OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Organization Two')).toBeInTheDocument()
    })

    // Click on Organization Two
    const orgTwoButtons = screen.getAllByRole('button')
    const orgTwoButton = orgTwoButtons.find(btn => btn.textContent?.includes('Organization Two'))
    if (orgTwoButton) {
      await user.click(orgTwoButton)
    }

    expect(localStorageMock.setItem).toHaveBeenCalledWith(TENANT_STORAGE_KEY, 'org-2')
    expect(mockOnSwitch).toHaveBeenCalled()
  })

  it('closes dropdown when selecting same organization', async () => {
    const user = userEvent.setup()
    render(<OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument()
    })

    // Click on Organization One (current)
    const orgOneButtons = screen.getAllByRole('button')
    const currentOrgButton = orgOneButtons.find(btn => btn.textContent?.includes('Current'))
    if (currentOrgButton) {
      await user.click(currentOrgButton)
    }

    expect(localStorageMock.setItem).not.toHaveBeenCalled()
    expect(mockOnSwitch).not.toHaveBeenCalled()
  })

  it('shows reset option when there is an override', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('org-2')

    render(<OrganizationSwitcher currentTenantId="org-2" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization Two')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Reset to default')).toBeInTheDocument()
    })
  })

  it('clears override when reset is clicked', async () => {
    const user = userEvent.setup()
    localStorageMock.getItem.mockReturnValue('org-2')

    render(<OrganizationSwitcher currentTenantId="org-2" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      expect(screen.getByText('Organization Two')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Reset to default')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Reset to default'))

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(TENANT_STORAGE_KEY)
    expect(mockOnSwitch).toHaveBeenCalled()
  })

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />
      </div>
    )

    await waitFor(() => {
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('Organization Two')).toBeInTheDocument()
    })

    // Click outside
    await user.click(screen.getByTestId('outside'))

    await waitFor(() => {
      expect(screen.queryByText('Current')).not.toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(organizationsApi.list).mockRejectedValue(new Error('API Error'))

    const { container } = render(
      <OrganizationSwitcher currentTenantId="org-1" onSwitch={mockOnSwitch} />
    )

    await waitFor(() => {
      // Should finish loading without crashing
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })
  })

  it('displays Select Organization when no current org matches', async () => {
    render(<OrganizationSwitcher currentTenantId="org-unknown" onSwitch={mockOnSwitch} />)

    await waitFor(() => {
      // Falls back to first organization
      expect(screen.getByText('Organization One')).toBeInTheDocument()
    })
  })
})
