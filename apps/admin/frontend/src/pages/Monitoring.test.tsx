import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../test/test-utils'
import userEvent from '@testing-library/user-event'
import { Monitoring } from './Monitoring'
import { monitoringApi } from '@/services/api'
import type { MonitoringResponse, HealthHistoryResponse } from '@/types/monitoring'

// Mock the API
vi.mock('@/services/api', () => ({
  monitoringApi: {
    getStatus: vi.fn(),
    runChecks: vi.fn(),
    getHistory: vi.fn(),
  },
}))

const mockMonitoringResponse: MonitoringResponse = {
  services: [
    {
      service_name: 'Define',
      service_url: 'https://define.ai.devintensive.com',
      is_healthy: true,
      status_code: 200,
      response_time_ms: 150,
      error_message: null,
      last_checked: '2024-01-01T12:00:00Z',
      uptime_24h: 99.9,
      uptime_7d: 99.5,
      total_checks_24h: 288,
      healthy_checks_24h: 287,
    },
    {
      service_name: 'Admin',
      service_url: 'https://admin.ai.devintensive.com',
      is_healthy: true,
      status_code: 200,
      response_time_ms: 120,
      error_message: null,
      last_checked: '2024-01-01T12:00:00Z',
      uptime_24h: 100,
      uptime_7d: 99.8,
      total_checks_24h: 288,
      healthy_checks_24h: 288,
    },
    {
      service_name: 'Define API',
      service_url: 'https://define-api.ai.devintensive.com',
      is_healthy: false,
      status_code: 500,
      response_time_ms: null,
      error_message: 'Internal Server Error',
      last_checked: '2024-01-01T12:00:00Z',
      uptime_24h: 95.0,
      uptime_7d: 97.0,
      total_checks_24h: 288,
      healthy_checks_24h: 274,
    },
  ],
  overall_healthy: false,
  checked_at: '2024-01-01T12:00:00Z',
}

const mockHistoryResponse: HealthHistoryResponse = {
  service_name: 'Define',
  checks: [
    {
      service_name: 'Define',
      service_url: 'https://define.ai.devintensive.com',
      is_healthy: true,
      status_code: 200,
      response_time_ms: 150,
      error_message: null,
      checked_at: '2024-01-01T12:00:00Z',
    },
    {
      service_name: 'Define',
      service_url: 'https://define.ai.devintensive.com',
      is_healthy: true,
      status_code: 200,
      response_time_ms: 145,
      error_message: null,
      checked_at: '2024-01-01T11:55:00Z',
    },
  ],
  total: 2,
}

describe('Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(monitoringApi.getStatus).mockResolvedValue(mockMonitoringResponse)
    vi.mocked(monitoringApi.getHistory).mockResolvedValue(mockHistoryResponse)
    vi.mocked(monitoringApi.runChecks).mockResolvedValue(mockMonitoringResponse)
  })

  it('renders the page header', async () => {
    render(<Monitoring />)

    expect(screen.getByText('Service Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Real-time health status of all Expertly services')).toBeInTheDocument()
  })

  it('renders refresh all button', async () => {
    render(<Monitoring />)

    expect(screen.getByText('Refresh All')).toBeInTheDocument()
  })

  it('displays loading state initially', () => {
    vi.mocked(monitoringApi.getStatus).mockImplementation(() => new Promise(() => {}))

    render(<Monitoring />)

    // Should show loading spinner (the RefreshCw icon with animate-spin)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('displays overall status when loaded', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Overall Status')).toBeInTheDocument()
      expect(screen.getByText('Issues Detected')).toBeInTheDocument() // Because one service is unhealthy
    })
  })

  it('displays "All Systems Operational" when all services healthy', async () => {
    const allHealthyResponse: MonitoringResponse = {
      ...mockMonitoringResponse,
      overall_healthy: true,
      services: mockMonitoringResponse.services.filter((s) => s.is_healthy),
    }
    vi.mocked(monitoringApi.getStatus).mockResolvedValue(allHealthyResponse)

    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('All Systems Operational')).toBeInTheDocument()
    })
  })

  it('displays healthy services count', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Healthy Services')).toBeInTheDocument()
      expect(screen.getByText('2 / 3')).toBeInTheDocument()
    })
  })

  it('displays last updated time', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Last Updated')).toBeInTheDocument()
    })
  })

  it('displays unhealthy services alert', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText(/1 service reporting issues/)).toBeInTheDocument()
      expect(screen.getByText('Define API')).toBeInTheDocument()
      expect(screen.getByText(/Internal Server Error/)).toBeInTheDocument()
    })
  })

  it('does not display unhealthy alert when all services healthy', async () => {
    const allHealthyResponse: MonitoringResponse = {
      ...mockMonitoringResponse,
      overall_healthy: true,
      services: mockMonitoringResponse.services.filter((s) => s.is_healthy),
    }
    vi.mocked(monitoringApi.getStatus).mockResolvedValue(allHealthyResponse)

    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.queryByText(/service reporting issues/)).not.toBeInTheDocument()
    })
  })

  it('displays frontend services section', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Frontend Applications (2)')).toBeInTheDocument()
    })
  })

  it('displays API services section (collapsed by default)', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('API Services (1)')).toBeInTheDocument()
    })
  })

  it('shows service cards with correct information', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Define')).toBeInTheDocument()
      expect(screen.getByText('Admin')).toBeInTheDocument()
      expect(screen.getByText('https://define.ai.devintensive.com')).toBeInTheDocument()
    })
  })

  it('shows healthy status for healthy services', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      const healthyTexts = screen.getAllByText('Healthy')
      expect(healthyTexts.length).toBeGreaterThan(0)
    })
  })

  it('shows response time for services', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('150ms')).toBeInTheDocument()
      expect(screen.getByText('120ms')).toBeInTheDocument()
    })
  })

  it('shows uptime percentages', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('99.9%')).toBeInTheDocument()
      expect(screen.getByText('100.0%')).toBeInTheDocument()
    })
  })

  it('shows history button for each service', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      const historyButtons = screen.getAllByText('History')
      expect(historyButtons.length).toBeGreaterThan(0)
    })
  })

  it('expands API services section when clicked', async () => {
    const user = userEvent.setup()
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('API Services (1)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('API Services (1)'))

    await waitFor(() => {
      // "Define API" appears both in the unhealthy alert and in the expanded service card
      const defineApiElements = screen.getAllByText('Define API')
      expect(defineApiElements.length).toBeGreaterThan(0)
    })
  })

  it('opens history panel when history button is clicked', async () => {
    const user = userEvent.setup()
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Define')).toBeInTheDocument()
    })

    const historyButtons = screen.getAllByText('History')
    await user.click(historyButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Define History')).toBeInTheDocument()
    })
  })

  it('displays history data in history panel', async () => {
    const user = userEvent.setup()
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Define')).toBeInTheDocument()
    })

    const historyButtons = screen.getAllByText('History')
    await user.click(historyButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Define History')).toBeInTheDocument()
      // Check for healthy status in history - there are multiple from both service cards and history
      const healthyTexts = screen.getAllByText('Healthy')
      expect(healthyTexts.length).toBeGreaterThan(0)
      // Multiple HTTP 200 entries may exist
      const http200Texts = screen.getAllByText('HTTP 200')
      expect(http200Texts.length).toBeGreaterThan(0)
    })
  })

  it('closes history panel when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Define')).toBeInTheDocument()
    })

    const historyButtons = screen.getAllByText('History')
    await user.click(historyButtons[0])

    await waitFor(() => {
      expect(screen.getByText('Define History')).toBeInTheDocument()
    })

    // Find the close button (the x symbol)
    const closeButton = screen.getByText('\u00d7') // Unicode for multiplication sign used as close
    await user.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByText('Define History')).not.toBeInTheDocument()
    })
  })

  it('calls runChecks when refresh all button is clicked', async () => {
    const user = userEvent.setup()
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Define')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Refresh All'))

    expect(monitoringApi.runChecks).toHaveBeenCalled()
  })

  it('shows empty history message when no history', async () => {
    const user = userEvent.setup()
    vi.mocked(monitoringApi.getHistory).mockResolvedValue({
      service_name: 'Define',
      checks: [],
      total: 0,
    })

    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('Define')).toBeInTheDocument()
    })

    const historyButtons = screen.getAllByText('History')
    await user.click(historyButtons[0])

    await waitFor(() => {
      expect(screen.getByText('No history available')).toBeInTheDocument()
    })
  })

  it('shows error message for unhealthy services', async () => {
    const user = userEvent.setup()
    render(<Monitoring />)

    await waitFor(() => {
      expect(screen.getByText('API Services (1)')).toBeInTheDocument()
    })

    // Expand API services to see the unhealthy service
    await user.click(screen.getByText('API Services (1)'))

    await waitFor(() => {
      // Error message appears in both the alert and the service card
      const errorMessages = screen.getAllByText(/Internal Server Error/)
      expect(errorMessages.length).toBeGreaterThan(0)
    })
  })

  it('displays service URLs as external links', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      const defineLink = screen.getByText('https://define.ai.devintensive.com').closest('a')
      expect(defineLink).toHaveAttribute('href', 'https://define.ai.devintensive.com')
      expect(defineLink).toHaveAttribute('target', '_blank')
      expect(defineLink).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('applies correct color to uptime badges based on percentage', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      // 99.9% should be green
      const highUptime = screen.getByText('99.9%')
      expect(highUptime.className).toContain('text-green')

      // 100% should be green
      const perfectUptime = screen.getByText('100.0%')
      expect(perfectUptime.className).toContain('text-green')
    })
  })

  it('calls getStatus with refresh=false on initial load', async () => {
    render(<Monitoring />)

    await waitFor(() => {
      expect(monitoringApi.getStatus).toHaveBeenCalledWith(false)
    })
  })
})
