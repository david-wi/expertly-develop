import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import { ErrorLogs } from './ErrorLogs'
import { errorLogsApi } from '@/services/api'
import type { ErrorLogListResponse, ErrorStatsResponse, ErrorLog } from '@/types/error_logs'

// Mock the API
vi.mock('@/services/api', () => ({
  errorLogsApi: {
    list: vi.fn(),
    getStats: vi.fn(),
    getApps: vi.fn(),
    update: vi.fn(),
  },
}))

const mockErrorLog: ErrorLog = {
  id: 'err1',
  app_name: 'test-app',
  error_message: 'Test error message',
  stack_trace: 'Error at test.js:1',
  url: 'https://test.example.com/page',
  user_id: 'user1',
  user_email: 'test@example.com',
  org_id: 'org1',
  browser_info: 'Chrome 120',
  additional_context: { key: 'value' },
  severity: 'error',
  status: 'new',
  occurred_at: '2024-01-01T12:00:00Z',
  acknowledged_at: null,
  resolved_at: null,
  created_at: '2024-01-01T12:00:00Z',
}

const mockErrorLogsResponse: ErrorLogListResponse = {
  errors: [
    mockErrorLog,
    {
      ...mockErrorLog,
      id: 'err2',
      error_message: 'Another error',
      severity: 'warning',
      status: 'acknowledged',
      occurred_at: '2024-01-02T12:00:00Z',
    },
  ],
  total: 2,
}

const mockStatsResponse: ErrorStatsResponse = {
  total: 100,
  by_app: [{ app_name: 'test-app', count: 50 }],
  by_status: [
    { status: 'new', count: 30 },
    { status: 'acknowledged', count: 40 },
    { status: 'resolved', count: 30 },
  ],
  by_severity: [
    { severity: 'error', count: 60 },
    { severity: 'warning', count: 30 },
    { severity: 'info', count: 10 },
  ],
  last_24h: 15,
  last_7d: 80,
}

const mockApps = ['test-app', 'other-app', 'admin']

describe('ErrorLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(errorLogsApi.list).mockResolvedValue(mockErrorLogsResponse)
    vi.mocked(errorLogsApi.getStats).mockResolvedValue(mockStatsResponse)
    vi.mocked(errorLogsApi.getApps).mockResolvedValue(mockApps)
  })

  it('renders the page header', async () => {
    render(<ErrorLogs />)

    expect(screen.getByText('Error Logs')).toBeInTheDocument()
    expect(screen.getByText('Centralized error tracking across all Expertly applications')).toBeInTheDocument()
  })

  it('renders auto-refresh checkbox', async () => {
    render(<ErrorLogs />)

    expect(screen.getByText('Auto-refresh')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })

  it('renders refresh button', async () => {
    render(<ErrorLogs />)

    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('displays stats cards', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Total Errors')).toBeInTheDocument()
      expect(screen.getByText('New (Unacknowledged)')).toBeInTheDocument()
      expect(screen.getByText('Last 24 Hours')).toBeInTheDocument()
      expect(screen.getByText('Last 7 Days')).toBeInTheDocument()
    })
  })

  it('displays stats values', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument() // Total
      expect(screen.getByText('30')).toBeInTheDocument() // New
      expect(screen.getByText('15')).toBeInTheDocument() // Last 24h
      expect(screen.getByText('80')).toBeInTheDocument() // Last 7d
    })
  })

  it('renders filter dropdowns', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('App')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Severity')).toBeInTheDocument()
    })
  })

  it('populates app filter with apps from API', async () => {
    render(<ErrorLogs />)

    // Wait for the app options to be populated
    await waitFor(() => {
      const options = screen.getAllByRole('option')
      const optionTexts = options.map((o) => o.textContent)
      // The apps should be loaded eventually
      expect(optionTexts).toContain('test-app')
    })
  })

  it('displays loading state', () => {
    vi.mocked(errorLogsApi.list).mockImplementation(() => new Promise(() => {}))

    render(<ErrorLogs />)

    expect(screen.getByText('Loading errors...')).toBeInTheDocument()
  })

  it('displays error table when loaded', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
      expect(screen.getByText('Another error')).toBeInTheDocument()
    })
  })

  it('displays error table headers', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      // "Error" appears in multiple places, so use getAllByText
      const errorElements = screen.getAllByText('Error')
      expect(errorElements.length).toBeGreaterThan(0)
      // The table header "Error" is rendered in uppercase via CSS
      // Check for other header texts that are unique
      expect(screen.getByText('Time')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })
  })

  it('displays empty state when no errors', async () => {
    vi.mocked(errorLogsApi.list).mockResolvedValue({ errors: [], total: 0 })

    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('No errors found')).toBeInTheDocument()
    })
  })

  it('displays severity badges', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('error')).toBeInTheDocument()
      expect(screen.getByText('warning')).toBeInTheDocument()
    })
  })

  it('displays status badges', async () => {
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('new')).toBeInTheDocument()
      expect(screen.getByText('acknowledged')).toBeInTheDocument()
    })
  })

  it('filters by app when selected', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const appSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(appSelect, 'test-app')

    expect(errorLogsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ app_name: 'test-app' })
    )
  })

  it('filters by status when selected', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const statusSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(statusSelect, 'new')

    expect(errorLogsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'new' })
    )
  })

  it('filters by severity when selected', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const severitySelect = screen.getAllByRole('combobox')[2]
    await user.selectOptions(severitySelect, 'error')

    expect(errorLogsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('clears filters when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    // Set a filter first
    const appSelect = screen.getAllByRole('combobox')[0]
    await user.selectOptions(appSelect, 'test-app')

    // Click clear filters
    const clearButton = screen.getByText('Clear filters')
    await user.click(clearButton)

    // Should have been called with reset filters
    expect(errorLogsApi.list).toHaveBeenLastCalledWith({ limit: 50, skip: 0 })
  })

  it('opens error detail modal when row is clicked', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    // Click on the error row
    const errorRow = screen.getByText('Test error message').closest('tr')
    await user.click(errorRow!)

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Error Message')).toBeInTheDocument()
      expect(screen.getByText('Stack Trace')).toBeInTheDocument()
    })
  })

  it('opens error detail modal when View button is clicked', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Error Message')).toBeInTheDocument()
    })
  })

  it('closes modal when Close button is clicked', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    // Open modal
    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Error Message')).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByText('Close')
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Error Message')).not.toBeInTheDocument()
    })
  })

  it('displays acknowledge button for new errors in modal', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument()
    })
  })

  it('displays mark resolved button for non-resolved errors in modal', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Mark Resolved')).toBeInTheDocument()
    })
  })

  it('calls update API when acknowledge is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(errorLogsApi.update).mockResolvedValue({
      ...mockErrorLog,
      status: 'acknowledged',
    })

    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Acknowledge'))

    expect(errorLogsApi.update).toHaveBeenCalledWith('err1', { status: 'acknowledged' })
  })

  it('calls update API when mark resolved is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(errorLogsApi.update).mockResolvedValue({
      ...mockErrorLog,
      status: 'resolved',
    })

    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Mark Resolved')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Mark Resolved'))

    expect(errorLogsApi.update).toHaveBeenCalledWith('err1', { status: 'resolved' })
  })

  it('displays URL in error detail modal', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    // Wait for modal to open by checking for modal-specific content
    await waitFor(() => {
      expect(screen.getByText('Error Message')).toBeInTheDocument()
    })

    // URL appears in both table and modal - look for the full URL
    const urlElements = screen.getAllByText('https://test.example.com/page')
    expect(urlElements.length).toBeGreaterThan(0)
  })

  it('displays user email in error detail modal', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Error Message')).toBeInTheDocument()
    })

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('displays browser info in error detail modal', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    const viewButtons = screen.getAllByText('View')
    await user.click(viewButtons[0])

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Error Message')).toBeInTheDocument()
    })

    expect(screen.getByText('Chrome 120')).toBeInTheDocument()
  })

  it('toggles auto-refresh when checkbox is clicked', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)

    expect(checkbox).toBeChecked()
  })

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup()
    render(<ErrorLogs />)

    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    vi.clearAllMocks()

    const refreshButton = screen.getByText('Refresh')
    await user.click(refreshButton)

    expect(errorLogsApi.list).toHaveBeenCalled()
  })
})
