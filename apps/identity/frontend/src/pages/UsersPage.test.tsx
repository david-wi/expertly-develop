import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import UsersPage from './UsersPage'

// Mock the API module
vi.mock('../services/api', () => ({
  usersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    regenerateApiKey: vi.fn(),
  },
  imagesApi: {
    generateAvatar: vi.fn(),
  },
  getOrganizationId: vi.fn(),
  clearOrganizationId: vi.fn(),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockUser = {
  id: 'user-1',
  organization_id: 'org-1',
  name: 'Test User',
  email: 'test@example.com',
  user_type: 'human' as const,
  role: 'member' as const,
  is_active: true,
  is_default: false,
  avatar_url: null,
  title: 'Developer',
  responsibilities: null,
  bot_config: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockBot = {
  ...mockUser,
  id: 'bot-1',
  name: 'Test Bot',
  email: null,
  user_type: 'bot' as const,
  title: 'Assistant',
  responsibilities: 'Help with tasks',
  bot_config: { what_i_can_help_with: 'Research' },
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('No organization selected', () => {
    it('shows message to select organization', async () => {
      const { getOrganizationId } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue(null)

      render(<UsersPage />)

      expect(screen.getByText(/please select an organization first/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /go to organizations/i })).toBeInTheDocument()
    })
  })

  describe('With organization selected', () => {
    beforeEach(async () => {
      const { getOrganizationId, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('renders users page with heading', async () => {
      render(<UsersPage defaultFilter="human" />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /users/i })).toBeInTheDocument()
      })
    })

    it('shows loading state', async () => {
      const { usersApi } = await import('../services/api')
      vi.mocked(usersApi.list).mockImplementation(() => new Promise(() => {}))

      render(<UsersPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('displays list of users', async () => {
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
    })

    it('shows user type badge', async () => {
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Human')).toBeInTheDocument()
      })
    })

    it('shows active status', async () => {
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
    })

    it('shows Add User button for human filter', async () => {
      render(<UsersPage defaultFilter="human" />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument()
      })
    })

    it('shows Add Bot button for bot filter', async () => {
      const { usersApi } = await import('../services/api')
      vi.mocked(usersApi.list).mockResolvedValue([mockBot])

      render(<UsersPage defaultFilter="bot" />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add bot/i })).toBeInTheDocument()
      })
    })

    it('shows filter dropdown for all filter', async () => {
      render(<UsersPage defaultFilter="all" />)

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })

    it('shows empty state when no users', async () => {
      const { usersApi } = await import('../services/api')
      vi.mocked(usersApi.list).mockResolvedValue([])

      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText(/no users found/i)).toBeInTheDocument()
      })
    })
  })

  describe('Create user modal', () => {
    beforeEach(async () => {
      const { getOrganizationId, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(usersApi.list).mockResolvedValue([])
    })

    it('opens create modal when Add User is clicked', async () => {
      const user = userEvent.setup()
      render(<UsersPage defaultFilter="human" />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add user/i }))

      expect(await screen.findByText(/add new user/i)).toBeInTheDocument()
    })

    it('closes modal on cancel', async () => {
      const user = userEvent.setup()
      render(<UsersPage defaultFilter="human" />)

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add user/i }))

      await screen.findByText(/add new user/i)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByText(/add new user/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit user', () => {
    beforeEach(async () => {
      const { getOrganizationId, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('opens edit modal when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })

      // Find and click the edit button (has title="Edit")
      const editButton = screen.getByTitle('Edit')
      await user.click(editButton)

      expect(await screen.findByText(/edit user/i)).toBeInTheDocument()
    })

    it('populates form with user data', async () => {
      const user = userEvent.setup()
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })

      const editButton = screen.getByTitle('Edit')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
      })
    })
  })

  describe('Delete user', () => {
    beforeEach(async () => {
      const { getOrganizationId, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('shows delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })

      const deleteButton = screen.getByTitle('Delete')
      await user.click(deleteButton)

      expect(await screen.findByText(/delete user\?/i)).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument()
    })

    it('does not show delete button for default users', async () => {
      const { usersApi } = await import('../services/api')
      vi.mocked(usersApi.list).mockResolvedValue([{ ...mockUser, is_default: true }])

      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })

      expect(screen.queryByTitle('Delete')).not.toBeInTheDocument()
    })
  })

  describe('API Key', () => {
    beforeEach(async () => {
      const { getOrganizationId, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('shows API Key button', async () => {
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /api key/i })).toBeInTheDocument()
    })

    it('regenerates API key when clicked', async () => {
      const { usersApi } = await import('../services/api')
      vi.mocked(usersApi.regenerateApiKey).mockResolvedValue({ api_key: 'regenerated-key-123' })

      const user = userEvent.setup()
      render(<UsersPage />)

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /api key/i }))

      await waitFor(() => {
        expect(screen.getByText('regenerated-key-123')).toBeInTheDocument()
      })
    })
  })

  describe('Bot-specific features', () => {
    beforeEach(async () => {
      const { getOrganizationId, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(usersApi.list).mockResolvedValue([mockBot])
    })

    it('shows Bots heading for bot filter', async () => {
      render(<UsersPage defaultFilter="bot" />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /bots/i })).toBeInTheDocument()
      })
    })
  })
})
