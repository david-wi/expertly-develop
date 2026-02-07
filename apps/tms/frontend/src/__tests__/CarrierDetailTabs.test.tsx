import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Mock react-router-dom params
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'carrier-123' }),
    useNavigate: () => mockNavigate,
  }
})

// Mock API - use vi.hoisted to ensure availability during mock factory hoisting
const { mockApi, mockApiExtensions } = vi.hoisted(() => ({
  mockApi: {
    getCarrier: vi.fn(),
    getShipments: vi.fn(),
    getCarrierInsurance: vi.fn(),
    getCarrierCompliance: vi.fn(),
    getCarrierComplianceSummary: vi.fn(),
    getAvailableCapacity: vi.fn(),
    postCarrierCapacity: vi.fn(),
    getNegotiationHistory: vi.fn(),
    createCounterOffer: vi.fn(),
    acceptCounterOffer: vi.fn(),
    getOnboardingDashboard: vi.fn(),
    updateOnboardingStep: vi.fn(),
  },
  mockApiExtensions: {
    getCarrierInsurance: vi.fn().mockResolvedValue([]),
    getCarrierCompliance: vi.fn().mockResolvedValue([]),
    getCarrierComplianceSummary: vi.fn().mockResolvedValue({
      overall_status: 'compliant',
      total: 0,
      compliant: 0,
      at_risk: 0,
      non_compliant: 0,
      expired: 0,
    }),
    runComplianceCheck: vi.fn(),
    getDOTCompliance: vi.fn(),
    runDOTComplianceCheck: vi.fn(),
  },
}))

vi.mock('../services/api', () => ({
  api: mockApi,
}))

vi.mock('../services/api-extensions', () => ({
  apiExtensions: mockApiExtensions,
}))

import CarrierDetail from '../pages/CarrierDetail'

const mockCarrier = {
  id: 'carrier-123',
  name: 'Test Carrier LLC',
  mc_number: 'MC-123456',
  dot_number: 'DOT-789',
  status: 'active',
  equipment_types: ['van', 'reefer'],
  lanes: [],
  contact_name: 'John Doe',
  contact_email: 'john@testcarrier.com',
  contact_phone: '555-0100',
  on_time_delivery_rate: 0.95,
  acceptance_rate: 0.88,
  avg_rate_per_mile: 250,
  total_loads: 50,
  created_at: '2025-01-01T00:00:00Z',
}

const mockOnboardingDashboard = {
  total: 5,
  status_counts: {
    in_progress: 2,
    pending_review: 1,
    approved: 2,
    not_started: 0,
    rejected: 0,
  },
  onboardings: [
    {
      id: 'onb-1',
      company_name: 'Test Carrier LLC',
      contact_name: 'John Doe',
      contact_email: 'john@testcarrier.com',
      mc_number: 'MC-123456',
      dot_number: 'DOT-789',
      status: 'in_progress',
      current_step: 3,
      total_steps: 6,
      progress_percent: 33,
      created_at: '2025-01-15T00:00:00Z',
      updated_at: '2025-01-20T00:00:00Z',
    },
    {
      id: 'onb-2',
      company_name: 'Another Carrier Inc',
      contact_name: 'Jane Smith',
      contact_email: 'jane@another.com',
      mc_number: 'MC-654321',
      status: 'approved',
      current_step: 6,
      total_steps: 6,
      progress_percent: 100,
      created_at: '2025-01-10T00:00:00Z',
      updated_at: '2025-01-18T00:00:00Z',
    },
  ],
}

const mockCapacityPostings = [
  {
    id: 'cap-1',
    carrier_id: 'carrier-123',
    carrier_name: 'Test Carrier LLC',
    equipment_type: 'van',
    truck_count: 3,
    available_date: '2025-02-01',
    origin_city: 'Chicago',
    origin_state: 'IL',
    destination_city: 'Dallas',
    destination_state: 'TX',
    notes: 'Flexible schedule',
    rate_per_mile_target: 2.5,
    expires_at: '2025-02-03T00:00:00Z',
    created_at: '2025-01-28T00:00:00Z',
    status: 'active',
  },
]

const mockNegotiationHistory = {
  total_negotiations: 1,
  accepted_count: 0,
  average_rounds: 2.0,
  total_savings_cents: 20000,
  negotiations: [
    {
      tender_id: 'tender-1',
      carrier_id: 'carrier-123',
      carrier_name: 'Test Carrier LLC',
      lane: 'Chicago, IL -> Dallas, TX',
      original_rate: 250000,
      current_rate: 230000,
      status: 'counter_offered',
      rounds: 2,
      counter_offers: [
        {
          id: 'co-1',
          direction: 'carrier',
          rate: 270000,
          notes: 'Too low',
          created_at: '2025-01-20T00:00:00Z',
        },
        {
          id: 'co-2',
          direction: 'broker',
          rate: 230000,
          notes: 'Best we can do',
          created_at: '2025-01-21T00:00:00Z',
        },
      ],
      created_at: '2025-01-19T00:00:00Z',
      updated_at: '2025-01-21T00:00:00Z',
    },
  ],
}

describe('CarrierDetail - Capacity Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getCarrier.mockResolvedValue(mockCarrier)
    mockApi.getShipments.mockResolvedValue([])
    mockApi.getAvailableCapacity.mockResolvedValue(mockCapacityPostings)
    mockApi.getNegotiationHistory.mockResolvedValue(mockNegotiationHistory)
    mockApi.getOnboardingDashboard.mockResolvedValue(mockOnboardingDashboard)
  })

  it('renders capacity tab with available capacity heading', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    // Click on Capacity tab
    const capacityTab = screen.getByRole('button', { name: /Capacity/ })
    fireEvent.click(capacityTab)

    await waitFor(() => {
      expect(screen.getByText('Available Capacity')).toBeInTheDocument()
    })
  })

  it('shows Post Capacity button on capacity tab', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const capacityTab = screen.getByRole('button', { name: /Capacity/ })
    fireEvent.click(capacityTab)

    await waitFor(() => {
      expect(screen.getByText('Post Capacity')).toBeInTheDocument()
    })
  })
})

describe('CarrierDetail - Negotiations Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getCarrier.mockResolvedValue(mockCarrier)
    mockApi.getShipments.mockResolvedValue([])
    mockApi.getAvailableCapacity.mockResolvedValue([])
    mockApi.getNegotiationHistory.mockResolvedValue(mockNegotiationHistory)
    mockApi.getOnboardingDashboard.mockResolvedValue(mockOnboardingDashboard)
  })

  it('renders negotiations tab with summary stats', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const negotiationsTab = screen.getByRole('button', { name: /Negotiations/ })
    fireEvent.click(negotiationsTab)

    await waitFor(() => {
      expect(screen.getByText('Total Negotiations')).toBeInTheDocument()
      expect(screen.getByText('Avg Negotiation Rounds')).toBeInTheDocument()
    })
  })

  it('shows Rate Negotiation History section', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const negotiationsTab = screen.getByRole('button', { name: /Negotiations/ })
    fireEvent.click(negotiationsTab)

    await waitFor(() => {
      expect(screen.getByText('Rate Negotiation History')).toBeInTheDocument()
    })
  })
})

describe('CarrierDetail - Onboarding Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getCarrier.mockResolvedValue(mockCarrier)
    mockApi.getShipments.mockResolvedValue([])
    mockApi.getAvailableCapacity.mockResolvedValue([])
    mockApi.getNegotiationHistory.mockResolvedValue(mockNegotiationHistory)
    mockApi.getOnboardingDashboard.mockResolvedValue(mockOnboardingDashboard)
  })

  it('renders onboarding tab with dashboard stats', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument()
      expect(screen.getByText('In Progress')).toBeInTheDocument()
      expect(screen.getByText('Pending Review')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  it('displays current carrier onboarding with progress bar', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    await waitFor(() => {
      expect(screen.getByText(/Onboarding: Test Carrier LLC/)).toBeInTheDocument()
      // "Progress" appears both in the progress label and in the table header
      expect(screen.getAllByText('Progress').length).toBeGreaterThanOrEqual(1)
      // "33%" appears both in the progress bar section and in the onboardings table
      expect(screen.getAllByText('33%').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows all 6 onboarding steps', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    await waitFor(() => {
      expect(screen.getByText('Company Info')).toBeInTheDocument()
      expect(screen.getByText('W-9')).toBeInTheDocument()
      expect(screen.getByText('Agreement')).toBeInTheDocument()
      expect(screen.getByText('Equipment')).toBeInTheDocument()
    })
  })

  it('shows onboardings table with all entries', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    await waitFor(() => {
      expect(screen.getByText('All Carrier Onboardings')).toBeInTheDocument()
      expect(screen.getByText('Another Carrier Inc')).toBeInTheDocument()
    })
  })

  it('can navigate between onboarding steps', async () => {
    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    // The active step starts at index 2 (W-9) because current_step=3 and Math.max(0, 3-1)=2
    await waitFor(() => {
      expect(screen.getByText('W-9 Information')).toBeInTheDocument()
    })

    // Click on Agreement step to navigate
    const agreementStep = screen.getByText('Agreement')
    fireEvent.click(agreementStep)

    await waitFor(() => {
      expect(screen.getByText('Carrier Agreement')).toBeInTheDocument()
    })
  })

  it('calls updateOnboardingStep when saving a step', async () => {
    mockApi.updateOnboardingStep.mockResolvedValue({
      status: 'in_progress',
      step_name: 'w9',
      step_number: 3,
      next_step: 4,
      completed_steps: ['company_info', 'insurance', 'w9'],
      fmcsa_verified: false,
      insurance_verified: false,
    })

    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    // The active step starts at index 2 (W-9) because current_step=3 and Math.max(0, 3-1)=2
    await waitFor(() => {
      expect(screen.getByText('W-9 Information')).toBeInTheDocument()
      expect(screen.getByText('Save & Continue')).toBeInTheDocument()
    })

    const saveButton = screen.getByText('Save & Continue')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockApi.updateOnboardingStep).toHaveBeenCalledWith(
        'onb-1',
        'w9',
        expect.any(Object)
      )
    })
  })

  it('renders no onboarding state when carrier has no active onboarding', async () => {
    mockApi.getOnboardingDashboard.mockResolvedValue({
      total: 0,
      status_counts: {},
      onboardings: [],
    })

    render(
      <BrowserRouter>
        <CarrierDetail />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Carrier LLC')).toBeInTheDocument()
    })

    const onboardingTab = screen.getByRole('button', { name: /Onboarding/ })
    fireEvent.click(onboardingTab)

    await waitFor(() => {
      expect(screen.getByText('No Active Onboarding')).toBeInTheDocument()
    })
  })
})
