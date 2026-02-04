import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'

// Mock the store
vi.mock('../stores/appStore', () => ({
  useAppStore: () => ({
    dashboardStats: {
      at_risk_shipments: 2,
      todays_pickups: 5,
      todays_deliveries: 3,
    },
    workItems: [
      {
        id: '1',
        title: 'Follow up on quote',
        work_type: 'quote_follow_up',
        status: 'open',
        is_overdue: false,
        priority: 80,
      },
      {
        id: '2',
        title: 'Confirm pickup',
        work_type: 'pickup_confirmation',
        status: 'in_progress',
        is_overdue: true,
        priority: 90,
      },
    ],
    loading: { workItems: false },
    fetchDashboardStats: vi.fn(),
    fetchWorkItems: vi.fn(),
  }),
}))

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard heading', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('displays stats cards', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
    expect(screen.getByText('Open Work Items')).toBeInTheDocument()
    expect(screen.getByText('At-Risk Shipments')).toBeInTheDocument()
    expect(screen.getByText("Today's Pickups")).toBeInTheDocument()
    expect(screen.getByText("Today's Deliveries")).toBeInTheDocument()
  })

  it('shows at-risk shipment count from stats', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
    // Both "Open Work Items" (2 items) and "At-Risk Shipments" (2) show "2"
    expect(screen.getAllByText('2')).toHaveLength(2)
  })

  it('displays urgent items section', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
    expect(screen.getByText('Urgent Items')).toBeInTheDocument()
    expect(screen.getByText('Follow up on quote')).toBeInTheDocument()
    expect(screen.getByText('Confirm pickup')).toBeInTheDocument()
  })

  it('shows overdue badge for overdue items', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
    expect(screen.getByText('Overdue')).toBeInTheDocument()
  })

  it('renders quick action links', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
    expect(screen.getByText('New Quote Request')).toBeInTheDocument()
    expect(screen.getByText('Dispatch Board')).toBeInTheDocument()
    expect(screen.getByText('Billing Queue')).toBeInTheDocument()
  })
})
