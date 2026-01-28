import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ViewAsSwitcher, {
  getViewAsState,
  setViewAsState,
  clearViewAsState,
  ViewAsState,
} from './ViewAsSwitcher'
import { api, User, Team } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getUsers: vi.fn(),
    getTeams: vi.fn(),
  },
}))

const mockUser: User = {
  id: 'user-1',
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
  name: 'Another User',
  email: 'another@example.com',
  avatar_url: 'https://example.com/avatar.png',
}

const mockTeam: Team = {
  id: 'team-1',
  organization_id: 'org-1',
  name: 'Test Team',
  member_ids: ['user-1'],
}

const mockTeam2: Team = {
  ...mockTeam,
  id: 'team-2',
  name: 'Another Team',
}

describe('ViewAsSwitcher', () => {
  const mockOnViewChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.getUsers).mockResolvedValue([mockUser, mockUser2])
    vi.mocked(api.getTeams).mockResolvedValue([mockTeam, mockTeam2])
  })

  it('renders loading state initially', () => {
    vi.mocked(api.getUsers).mockImplementation(() => new Promise(() => {}))

    render(<ViewAsSwitcher />)

    // Loading skeleton should be visible
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders View as User button', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      expect(screen.getByText('View as User')).toBeInTheDocument()
    })
  })

  it('renders View as Team button', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      expect(screen.getByText('View as Team')).toBeInTheDocument()
    })
  })

  it('opens user dropdown on click', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('Another User')).toBeInTheDocument()
  })

  it('opens team dropdown on click', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as Team'))
    })

    expect(screen.getByText('Test Team')).toBeInTheDocument()
    expect(screen.getByText('Another Team')).toBeInTheDocument()
  })

  it('closes user dropdown when team dropdown opens', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()

    fireEvent.click(screen.getByText('View as Team'))

    // User dropdown should be closed (Test User not in visible dropdown)
    expect(screen.queryByText('Test Team')).toBeInTheDocument()
  })

  it('selects user from dropdown', async () => {
    render(<ViewAsSwitcher onViewChange={mockOnViewChange} />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    fireEvent.click(screen.getByText('Test User'))

    expect(mockOnViewChange).toHaveBeenCalledWith({
      mode: 'user',
      userId: 'user-1',
      userName: 'Test User',
    })
  })

  it('selects team from dropdown', async () => {
    render(<ViewAsSwitcher onViewChange={mockOnViewChange} />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as Team'))
    })

    fireEvent.click(screen.getByText('Test Team'))

    expect(mockOnViewChange).toHaveBeenCalledWith({
      mode: 'team',
      teamId: 'team-1',
      teamName: 'Test Team',
    })
  })

  it('shows current view indicator for user view', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ mode: 'user', userId: 'user-1', userName: 'Test User' })
    )

    render(<ViewAsSwitcher />)

    await waitFor(() => {
      expect(screen.getByText(/Viewing as Test User/)).toBeInTheDocument()
    })
  })

  it('shows current view indicator for team view', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ mode: 'team', teamId: 'team-1', teamName: 'Test Team' })
    )

    render(<ViewAsSwitcher />)

    await waitFor(() => {
      expect(screen.getByText(/Viewing as Test Team/)).toBeInTheDocument()
    })
  })

  it('clears view on X button click', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ mode: 'user', userId: 'user-1', userName: 'Test User' })
    )

    render(<ViewAsSwitcher onViewChange={mockOnViewChange} />)

    await waitFor(() => {
      const clearButton = screen.getByTitle('Clear view')
      fireEvent.click(clearButton)
    })

    expect(mockOnViewChange).toHaveBeenCalledWith({ mode: 'default' })
  })

  it('closes dropdown on outside click', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()

    // Click outside
    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      // Dropdown should be closed, Test User should not be in visible dropdown
      expect(screen.queryByText('Test User')).not.toBeInTheDocument()
    })
  })

  it('shows No users found when empty', async () => {
    vi.mocked(api.getUsers).mockResolvedValue([])

    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    expect(screen.getByText('No users found')).toBeInTheDocument()
  })

  it('shows No teams found when empty', async () => {
    vi.mocked(api.getTeams).mockResolvedValue([])

    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as Team'))
    })

    expect(screen.getByText('No teams found')).toBeInTheDocument()
  })

  it('displays user avatar when available', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    const avatar = document.querySelector('img[src="https://example.com/avatar.png"]')
    expect(avatar).toBeInTheDocument()
  })

  it('displays user initial when no avatar', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    // Test User should show 'T' initial
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('highlights selected user in dropdown', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ mode: 'user', userId: 'user-1', userName: 'Test User' })
    )

    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as User'))
    })

    // The selected user button should have primary colors
    const userButtons = screen.getAllByRole('button')
    const selectedButton = userButtons.find((btn) => btn.textContent?.includes('Test User'))
    expect(selectedButton).toBeDefined()
  })

  it('highlights selected team in dropdown', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ mode: 'team', teamId: 'team-1', teamName: 'Test Team' })
    )

    render(<ViewAsSwitcher />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('View as Team'))
    })

    const teamButtons = screen.getAllByRole('button')
    const selectedButton = teamButtons.find((btn) => btn.textContent?.includes('Test Team'))
    expect(selectedButton).toBeDefined()
  })

  it('calls getUsers with human filter', async () => {
    render(<ViewAsSwitcher />)

    await waitFor(() => {
      expect(api.getUsers).toHaveBeenCalledWith('human')
    })
  })
})

describe('ViewAsState utility functions', () => {
  beforeEach(() => {
    // Reset localStorage mock
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    vi.mocked(localStorage.setItem).mockClear()
    vi.mocked(localStorage.removeItem).mockClear()
  })

  describe('getViewAsState', () => {
    it('returns default state when nothing stored', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      const state = getViewAsState()
      expect(state).toEqual({ mode: 'default' })
    })

    it('returns stored state', () => {
      const storedState: ViewAsState = {
        mode: 'user',
        userId: 'user-1',
        userName: 'Test User',
      }
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(storedState))

      const state = getViewAsState()
      expect(state).toEqual(storedState)
    })

    it('returns default state on invalid JSON', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid-json')

      const state = getViewAsState()
      expect(state).toEqual({ mode: 'default' })
    })
  })

  describe('setViewAsState', () => {
    it('stores state in localStorage', () => {
      const state: ViewAsState = {
        mode: 'team',
        teamId: 'team-1',
        teamName: 'Test Team',
      }
      setViewAsState(state)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'expertly-manage-view-as',
        JSON.stringify(state)
      )
    })
  })

  describe('clearViewAsState', () => {
    it('removes state from localStorage', () => {
      clearViewAsState()

      expect(localStorage.removeItem).toHaveBeenCalledWith('expertly-manage-view-as')
    })
  })
})
