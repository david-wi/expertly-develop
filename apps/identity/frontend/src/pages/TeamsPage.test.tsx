import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import TeamsPage from './TeamsPage'

// Mock the API module
vi.mock('../services/api', () => ({
  teamsApi: {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  },
  usersApi: {
    list: vi.fn(),
  },
  getOrganizationId: vi.fn(),
}))

const mockTeam = {
  id: 'team-1',
  organization_id: 'org-1',
  name: 'Engineering',
  description: 'Engineering team',
  member_count: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockTeamDetail = {
  ...mockTeam,
  members: [
    {
      id: 'member-1',
      user_id: 'user-1',
      user_name: 'John Doe',
      user_avatar_url: null,
      user_type: 'human',
      role: 'member',
      joined_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'member-2',
      user_id: 'user-2',
      user_name: 'Bot Assistant',
      user_avatar_url: null,
      user_type: 'bot',
      role: 'member',
      joined_at: '2024-01-01T00:00:00Z',
    },
  ],
}

const mockUser = {
  id: 'user-3',
  organization_id: 'org-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  user_type: 'human' as const,
  role: 'member' as const,
  is_active: true,
  is_default: false, is_expertly_admin: false,
  avatar_url: null,
  title: null,
  responsibilities: null,
  bot_config: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

describe('TeamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('No organization selected', () => {
    it('shows message to select organization', async () => {
      const { getOrganizationId } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue(null)

      render(<TeamsPage />)

      expect(screen.getByText(/please select an organization first/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /go to organizations/i })).toBeInTheDocument()
    })
  })

  describe('With organization selected', () => {
    beforeEach(async () => {
      const { getOrganizationId, teamsApi, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(teamsApi.list).mockResolvedValue([mockTeam])
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('renders teams page', async () => {
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /teams/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument()
      })
    })

    it('shows loading state', async () => {
      const { teamsApi, usersApi } = await import('../services/api')
      vi.mocked(teamsApi.list).mockImplementation(() => new Promise(() => {}))
      vi.mocked(usersApi.list).mockImplementation(() => new Promise(() => {}))

      render(<TeamsPage />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('displays list of teams', async () => {
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
        expect(screen.getByText('2 members')).toBeInTheDocument()
      })
    })

    it('shows empty state when no teams', async () => {
      const { teamsApi } = await import('../services/api')
      vi.mocked(teamsApi.list).mockResolvedValue([])

      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText(/no teams yet/i)).toBeInTheDocument()
      })
    })

    it('shows team detail when team is clicked', async () => {
      const { teamsApi } = await import('../services/api')
      vi.mocked(teamsApi.get).mockResolvedValue(mockTeamDetail)

      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()
        expect(screen.getByText('Bot Assistant')).toBeInTheDocument()
      })
    })

    it('shows select a team message when no team selected', async () => {
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText(/select a team to view details/i)).toBeInTheDocument()
      })
    })
  })

  describe('Create team', () => {
    beforeEach(async () => {
      const { getOrganizationId, teamsApi, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(teamsApi.list).mockResolvedValue([])
      vi.mocked(usersApi.list).mockResolvedValue([])
    })

    it('opens create modal when Create Team is clicked', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create team/i }))

      // Modal heading is an h3 with "Create Team" text
      expect(await screen.findByRole('heading', { name: /create team/i, level: 3 })).toBeInTheDocument()
    })

    it('closes modal on cancel', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /create team/i }))

      // Wait for modal heading
      await screen.findByRole('heading', { name: /create team/i, level: 3 })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /^create team$/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit team', () => {
    beforeEach(async () => {
      const { getOrganizationId, teamsApi, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(teamsApi.list).mockResolvedValue([mockTeam])
      vi.mocked(teamsApi.get).mockResolvedValue(mockTeamDetail)
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('opens edit modal when Edit is clicked', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^edit$/i }))

      expect(await screen.findByText(/edit team/i)).toBeInTheDocument()
    })

    it('populates form with team data', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^edit$/i }))

      await waitFor(() => {
        expect(screen.getByDisplayValue('Engineering')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Engineering team')).toBeInTheDocument()
      })
    })
  })

  describe('Delete team', () => {
    beforeEach(async () => {
      const { getOrganizationId, teamsApi, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(teamsApi.list).mockResolvedValue([mockTeam])
      vi.mocked(teamsApi.get).mockResolvedValue(mockTeamDetail)
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('shows delete confirmation when Delete is clicked', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByText(/members \(2\)/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /^delete$/i }))

      expect(await screen.findByText(/delete team\?/i)).toBeInTheDocument()
      expect(screen.getByText(/are you sure you want to delete "Engineering"/i)).toBeInTheDocument()
    })
  })

  describe('Team members', () => {
    beforeEach(async () => {
      const { getOrganizationId, teamsApi, usersApi } = await import('../services/api')
      vi.mocked(getOrganizationId).mockReturnValue('org-1')
      vi.mocked(teamsApi.list).mockResolvedValue([mockTeam])
      vi.mocked(teamsApi.get).mockResolvedValue(mockTeamDetail)
      vi.mocked(usersApi.list).mockResolvedValue([mockUser])
    })

    it('shows member type badges', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByText('Human')).toBeInTheDocument()
        expect(screen.getByText('Bot')).toBeInTheDocument()
      })
    })

    it('shows Add Member button', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument()
      })
    })

    it('shows Remove button for each member', async () => {
      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: /^remove$/i })
        expect(removeButtons).toHaveLength(2)
      })
    })

    it('shows no members message when team is empty', async () => {
      const { teamsApi } = await import('../services/api')
      vi.mocked(teamsApi.get).mockResolvedValue({ ...mockTeamDetail, members: [] })

      const user = userEvent.setup()
      render(<TeamsPage />)

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Engineering'))

      await waitFor(() => {
        expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
      })
    })
  })
})
