import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import { VersionHistory } from './VersionHistory'
import { themesApi } from '@/services/api'
import type { ThemeVersionListResponse } from '@/types/theme'

// Mock the API
vi.mock('@/services/api', () => ({
  themesApi: {
    getVersions: vi.fn(),
    restoreVersion: vi.fn(),
  },
}))

const mockVersionsResponse: ThemeVersionListResponse = {
  versions: [
    {
      id: 'v3',
      version_number: 3,
      snapshot: {} as ThemeVersionListResponse['versions'][0]['snapshot'],
      change_summary: 'Updated colors',
      changed_by: 'admin',
      changed_at: '2024-01-03T00:00:00Z',
      status: 'active',
    },
    {
      id: 'v2',
      version_number: 2,
      snapshot: {} as ThemeVersionListResponse['versions'][0]['snapshot'],
      change_summary: 'Changed primary color',
      changed_by: 'user1',
      changed_at: '2024-01-02T00:00:00Z',
      status: 'superseded',
    },
    {
      id: 'v1',
      version_number: 1,
      snapshot: {} as ThemeVersionListResponse['versions'][0]['snapshot'],
      change_summary: 'Initial version',
      changed_by: 'admin',
      changed_at: '2024-01-01T00:00:00Z',
      status: 'superseded',
    },
  ],
  total: 3,
}

describe('VersionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders version history title', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    expect(screen.getByText('Version History')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    vi.mocked(themesApi.getVersions).mockImplementation(() => new Promise(() => {}))

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays version numbers', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      expect(screen.getByText('v3')).toBeInTheDocument()
      expect(screen.getByText('v2')).toBeInTheDocument()
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
  })

  it('displays change summaries', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      expect(screen.getByText('Updated colors')).toBeInTheDocument()
      expect(screen.getByText('Changed primary color')).toBeInTheDocument()
      expect(screen.getByText('Initial version')).toBeInTheDocument()
    })
  })

  it('marks current version with "Current" badge', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      expect(screen.getByText('Current')).toBeInTheDocument()
    })
  })

  it('shows restore button for non-current versions', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      // Should have 2 restore buttons (for v2 and v1)
      const restoreButtons = screen.getAllByTitle('Restore this version')
      expect(restoreButtons).toHaveLength(2)
    })
  })

  it('does not show restore button for current version', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      // Find the v3 entry and verify it doesn't have a restore button
      const currentVersionEntry = screen.getByText('v3').closest('div')
      expect(currentVersionEntry?.querySelector('[title="Restore this version"]')).not.toBeInTheDocument()
    })
  })

  it('shows "No version history" when empty', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue({ versions: [], total: 0 })

    render(<VersionHistory themeId="theme-1" currentVersion={1} />)

    await waitFor(() => {
      expect(screen.getByText('No version history')).toBeInTheDocument()
    })
  })

  it('displays changed_by information', async () => {
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      // Multiple versions may have "by admin", so use getAllByText
      const adminTexts = screen.getAllByText(/by admin/)
      expect(adminTexts.length).toBeGreaterThan(0)
      expect(screen.getByText(/by user1/)).toBeInTheDocument()
    })
  })

  it('calls restoreVersion on restore button click with confirm', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)
    vi.mocked(themesApi.restoreVersion).mockResolvedValue({} as any)

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      expect(screen.getAllByTitle('Restore this version')).toHaveLength(2)
    })

    const restoreButtons = screen.getAllByTitle('Restore this version')
    await user.click(restoreButtons[0])

    expect(confirmSpy).toHaveBeenCalledWith('Restore to version 2? This will create a new version with that snapshot.')
    expect(themesApi.restoreVersion).toHaveBeenCalledWith('theme-1', 'v2', 'admin')

    confirmSpy.mockRestore()
  })

  it('does not call restoreVersion when confirm is cancelled', async () => {
    const user = userEvent.setup()
    vi.mocked(themesApi.getVersions).mockResolvedValue(mockVersionsResponse)

    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<VersionHistory themeId="theme-1" currentVersion={3} />)

    await waitFor(() => {
      expect(screen.getAllByTitle('Restore this version')).toHaveLength(2)
    })

    const restoreButtons = screen.getAllByTitle('Restore this version')
    await user.click(restoreButtons[0])

    expect(confirmSpy).toHaveBeenCalled()
    expect(themesApi.restoreVersion).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('handles versions without change_summary', async () => {
    const versionsWithoutSummary: ThemeVersionListResponse = {
      versions: [
        {
          id: 'v1',
          version_number: 1,
          snapshot: {} as any,
          change_summary: null,
          changed_by: 'admin',
          changed_at: '2024-01-01T00:00:00Z',
          status: 'active',
        },
      ],
      total: 1,
    }
    vi.mocked(themesApi.getVersions).mockResolvedValue(versionsWithoutSummary)

    render(<VersionHistory themeId="theme-1" currentVersion={1} />)

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
  })

  it('handles versions without changed_by', async () => {
    const versionsWithoutChangedBy: ThemeVersionListResponse = {
      versions: [
        {
          id: 'v1',
          version_number: 1,
          snapshot: {} as any,
          change_summary: 'Test',
          changed_by: null,
          changed_at: '2024-01-01T00:00:00Z',
          status: 'active',
        },
      ],
      total: 1,
    }
    vi.mocked(themesApi.getVersions).mockResolvedValue(versionsWithoutChangedBy)

    render(<VersionHistory themeId="theme-1" currentVersion={1} />)

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
      // Should not show "by" when changed_by is null
      expect(screen.queryByText(/by/)).not.toBeInTheDocument()
    })
  })
})
