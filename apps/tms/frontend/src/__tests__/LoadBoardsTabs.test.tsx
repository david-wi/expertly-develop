import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

// Mock the API with vi.hoisted to avoid hoisting issues
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getLoadBoardPostings: vi.fn(),
    searchLoadBoardCarriers: vi.fn(),
    getMarketRates: vi.fn(),
    getSpotRates: vi.fn(),
    getRateTrends: vi.fn(),
    datPostLoad: vi.fn(),
    datSearchCarriers: vi.fn(),
    datRateLookup: vi.fn(),
    truckstopPostLoad: vi.fn(),
    truckstopSearch: vi.fn(),
    truckstopRates: vi.fn(),
  },
}))

vi.mock('../services/api', () => ({
  api: mockApi,
}))

import LoadBoards from '../pages/LoadBoards'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    )
  }
}

describe('LoadBoards - Spot Market Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getLoadBoardPostings.mockResolvedValue([])
  })

  it('renders spot market tab with form fields', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const spotTab = screen.getByText('Spot vs Contract')
    fireEvent.click(spotTab)

    await waitFor(() => {
      expect(screen.getByText('Spot vs Contract Rate Comparison')).toBeInTheDocument()
      expect(screen.getByText('Origin City')).toBeInTheDocument()
      expect(screen.getByText('Origin State')).toBeInTheDocument()
      expect(screen.getByText('Dest City')).toBeInTheDocument()
    })
  })

  it('has a Compare Rates button', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const spotTab = screen.getByText('Spot vs Contract')
    fireEvent.click(spotTab)

    await waitFor(() => {
      expect(screen.getByText('Compare Rates')).toBeInTheDocument()
    })
  })

  it('shows description text', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const spotTab = screen.getByText('Spot vs Contract')
    fireEvent.click(spotTab)

    await waitFor(() => {
      expect(screen.getByText('Compare real-time spot market rates against your contract rates')).toBeInTheDocument()
    })
  })
})

describe('LoadBoards - DAT Integration Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getLoadBoardPostings.mockResolvedValue([])
  })

  it('renders DAT integration tab with header', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const datTab = screen.getByText('DAT')
    fireEvent.click(datTab)

    await waitFor(() => {
      expect(screen.getByText('DAT Power Integration')).toBeInTheDocument()
    })
  })

  it('shows Post Load to DAT section', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const datTab = screen.getByText('DAT')
    fireEvent.click(datTab)

    await waitFor(() => {
      expect(screen.getByText('Post Load to DAT')).toBeInTheDocument()
      expect(screen.getByText('Post to DAT')).toBeInTheDocument()
    })
  })

  it('shows Search DAT Carriers section', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const datTab = screen.getByText('DAT')
    fireEvent.click(datTab)

    await waitFor(() => {
      expect(screen.getByText('Search DAT Carriers')).toBeInTheDocument()
    })
  })
})

describe('LoadBoards - Truckstop Integration Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getLoadBoardPostings.mockResolvedValue([])
  })

  it('renders Truckstop integration tab with header', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const truckstopTab = screen.getByText('Truckstop')
    fireEvent.click(truckstopTab)

    await waitFor(() => {
      expect(screen.getByText('Truckstop.com Integration')).toBeInTheDocument()
    })
  })

  it('shows Post Load to Truckstop section', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const truckstopTab = screen.getByText('Truckstop')
    fireEvent.click(truckstopTab)

    await waitFor(() => {
      expect(screen.getByText('Post Load to Truckstop')).toBeInTheDocument()
      expect(screen.getByText('Post to Truckstop')).toBeInTheDocument()
    })
  })

  it('shows description text', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    const truckstopTab = screen.getByText('Truckstop')
    fireEvent.click(truckstopTab)

    await waitFor(() => {
      expect(screen.getByText('Post loads, search carriers, and get rate data from Truckstop')).toBeInTheDocument()
    })
  })
})

describe('LoadBoards - Tab Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.getLoadBoardPostings.mockResolvedValue([])
  })

  it('renders all tab buttons', () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    expect(screen.getByText('My Postings')).toBeInTheDocument()
    expect(screen.getByText('Find Carriers')).toBeInTheDocument()
    expect(screen.getByText('Market Rates')).toBeInTheDocument()
    expect(screen.getByText('Spot vs Contract')).toBeInTheDocument()
    expect(screen.getByText('DAT')).toBeInTheDocument()
    expect(screen.getByText('Truckstop')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('switches between tabs correctly', async () => {
    render(<LoadBoards />, { wrapper: createWrapper() })

    // Click Spot Market tab
    fireEvent.click(screen.getByText('Spot vs Contract'))
    await waitFor(() => {
      expect(screen.getByText('Spot vs Contract Rate Comparison')).toBeInTheDocument()
    })

    // Click DAT tab
    fireEvent.click(screen.getByText('DAT'))
    await waitFor(() => {
      expect(screen.getByText('DAT Power Integration')).toBeInTheDocument()
    })

    // Click Truckstop tab
    fireEvent.click(screen.getByText('Truckstop'))
    await waitFor(() => {
      expect(screen.getByText('Truckstop.com Integration')).toBeInTheDocument()
    })
  })
})
