import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Playbooks from './Playbooks'
import { api, Playbook, User, Team, Queue } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getPlaybooks: vi.fn(),
    getUsers: vi.fn(),
    getTeams: vi.fn(),
    getQueues: vi.fn(),
    createPlaybook: vi.fn(),
    updatePlaybook: vi.fn(),
    deletePlaybook: vi.fn(),
    duplicatePlaybook: vi.fn(),
  },
}))

// Mock the app store
vi.mock('../stores/appStore', () => ({
  useAppStore: () => ({
    user: {
      id: 'current-user-id',
      name: 'Current User',
      email: 'current@test.com',
    },
  }),
}))

const mockPlaybook: Playbook = {
  id: 'pb-1',
  organization_id: 'org-1',
  name: 'Test Playbook',
  description: 'A test playbook',
  steps: [],
  scope_type: 'organization',
  version: 1,
  history: [],
  is_active: true,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
}

const mockPlaybookWithSteps: Playbook = {
  ...mockPlaybook,
  id: 'pb-2',
  name: 'Playbook with Steps',
  steps: [
    {
      id: 'step-1',
      order: 1,
      title: 'First Step',
      description: 'Do this first',
      assignee_type: 'anyone',
      approval_required: false,
    },
    {
      id: 'step-2',
      order: 2,
      title: 'Second Step',
      assignee_type: 'user',
      assignee_id: 'user-1',
      approval_required: true,
      approver_type: 'team',
      approver_id: 'team-1',
    },
  ],
}

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

const mockTeam: Team = {
  id: 'team-1',
  organization_id: 'org-1',
  name: 'Test Team',
  member_ids: ['user-1'],
}

const mockQueue: Queue = {
  id: 'queue-1',
  organization_id: 'org-1',
  purpose: 'Test Queue',
  scope_type: 'organization',
  is_system: false,
  priority_default: 5,
  allow_bots: true,
  created_at: '2024-01-01T00:00:00Z',
}

describe('Playbooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getPlaybooks).mockResolvedValue([mockPlaybook])
    vi.mocked(api.getUsers).mockResolvedValue([mockUser])
    vi.mocked(api.getTeams).mockResolvedValue([mockTeam])
    vi.mocked(api.getQueues).mockResolvedValue([mockQueue])
  })

  describe('List View', () => {
    it('renders playbooks list', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Test Playbook')).toBeInTheDocument()
      })
    })

    it('shows loading state initially', () => {
      render(<Playbooks />)
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('shows empty state when no playbooks', async () => {
      vi.mocked(api.getPlaybooks).mockResolvedValue([])

      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText(/No playbooks found/)).toBeInTheDocument()
      })
    })

    it('displays step count for playbooks', async () => {
      vi.mocked(api.getPlaybooks).mockResolvedValue([mockPlaybookWithSteps])

      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument() // 2 steps
      })
    })

    it('displays scope badge correctly', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Everyone')).toBeInTheDocument()
      })
    })

    it('displays version number', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('v1')).toBeInTheDocument()
      })
    })
  })

  describe('Create Modal', () => {
    it('opens create modal on button click', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('New Playbook')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('New Playbook'))

      expect(screen.getByText('Create New Playbook')).toBeInTheDocument()
    })

    it('creates playbook on form submit', async () => {
      vi.mocked(api.createPlaybook).mockResolvedValue(mockPlaybook)

      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Playbook'))
      })

      const nameInput = screen.getByPlaceholderText(/Customer Onboarding/)
      fireEvent.change(nameInput, { target: { value: 'New Playbook' } })

      fireEvent.click(screen.getByRole('button', { name: 'Create' }))

      await waitFor(() => {
        expect(api.createPlaybook).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'New Playbook' })
        )
      })
    })

    it('closes modal on cancel', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('New Playbook'))
      })

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      await waitFor(() => {
        expect(screen.queryByText('Create New Playbook')).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode', () => {
    it('opens editor on Edit click', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Test Playbook')).toBeInTheDocument()
      })

      // Click the playbook name to open editor (or use edit button with title)
      fireEvent.click(screen.getByText('Test Playbook'))

      await waitFor(() => {
        expect(screen.getByText('Edit Playbook')).toBeInTheDocument()
      })
    })

    it('displays existing steps in editor', async () => {
      vi.mocked(api.getPlaybooks).mockResolvedValue([mockPlaybookWithSteps])

      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Playbook with Steps'))
      })

      await waitFor(() => {
        expect(screen.getByDisplayValue('First Step')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Second Step')).toBeInTheDocument()
      })
    })

    it('adds new step on button click', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Test Playbook'))
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add your first step'))
      })

      // New step has placeholder in input
      expect(screen.getByPlaceholderText('Step title...')).toBeInTheDocument()
    })

    it('shows step editor fields when expanded', async () => {
      vi.mocked(api.getPlaybooks).mockResolvedValue([mockPlaybookWithSteps])

      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Playbook with Steps'))
      })

      // Click on expand button for a step
      await waitFor(() => {
        const expandButtons = screen.getAllByTitle('Expand')
        fireEvent.click(expandButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByText('Instructions')).toBeInTheDocument()
        expect(screen.getByText('When to Perform')).toBeInTheDocument()
        expect(screen.getByText('Assign to')).toBeInTheDocument()
      })
    })

    it('saves changes on Save button click', async () => {
      vi.mocked(api.updatePlaybook).mockResolvedValue(mockPlaybook)

      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Test Playbook'))
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Save Changes'))
      })

      await waitFor(() => {
        expect(api.updatePlaybook).toHaveBeenCalled()
      })
    })

    it('returns to list on Cancel', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        fireEvent.click(screen.getByText('Test Playbook'))
      })

      await waitFor(() => {
        expect(screen.getByText('Edit Playbook')).toBeInTheDocument()
      })

      // Click the Cancel button in the header
      const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Playbooks')).toBeInTheDocument()
        expect(screen.queryByText('Edit Playbook')).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete', () => {
    it('shows delete confirmation', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Test Playbook')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('Delete playbook'))

      expect(screen.getByText('Delete Playbook?')).toBeInTheDocument()
    })

    it('deletes playbook on confirm', async () => {
      vi.mocked(api.deletePlaybook).mockResolvedValue(undefined)

      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Test Playbook')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('Delete playbook'))

      // Find the Delete button in the modal
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ })
      fireEvent.click(deleteButtons[deleteButtons.length - 1])

      await waitFor(() => {
        expect(api.deletePlaybook).toHaveBeenCalledWith('pb-1')
      })
    })
  })

  describe('Duplicate', () => {
    it('duplicates playbook on Copy click', async () => {
      vi.mocked(api.duplicatePlaybook).mockResolvedValue({
        ...mockPlaybook,
        id: 'pb-copy',
        name: 'Test Playbook (Copy)',
      })

      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Test Playbook')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('Duplicate playbook'))

      await waitFor(() => {
        expect(api.duplicatePlaybook).toHaveBeenCalledWith('pb-1')
      })
    })
  })

  describe('History', () => {
    it('shows History button when playbook has history', async () => {
      vi.mocked(api.getPlaybooks).mockResolvedValue([
        {
          ...mockPlaybook,
          history: [
            {
              version: 1,
              name: 'Original Name',
              steps: [],
              changed_at: '2024-01-14T00:00:00Z',
            },
          ],
        },
      ])

      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByTitle('View history')).toBeInTheDocument()
      })
    })

    it('does not show History button when no history', async () => {
      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByText('Test Playbook')).toBeInTheDocument()
      })

      expect(screen.queryByTitle('View history')).not.toBeInTheDocument()
    })

    it('opens history modal on click', async () => {
      vi.mocked(api.getPlaybooks).mockResolvedValue([
        {
          ...mockPlaybook,
          version: 2,
          history: [
            {
              version: 1,
              name: 'Original Name',
              steps: [],
              changed_at: '2024-01-14T00:00:00Z',
            },
          ],
        },
      ])

      render(<Playbooks />)

      await waitFor(() => {
        expect(screen.getByTitle('View history')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTitle('View history'))

      expect(screen.getByText('Version History: Test Playbook')).toBeInTheDocument()
      expect(screen.getByText('v2 (current)')).toBeInTheDocument()
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
  })
})

describe('Step Reordering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getPlaybooks).mockResolvedValue([mockPlaybookWithSteps])
    vi.mocked(api.getUsers).mockResolvedValue([mockUser])
    vi.mocked(api.getTeams).mockResolvedValue([mockTeam])
    vi.mocked(api.getQueues).mockResolvedValue([mockQueue])
  })

  it('disables move up on first step', async () => {
    render(<Playbooks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Playbook with Steps'))
    })

    // The first move up button should be disabled
    const moveUpButtons = screen.getAllByTitle('Move up')
    expect(moveUpButtons[0]).toBeDisabled()
  })

  it('disables move down on last step', async () => {
    render(<Playbooks />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('Playbook with Steps'))
    })

    // The last move down button should be disabled
    const moveDownButtons = screen.getAllByTitle('Move down')
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled()
  })
})
