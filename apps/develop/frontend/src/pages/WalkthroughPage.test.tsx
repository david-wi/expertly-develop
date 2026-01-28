import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import WalkthroughPage from './WalkthroughPage'
import { projectsApi, scenariosApi, personasApi, walkthroughsApi } from '../api/client'

// Mock the API client
vi.mock('../api/client', () => ({
  projectsApi: {
    list: vi.fn(),
  },
  scenariosApi: {
    list: vi.fn(),
  },
  personasApi: {
    list: vi.fn(),
  },
  walkthroughsApi: {
    create: vi.fn(),
  },
}))

// Mock useNavigate and useSearchParams
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  }
})

describe('WalkthroughPage', () => {
  const mockProjects = {
    items: [
      {
        id: 'proj-1',
        name: 'Test Project',
        description: 'A test project',
        visibility: 'private',
        site_url: 'https://example.com',
        has_credentials: true,
        is_owner: true,
        can_edit: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'proj-2',
        name: 'Another Project',
        description: 'Another test project',
        visibility: 'team',
        site_url: null,
        has_credentials: false,
        is_owner: true,
        can_edit: true,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ],
    total: 2,
  }

  const mockScenarios = {
    items: [
      {
        id: 'scen-1',
        code: 'basic_walkthrough',
        name: 'Basic Walkthrough',
        description: 'A basic walkthrough scenario',
        scenario_template: 'Navigate to /\nCapture "Homepage"',
        default_observations: ['Check title', 'Check content'],
        is_system: true,
      },
      {
        id: 'scen-2',
        code: 'login_flow',
        name: 'Login Flow',
        description: 'Test the login flow',
        scenario_template: 'Navigate to /login\nClick .login-button\nCapture "Login form"',
        default_observations: ['Verify form fields'],
        is_system: true,
      },
    ],
    total: 2,
  }

  const mockPersonas = {
    items: [
      {
        id: 'pers-1',
        project_id: 'proj-1',
        name: 'Admin User',
        role_description: 'Administrator with full access',
        goals: ['Manage system'],
        task_types: ['admin'],
        has_credentials: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'pers-2',
        project_id: 'proj-1',
        name: 'Regular User',
        role_description: 'Standard user',
        goals: ['Use features'],
        task_types: ['user'],
        has_credentials: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 2,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.list).mockResolvedValue(mockProjects)
    vi.mocked(scenariosApi.list).mockResolvedValue(mockScenarios)
    vi.mocked(personasApi.list).mockResolvedValue(mockPersonas)
    vi.mocked(walkthroughsApi.create).mockResolvedValue({
      job_id: 'job-new',
      status: 'pending',
      message: 'Walkthrough created',
    })
  })

  describe('Header', () => {
    it('renders the page header', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByText('New Walkthrough')).toBeInTheDocument()
      expect(
        screen.getByText('Generate a visual walkthrough of your application')
      ).toBeInTheDocument()
    })

    it('renders back button', async () => {
      render(<WalkthroughPage />)

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('navigates back when back button is clicked', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      const backButton = screen.getAllByRole('button')[0]
      await user.click(backButton)

      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('Form Fields', () => {
    it('renders project dropdown', async () => {
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Project')).toBeInTheDocument()
        expect(screen.getByText('Select a project...')).toBeInTheDocument()
      })
    })

    it('renders scenario template dropdown', async () => {
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Scenario Template')).toBeInTheDocument()
        expect(screen.getByText('Custom scenario')).toBeInTheDocument()
      })
    })

    it('renders scenario steps textarea', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByText('Scenario Steps')).toBeInTheDocument()
    })

    it('renders label input', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByText('Label (optional)')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('My Visual Walkthrough')).toBeInTheDocument()
    })

    it('renders description textarea', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByText('Description (optional)')).toBeInTheDocument()
    })
  })

  describe('Project Selection', () => {
    it('displays project options', async () => {
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
        expect(screen.getByText('Another Project')).toBeInTheDocument()
      })
    })

    it('fetches personas when project is selected', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      // Find the first select (Project dropdown)
      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      await waitFor(() => {
        expect(personasApi.list).toHaveBeenCalledWith('proj-1')
      })
    })

    it('shows persona dropdown after project is selected', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      await waitFor(() => {
        expect(screen.getByText('Run as Persona')).toBeInTheDocument()
        expect(screen.getByText('No persona (default user)')).toBeInTheDocument()
      })
    })

    it('displays persona options after project is selected', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      await waitFor(() => {
        expect(screen.getByText('Admin User')).toBeInTheDocument()
        expect(screen.getByText('Regular User')).toBeInTheDocument()
      })
    })
  })

  describe('Scenario Templates', () => {
    it('displays scenario template options', async () => {
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Basic Walkthrough')).toBeInTheDocument()
        expect(screen.getByText('Login Flow')).toBeInTheDocument()
      })
    })

    it('populates scenario text when template is selected', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Basic Walkthrough')).toBeInTheDocument()
      })

      // Second select is Scenario Template
      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[1], 'basic_walkthrough')

      await waitFor(() => {
        const textareas = screen.getAllByRole('textbox')
        // Find the scenario steps textarea (first textarea)
        const scenarioTextarea = textareas.find(t =>
          t.getAttribute('placeholder')?.includes('Enter scenario steps')
        )
        expect(scenarioTextarea).toHaveValue('Navigate to /\nCapture "Homepage"')
      })
    })
  })

  describe('Form Submission', () => {
    it('disables submit button when form is invalid', async () => {
      render(<WalkthroughPage />)

      const submitButton = screen.getByRole('button', { name: /save and start/i })
      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when required fields are filled', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      const textareas = screen.getAllByRole('textbox')
      const scenarioTextarea = textareas.find(t =>
        t.getAttribute('placeholder')?.includes('Enter scenario steps')
      )
      if (scenarioTextarea) {
        await user.type(scenarioTextarea, 'Navigate to /\nCapture "Test"')
      }

      const submitButton = screen.getByRole('button', { name: /save and start/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('submits form with entered data', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      const textareas = screen.getAllByRole('textbox')
      const scenarioTextarea = textareas.find(t =>
        t.getAttribute('placeholder')?.includes('Enter scenario steps')
      )
      if (scenarioTextarea) {
        await user.type(scenarioTextarea, 'Navigate to /')
      }

      const labelInput = screen.getByPlaceholderText('My Visual Walkthrough')
      await user.type(labelInput, 'Test Walkthrough')

      const submitButton = screen.getByRole('button', { name: /save and start/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(walkthroughsApi.create).toHaveBeenCalled()
        const callArg = vi.mocked(walkthroughsApi.create).mock.calls[0][0]
        expect(callArg.project_id).toBe('proj-1')
        expect(callArg.scenario_text).toBe('Navigate to /')
        expect(callArg.label).toBe('Test Walkthrough')
      })
    })

    it('navigates to jobs page after successful submission', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      const textareas = screen.getAllByRole('textbox')
      const scenarioTextarea = textareas.find(t =>
        t.getAttribute('placeholder')?.includes('Enter scenario steps')
      )
      if (scenarioTextarea) {
        await user.type(scenarioTextarea, 'Navigate to /')
      }

      const submitButton = screen.getByRole('button', { name: /save and start/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/jobs?highlight=job-new')
      })
    })

    it('shows loading state during submission', async () => {
      const user = userEvent.setup()
      vi.mocked(walkthroughsApi.create).mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      const textareas = screen.getAllByRole('textbox')
      const scenarioTextarea = textareas.find(t =>
        t.getAttribute('placeholder')?.includes('Enter scenario steps')
      )
      if (scenarioTextarea) {
        await user.type(scenarioTextarea, 'Navigate to /')
      }

      const submitButton = screen.getByRole('button', { name: /save and start/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument()
      })
    })

    it('displays error message on submission failure', async () => {
      const user = userEvent.setup()
      vi.mocked(walkthroughsApi.create).mockRejectedValue(new Error('Network error'))

      render(<WalkthroughPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })

      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0], 'proj-1')

      const textareas = screen.getAllByRole('textbox')
      const scenarioTextarea = textareas.find(t =>
        t.getAttribute('placeholder')?.includes('Enter scenario steps')
      )
      if (scenarioTextarea) {
        await user.type(scenarioTextarea, 'Navigate to /')
      }

      const submitButton = screen.getByRole('button', { name: /save and start/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument()
      })
    })
  })

  describe('Cancel Button', () => {
    it('renders cancel button', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('navigates back when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<WalkthroughPage />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('Help Section', () => {
    it('renders scenario syntax help', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByText('Scenario Syntax')).toBeInTheDocument()
    })

    it('displays supported commands', async () => {
      render(<WalkthroughPage />)

      expect(screen.getByText(/Navigate to \/path/)).toBeInTheDocument()
      expect(screen.getByText(/Click \.selector/)).toBeInTheDocument()
      expect(screen.getByText(/Wait N seconds/)).toBeInTheDocument()
      expect(screen.getByText(/Capture "Description"/)).toBeInTheDocument()
    })
  })
})
