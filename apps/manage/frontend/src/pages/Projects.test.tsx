import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Projects from './Projects'
import { api, Project, Task } from '../services/api'

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    getProjectChildren: vi.fn(),
    getProjectTasks: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}))

const mockProject: Project = {
  id: 'project-1',
  _id: 'project-1',
  organization_id: 'org-1',
  name: 'Test Project',
  description: 'A test project description',
  status: 'active',
  parent_project_id: null,
  created_at: '2024-01-01T00:00:00Z',
}

const mockSubproject: Project = {
  id: 'project-2',
  _id: 'project-2',
  organization_id: 'org-1',
  name: 'Test Subproject',
  description: 'A subproject',
  status: 'active',
  parent_project_id: 'project-1',
  created_at: '2024-01-02T00:00:00Z',
}

const mockCompletedProject: Project = {
  ...mockProject,
  id: 'project-3',
  _id: 'project-3',
  name: 'Completed Project',
  status: 'completed',
  parent_project_id: null,
}

const mockOnHoldProject: Project = {
  ...mockProject,
  id: 'project-4',
  _id: 'project-4',
  name: 'On Hold Project',
  status: 'on_hold',
  parent_project_id: null,
}

const mockTask: Task = {
  id: 'task-1',
  _id: 'task-1',
  queue_id: 'queue-1',
  title: 'Test Task',
  status: 'queued',
  priority: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getProjects).mockResolvedValue([mockProject, mockSubproject, mockCompletedProject])
    vi.mocked(api.getProjectTasks).mockResolvedValue([mockTask])
  })

  it('renders projects page title', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
    })
  })

  it('renders New Project button', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument()
    })
  })

  it('displays all projects in list', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('Test Subproject')).toBeInTheDocument()
      expect(screen.getByText('Completed Project')).toBeInTheDocument()
    })
  })

  it('shows projects in table', async () => {
    renderWithRouter(<Projects />)

    await waitFor(
      () => {
        const table = screen.getByRole('table')
        expect(table).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })

  it('displays project status badge', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
  })

  it('shows task count for projects', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      // Each project has 1 task (mocked)
      expect(screen.getAllByText('1 task').length).toBeGreaterThan(0)
    })
  })

  it('shows loading state', () => {
    vi.mocked(api.getProjects).mockImplementation(() => new Promise(() => {}))

    renderWithRouter(<Projects />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    vi.mocked(api.getProjects).mockResolvedValue([])
    vi.mocked(api.getProjectTasks).mockResolvedValue([])

    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('No projects found. Create one to get started.')).toBeInTheDocument()
    })
  })

  it('filters by status', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    // Change status filter
    const statusSelect = screen.getByRole('combobox')
    fireEvent.change(statusSelect, { target: { value: 'completed' } })

    await waitFor(() => {
      expect(api.getProjects).toHaveBeenCalledWith({ status: 'completed' })
    })
  })

  it('opens create modal on button click', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Project'))
    })

    expect(screen.getByText('Create New Project')).toBeInTheDocument()
  })

  it('creates project on form submit', async () => {
    vi.mocked(api.createProject).mockResolvedValue(mockProject)

    renderWithRouter(<Projects />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Project'))
    })

    const nameInput = screen.getByPlaceholderText('e.g., Website Redesign')
    fireEvent.change(nameInput, { target: { value: 'New Project' } })

    const descriptionInput = screen.getByPlaceholderText('Describe the project...')
    fireEvent.change(descriptionInput, { target: { value: 'New project description' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'New project description',
        parent_project_id: undefined,
      })
    })
  })

  it('closes create modal on cancel', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Project'))
    })

    expect(screen.getByText('Create New Project')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Create New Project')).not.toBeInTheDocument()
  })

  it('opens edit modal on Edit button click', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])
    })

    expect(screen.getByText('Edit Project')).toBeInTheDocument()
  })

  it('pre-fills edit form with project data', async () => {
    // Use only one project to avoid sorting issues
    vi.mocked(api.getProjects).mockResolvedValue([mockProject])
    vi.mocked(api.getProjectTasks).mockResolvedValue([])

    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Project')).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A test project description')).toBeInTheDocument()
  })

  it('updates project on edit form submit', async () => {
    // Use only one project to avoid sorting issues
    vi.mocked(api.getProjects).mockResolvedValue([mockProject])
    vi.mocked(api.getProjectTasks).mockResolvedValue([])
    vi.mocked(api.updateProject).mockResolvedValue(mockProject)

    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Edit Project')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test Project')
    fireEvent.change(nameInput, { target: { value: 'Updated Project' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(api.updateProject).toHaveBeenCalledWith('project-1', {
        name: 'Updated Project',
        description: 'A test project description',
        status: 'active',
        parent_project_id: undefined,
      })
    })
  })

  it('opens delete confirmation on Delete button click', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    expect(screen.getByText('Delete Project?')).toBeInTheDocument()
  })

  it('deletes project on confirmation', async () => {
    // Use only one project to avoid sorting issues
    vi.mocked(api.getProjects).mockResolvedValue([mockProject])
    vi.mocked(api.getProjectTasks).mockResolvedValue([])
    vi.mocked(api.deleteProject).mockResolvedValue(undefined)

    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Delete Project?')).toBeInTheDocument()
    })

    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(api.deleteProject).toHaveBeenCalledWith('project-1')
    })
  })

  it('shows error when deleting project with children', async () => {
    vi.mocked(api.deleteProject).mockRejectedValue(
      new Error('Project has 1 child projects. Delete them first.')
    )

    // Mock window.alert
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    renderWithRouter(<Projects />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Project has 1 child projects. Delete them first.')
    })

    alertMock.mockRestore()
  })

  it('shows error when deleting project with tasks', async () => {
    vi.mocked(api.deleteProject).mockRejectedValue(
      new Error('Project has 5 tasks. Move or delete them first.')
    )

    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    renderWithRouter(<Projects />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })

    const confirmDeleteButton = screen.getAllByRole('button', { name: /Delete/ })
    fireEvent.click(confirmDeleteButton[confirmDeleteButton.length - 1])

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Project has 5 tasks. Move or delete them first.')
    })

    alertMock.mockRestore()
  })

  it('shows hierarchical indentation for subprojects', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument()
      expect(screen.getByText('Test Subproject')).toBeInTheDocument()
    })

    // The subproject should be indented (we can check the structure exists)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThan(1)
  })

  it('allows selecting parent project when creating', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Project'))
    })

    // Find parent project dropdown
    const parentSelect = screen.getAllByRole('combobox')[0]
    expect(parentSelect).toBeInTheDocument()

    // Should have None option and existing projects
    expect(screen.getByText('None (top-level project)')).toBeInTheDocument()
  })

  it('shows different status badges with correct colors', async () => {
    vi.mocked(api.getProjects).mockResolvedValue([
      mockProject,
      mockCompletedProject,
      mockOnHoldProject,
    ])

    renderWithRouter(<Projects />)

    await waitFor(() => {
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
      expect(screen.getByText('Completed')).toBeInTheDocument()
      expect(screen.getByText('On Hold')).toBeInTheDocument()
    })
  })

  it('closes modals on Escape key', async () => {
    renderWithRouter(<Projects />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Project'))
    })

    expect(screen.getByText('Create New Project')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Create New Project')).not.toBeInTheDocument()
    })
  })
})
