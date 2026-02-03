import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { StatsOverviewWidget } from './StatsOverviewWidget'
import { MyActiveTasksWidget } from './MyActiveTasksWidget'
import { MyQueuesWidget } from './MyQueuesWidget'
import { MonitorsSummaryWidget } from './MonitorsSummaryWidget'
import { useAppStore } from '../../../stores/appStore'
import { useDashboardStore } from '../../../stores/dashboardStore'

vi.mock('../../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}))

vi.mock('../../../stores/dashboardStore', () => ({
  useDashboardStore: vi.fn(),
}))

vi.mock('../../../services/api', () => ({
  api: {
    getUsers: vi.fn(() => Promise.resolve([])),
    getTeams: vi.fn(() => Promise.resolve([])),
    getMonitorStats: vi.fn(() => Promise.resolve({ total: 0 })),
    getPlaybooks: vi.fn(() => Promise.resolve([])),
    getProjects: vi.fn(() => Promise.resolve([])),
  },
}))

const mockWidgetProps = {
  widgetId: 'test-widget',
  layout: { w: 12, h: 4 },
  config: {},
}

const mockAppStoreDefault = {
  user: { id: 'user-1', name: 'Test User' },
  tasks: [],
  queues: [],
  loading: { tasks: false, queues: false },
}

describe('Widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppStore).mockReturnValue(mockAppStoreDefault as ReturnType<typeof useAppStore>)
    vi.mocked(useDashboardStore).mockReturnValue({
      editMode: false,
      removeWidget: vi.fn(),
    } as unknown as ReturnType<typeof useDashboardStore>)
  })

  describe('StatsOverviewWidget', () => {
    it('renders overview title', () => {
      render(
        <BrowserRouter>
          <StatsOverviewWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    it('displays active tasks count', () => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockAppStoreDefault,
        tasks: [
          { id: '1', status: 'queued' },
          { id: '2', status: 'in_progress' },
          { id: '3', status: 'completed', updated_at: new Date().toISOString() },
        ],
      } as ReturnType<typeof useAppStore>)

      render(
        <BrowserRouter>
          <StatsOverviewWidget {...mockWidgetProps} />
        </BrowserRouter>
      )

      expect(screen.getByText('Active Tasks')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // 2 active (queued + in_progress)
    })

    it('displays completed today count', () => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockAppStoreDefault,
        tasks: [
          { id: '1', status: 'completed', updated_at: new Date().toISOString() },
        ],
      } as ReturnType<typeof useAppStore>)

      render(
        <BrowserRouter>
          <StatsOverviewWidget {...mockWidgetProps} />
        </BrowserRouter>
      )

      expect(screen.getByText('Completed Today')).toBeInTheDocument()
      // Total tasks is also 1, so use getAllByText
      expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    })
  })

  describe('MyActiveTasksWidget', () => {
    it('renders widget title', () => {
      render(
        <BrowserRouter>
          <MyActiveTasksWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('My Active Tasks')).toBeInTheDocument()
    })

    it('shows loading state', () => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockAppStoreDefault,
        loading: { tasks: true, queues: false },
      } as ReturnType<typeof useAppStore>)

      render(
        <BrowserRouter>
          <MyActiveTasksWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('shows empty state when no active tasks', () => {
      render(
        <BrowserRouter>
          <MyActiveTasksWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('No active tasks')).toBeInTheDocument()
    })

    it('displays All filter button', () => {
      render(
        <BrowserRouter>
          <MyActiveTasksWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('All (0)')).toBeInTheDocument()
    })

    it('clears selected task when focusing on add task input', async () => {
      const { fireEvent } = await import('@testing-library/react')
      vi.mocked(useAppStore).mockReturnValue({
        ...mockAppStoreDefault,
        tasks: [
          { id: '1', _id: '1', title: 'Task 1', status: 'queued', queue_id: 'q1', created_at: new Date().toISOString() },
        ],
        queues: [
          { id: 'q1', _id: 'q1', purpose: 'My Tasks', scope_type: 'user', scope_id: 'user-1' },
        ],
        fetchTasks: vi.fn(),
      } as unknown as ReturnType<typeof useAppStore>)

      render(
        <BrowserRouter>
          <MyActiveTasksWidget {...mockWidgetProps} />
        </BrowserRouter>
      )

      // Click on task to select it (opens edit panel)
      const task = screen.getByText('Task 1')
      fireEvent.click(task)

      // Edit panel should be visible
      expect(screen.getByPlaceholderText('Task title')).toBeInTheDocument()

      // Focus on "Add task..." input should close the edit panel
      const addTaskInput = screen.getByPlaceholderText('Add task...')
      fireEvent.focus(addTaskInput)

      // Edit panel should no longer show the task title input
      expect(screen.queryByPlaceholderText('Task title')).not.toBeInTheDocument()
    })
  })

  describe('MyQueuesWidget', () => {
    it('renders widget title', () => {
      render(
        <BrowserRouter>
          <MyQueuesWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('Queues')).toBeInTheDocument()
    })

    it('shows loading state', () => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockAppStoreDefault,
        loading: { tasks: false, queues: true },
      } as ReturnType<typeof useAppStore>)

      render(
        <BrowserRouter>
          <MyQueuesWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('shows empty state when no queues', () => {
      render(
        <BrowserRouter>
          <MyQueuesWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('No queues found')).toBeInTheDocument()
    })

    it('displays queue with Everyone scope label for org queues', () => {
      vi.mocked(useAppStore).mockReturnValue({
        ...mockAppStoreDefault,
        queues: [
          { id: 'q1', purpose: 'Test Queue', scope_type: 'organization' },
        ],
      } as ReturnType<typeof useAppStore>)

      render(
        <BrowserRouter>
          <MyQueuesWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('Test Queue')).toBeInTheDocument()
      expect(screen.getByText('Everyone')).toBeInTheDocument()
    })
  })

  describe('MonitorsSummaryWidget', () => {
    it('renders widget title', () => {
      render(
        <BrowserRouter>
          <MonitorsSummaryWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      expect(screen.getByText('Monitors')).toBeInTheDocument()
    })

    it('shows empty state when no monitors', async () => {
      render(
        <BrowserRouter>
          <MonitorsSummaryWidget {...mockWidgetProps} />
        </BrowserRouter>
      )
      // Wait for the async effect
      expect(await screen.findByText('No monitors configured')).toBeInTheDocument()
    })
  })
})
