import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DownloadBanner from './DownloadBanner'

describe('DownloadBanner', () => {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', localStorageMock)
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when agent is connected', () => {
    const { container } = render(<DownloadBanner hasAgent={true} />)

    expect(container.firstChild).toBeNull()
  })

  it('shows banner when no agent connected', () => {
    render(<DownloadBanner hasAgent={false} />)

    expect(
      screen.getByText('Get the Desktop Agent for local file access')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Run AI tools directly on your machine with native performance')
    ).toBeInTheDocument()
  })

  it('does not show banner if previously dismissed', () => {
    // Set dismissal time to future
    localStorageMock.getItem.mockReturnValue((Date.now() + 86400000).toString())

    const { container } = render(<DownloadBanner hasAgent={false} />)

    expect(container.firstChild).toBeNull()
  })

  it('shows banner if dismissal has expired', () => {
    // Set dismissal time to past
    localStorageMock.getItem.mockReturnValue((Date.now() - 1000).toString())

    render(<DownloadBanner hasAgent={false} />)

    expect(
      screen.getByText('Get the Desktop Agent for local file access')
    ).toBeInTheDocument()
  })

  it('dismisses banner when dismiss button clicked', () => {
    render(<DownloadBanner hasAgent={false} />)

    const dismissButton = screen.getByLabelText('Dismiss')
    fireEvent.click(dismissButton)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'vibecode-download-banner-dismissed',
      expect.any(String)
    )
  })

  it('renders download link', () => {
    render(<DownloadBanner hasAgent={false} />)

    // Should have either a download or view downloads link
    const downloadLink =
      screen.queryByText(/Download for/) || screen.queryByText('View Downloads')
    expect(downloadLink).toBeInTheDocument()
  })
})
