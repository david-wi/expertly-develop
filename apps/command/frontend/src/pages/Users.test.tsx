import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Users from './Users'
import { api, User } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    regenerateApiKey: vi.fn(),
    generateAvatar: vi.fn(),
  },
}))

const mockUser: User = {
  id: 'user-1',
  _id: 'user-1',
  organization_id: 'org-1',
  email: 'test@example.com',
  name: 'Test User',
  user_type: 'human',
  role: 'member',
  is_active: true,
  is_default: false,
  created_at: '2024-01-01T00:00:00Z',
}

const mockAdmin: User = {
  ...mockUser,
  id: 'user-2',
  _id: 'user-2',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
}

const mockBot: User = {
  ...mockUser,
  id: 'bot-1',
  _id: 'bot-1',
  name: 'Bot User',
  email: 'bot@example.com',
  user_type: 'virtual',
  avatar_url: 'https://example.com/avatar.png',
  responsibilities: 'Automated tasks',
  bot_config: {
    what_i_can_help_with: 'Research and analysis',
  },
}

const mockDefaultUser: User = {
  ...mockUser,
  id: 'default-1',
  _id: 'default-1',
  name: 'Default User',
  is_default: true,
}

const mockInactiveUser: User = {
  ...mockUser,
  id: 'inactive-1',
  _id: 'inactive-1',
  name: 'Inactive User',
  is_active: false,
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getUsers).mockResolvedValue([
      mockUser,
      mockAdmin,
      mockBot,
      mockDefaultUser,
      mockInactiveUser,
    ])
  })

  it('renders users page title', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Users & Bots' })).toBeInTheDocument()
    })
  })

  it('renders Add User and Add Bot buttons', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getByText('Add User')).toBeInTheDocument()
      expect(screen.getByText('Add Bot')).toBeInTheDocument()
    })
  })

  it('displays users in table', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      // Users table should be present
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows user type badges', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getAllByText('Human')).toHaveLength(4)
      expect(screen.getByText('Bot')).toBeInTheDocument()
    })
  })

  it('shows user role', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getAllByText('member').length).toBeGreaterThan(0)
      expect(screen.getByText('admin')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('shows active/inactive status', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getAllByText('Active')).toHaveLength(4)
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    vi.mocked(api.getUsers).mockImplementation(() => new Promise(() => {}))

    renderWithRouter(<Users />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no users', async () => {
    vi.mocked(api.getUsers).mockResolvedValue([])

    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getByText('No users found.')).toBeInTheDocument()
    })
  })

  it('has user type filter dropdown', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      // Filter options should be present
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Humans')).toBeInTheDocument()
      expect(screen.getByText('Bots')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('opens create user modal on Add User click', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'))
    })

    expect(screen.getByText('Add New User')).toBeInTheDocument()
  })

  it('opens create bot modal on Add Bot click', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Bot'))
    })

    expect(screen.getByText('Add New User')).toBeInTheDocument()
  })

  it('shows type toggle in create modal', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'))
    })

    expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bot' })).toBeInTheDocument()
  })

  it('creates user on form submit', async () => {
    vi.mocked(api.createUser).mockResolvedValue({
      ...mockUser,
      api_key: 'test-api-key',
    })

    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'))
    })

    const nameInput = screen.getByPlaceholderText('e.g., John Smith')
    fireEvent.change(nameInput, { target: { value: 'New User' } })

    const emailInput = screen.getByPlaceholderText('user@example.com')
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@example.com',
          user_type: 'human',
          role: 'member',
        })
      )
    })
  })

  it('shows API key modal after creating user', async () => {
    vi.mocked(api.createUser).mockResolvedValue({
      ...mockUser,
      api_key: 'test-api-key-12345',
    })

    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'))
    })

    const nameInput = screen.getByPlaceholderText('e.g., John Smith')
    fireEvent.change(nameInput, { target: { value: 'New User' } })

    const emailInput = screen.getByPlaceholderText('user@example.com')
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.getByText('API Key')).toBeInTheDocument()
      expect(screen.getByText('test-api-key-12345')).toBeInTheDocument()
    })
  })

  it('closes create modal on cancel', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'))
    })

    expect(screen.getByText('Add New User')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Add New User')).not.toBeInTheDocument()
  })

  it('opens edit modal on Edit button click', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByText('Edit User')).toBeInTheDocument()
  })

  it('pre-fills edit form with user data', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  it('updates user on edit form submit', async () => {
    vi.mocked(api.updateUser).mockResolvedValue(mockUser)

    renderWithRouter(<Users />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    const nameInput = screen.getByDisplayValue('Test User')
    fireEvent.change(nameInput, { target: { value: 'Updated User' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          name: 'Updated User',
        })
      )
    })
  })

  it('opens delete confirmation on Delete button click', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    expect(screen.getByText('Delete User?')).toBeInTheDocument()
  })

  it('deletes user on confirmation', async () => {
    vi.mocked(api.deleteUser).mockResolvedValue(undefined)

    renderWithRouter(<Users />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(api.deleteUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('renders Edit and Key buttons for users', async () => {
    vi.mocked(api.getUsers).mockResolvedValue([mockDefaultUser])

    renderWithRouter(<Users />)

    await waitFor(() => {
      // Edit and Key buttons should be present
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Key')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('regenerates API key', async () => {
    vi.mocked(api.regenerateApiKey).mockResolvedValue({ api_key: 'new-api-key-123' })

    renderWithRouter(<Users />)

    await waitFor(() => {
      const keyButtons = screen.getAllByText('Key')
      fireEvent.click(keyButtons[0])
    })

    await waitFor(() => {
      expect(api.regenerateApiKey).toHaveBeenCalledWith('user-1')
      expect(screen.getByText('new-api-key-123')).toBeInTheDocument()
    })
  })

  it('shows copy button in API key modal', async () => {
    vi.mocked(api.regenerateApiKey).mockResolvedValue({ api_key: 'new-api-key-123' })

    renderWithRouter(<Users />)

    await waitFor(() => {
      const keyButtons = screen.getAllByText('Key')
      fireEvent.click(keyButtons[0])
    })

    await waitFor(() => {
      expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument()
    })
  })

  it('shows bot config fields when creating bot', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Bot'))
    })

    expect(screen.getByText('Bot Configuration')).toBeInTheDocument()
    expect(screen.getByText('What I can help with')).toBeInTheDocument()
  })

  it('shows generate avatar button', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Bot'))
    })

    expect(screen.getByText('Generate Avatar from Responsibilities')).toBeInTheDocument()
  })

  it('closes modals on Escape key', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add User'))
    })

    expect(screen.getByText('Add New User')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Add New User')).not.toBeInTheDocument()
    })
  })

  it('displays user avatar when available', async () => {
    vi.mocked(api.getUsers).mockResolvedValue([mockBot])

    renderWithRouter(<Users />)

    await waitFor(() => {
      const avatar = screen.getByAltText('Bot User')
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png')
    })
  })

  it('displays initials when no avatar', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getByText('TU')).toBeInTheDocument() // Test User initials
    })
  })

  it('shows View as dropdown', async () => {
    renderWithRouter(<Users />)

    await waitFor(() => {
      expect(screen.getByText('View as...')).toBeInTheDocument()
    })
  })
})
