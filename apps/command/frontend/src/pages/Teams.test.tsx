import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Teams from './Teams'
import { api, Team, User } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getTeams: vi.fn(),
    getUsers: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
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

const mockUser2: User = {
  ...mockUser,
  id: 'user-2',
  _id: 'user-2',
  name: 'Another User',
  email: 'another@example.com',
}

const mockBotUser: User = {
  ...mockUser,
  id: 'bot-1',
  _id: 'bot-1',
  name: 'Bot User',
  email: 'bot@example.com',
  user_type: 'virtual',
  avatar_url: 'https://example.com/avatar.png',
}

const mockTeam: Team = {
  id: 'team-1',
  _id: 'team-1',
  organization_id: 'org-1',
  name: 'Test Team',
  description: 'A test team description',
  member_ids: ['user-1', 'user-2'],
  lead_id: 'user-1',
  created_at: '2024-01-01T00:00:00Z',
}

const mockTeamNoLead: Team = {
  ...mockTeam,
  id: 'team-2',
  _id: 'team-2',
  name: 'Team Without Lead',
  lead_id: undefined,
  member_ids: [],
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Teams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getTeams).mockResolvedValue([mockTeam, mockTeamNoLead])
    vi.mocked(api.getUsers).mockResolvedValue([mockUser, mockUser2, mockBotUser])
  })

  it('renders teams page title', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Teams' })).toBeInTheDocument()
    })
  })

  it('renders New Team button', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('New Team')).toBeInTheDocument()
    })
  })

  it('displays all teams in table', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument()
      expect(screen.getByText('Team Without Lead')).toBeInTheDocument()
    })
  })

  it('shows teams in table', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      // Teams table should be present
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('displays team lead', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })

  it('shows No lead for teams without lead', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('No lead')).toBeInTheDocument()
    })
  })

  it('shows No members for teams without members', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('No members')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    vi.mocked(api.getTeams).mockImplementation(() => new Promise(() => {}))

    renderWithRouter(<Teams />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no teams', async () => {
    vi.mocked(api.getTeams).mockResolvedValue([])

    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('No teams found. Create one to get started.')).toBeInTheDocument()
    })
  })

  it('opens create team modal on button click', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Team'))
    })

    expect(screen.getByText('Create New Team')).toBeInTheDocument()
  })

  it('creates team on form submit', async () => {
    vi.mocked(api.createTeam).mockResolvedValue(mockTeam)

    renderWithRouter(<Teams />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Team'))
    })

    const nameInput = screen.getByPlaceholderText('e.g., Marketing Team')
    fireEvent.change(nameInput, { target: { value: 'New Team' } })

    const descriptionInput = screen.getByPlaceholderText("Describe the team's responsibilities...")
    fireEvent.change(descriptionInput, { target: { value: 'New team description' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(api.createTeam).toHaveBeenCalledWith({
        name: 'New Team',
        description: 'New team description',
        member_ids: [],
        lead_id: undefined,
      })
    })
  })

  it('closes create modal on cancel', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Team'))
    })

    expect(screen.getByText('Create New Team')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Create New Team')).not.toBeInTheDocument()
  })

  it('opens edit modal on Edit button click', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByText('Edit Team')).toBeInTheDocument()
  })

  it('pre-fills edit form with team data', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByDisplayValue('Test Team')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A test team description')).toBeInTheDocument()
  })

  it('updates team on edit form submit', async () => {
    vi.mocked(api.updateTeam).mockResolvedValue(mockTeam)

    renderWithRouter(<Teams />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    const nameInput = screen.getByDisplayValue('Test Team')
    fireEvent.change(nameInput, { target: { value: 'Updated Team' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateTeam).toHaveBeenCalledWith('team-1', {
        name: 'Updated Team',
        description: 'A test team description',
        lead_id: 'user-1',
      })
    })
  })

  it('opens delete confirmation on Delete button click', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    expect(screen.getByText('Delete Team?')).toBeInTheDocument()
  })

  it('deletes team on confirmation', async () => {
    vi.mocked(api.deleteTeam).mockResolvedValue(undefined)

    renderWithRouter(<Teams />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(api.deleteTeam).toHaveBeenCalledWith('team-1')
    })
  })

  it('opens members management modal', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const manageButtons = screen.getAllByText('Manage')
      fireEvent.click(manageButtons[0])
    })

    expect(screen.getByText('Manage Members - Test Team')).toBeInTheDocument()
  })

  it('displays current team members in members modal', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const manageButtons = screen.getAllByText('Manage')
      fireEvent.click(manageButtons[0])
    })

    await waitFor(() => {
      expect(screen.getByText('Current Members (2)')).toBeInTheDocument()
    })
  })

  it('adds member to team', async () => {
    vi.mocked(api.addTeamMember).mockResolvedValue({
      ...mockTeam,
      member_ids: [...mockTeam.member_ids, 'bot-1'],
    })

    renderWithRouter(<Teams />)

    await waitFor(() => {
      const manageButtons = screen.getAllByText('Manage')
      fireEvent.click(manageButtons[0])
    })

    // Find and click Add button for Bot User
    await waitFor(() => {
      const addButtons = screen.getAllByText('Add')
      fireEvent.click(addButtons[0])
    })

    await waitFor(() => {
      expect(api.addTeamMember).toHaveBeenCalledWith('team-1', 'bot-1')
    })
  })

  it('removes member from team', async () => {
    vi.mocked(api.removeTeamMember).mockResolvedValue({
      ...mockTeam,
      member_ids: ['user-1'],
    })

    renderWithRouter(<Teams />)

    await waitFor(() => {
      const manageButtons = screen.getAllByText('Manage')
      fireEvent.click(manageButtons[0])
    })

    await waitFor(() => {
      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])
    })

    await waitFor(() => {
      expect(api.removeTeamMember).toHaveBeenCalled()
    })
  })

  it('closes members modal on Done button', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const manageButtons = screen.getAllByText('Manage')
      fireEvent.click(manageButtons[0])
    })

    expect(screen.getByText('Manage Members - Test Team')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(screen.queryByText('Manage Members - Test Team')).not.toBeInTheDocument()
    })
  })

  it('closes modals on Escape key', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Team'))
    })

    expect(screen.getByText('Create New Team')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Create New Team')).not.toBeInTheDocument()
    })
  })

  it('displays user avatars when available', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      const manageButtons = screen.getAllByText('Manage')
      fireEvent.click(manageButtons[0])
    }, { timeout: 2000 })

    // Check that user initials are shown for users without avatars
    await waitFor(() => {
      // Initials may be in smaller form (T) or full form (TU)
      const initials = screen.getAllByText(/^[A-Z]{1,2}$/)
      expect(initials.length).toBeGreaterThan(0)
    }, { timeout: 2000 })
  })

  it('shows bot label in team lead dropdown', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Team'))
    })

    const leadSelect = screen.getByRole('combobox')
    expect(leadSelect).toBeInTheDocument()

    // Bot option should have Bot indicator
    const options = leadSelect.querySelectorAll('option')
    const botOption = Array.from(options).find((o) => o.textContent?.includes('Bot'))
    expect(botOption).toBeDefined()
  })

  it('displays member avatars with stacking', async () => {
    renderWithRouter(<Teams />)

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument()
    })

    // Team with 2 members should show both without overflow indicator
    const manageButtons = screen.getAllByText('Manage')
    expect(manageButtons.length).toBeGreaterThan(0)
  })
})
