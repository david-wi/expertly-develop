import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, X } from 'lucide-react'

export interface VersionInfo {
  commit: string
  timestamp: number
  branch?: string
}

export interface VersionCheckerProps {
  /** Current app's git commit SHA (from build-time env var) */
  currentCommit?: string
  /** Current app's build timestamp (from build-time env var) */
  currentBuildTime?: number
  /** URL to fetch latest version info from (defaults to UI remote) */
  versionUrl?: string
  /** Minutes to wait before showing alert (default: 10) */
  safeMinutes?: number
  /** Check interval in milliseconds (default: 5 minutes) */
  checkIntervalMs?: number
  /** Callback when refresh is clicked */
  onRefresh?: () => void
}

const DEFAULT_SAFE_MINUTES = 10
const DEFAULT_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_VERSION_URL = 'https://ui.ai.devintensive.com/version.json'

export function VersionChecker({
  currentCommit,
  currentBuildTime: _currentBuildTime,
  versionUrl = DEFAULT_VERSION_URL,
  safeMinutes = DEFAULT_SAFE_MINUTES,
  checkIntervalMs = DEFAULT_CHECK_INTERVAL_MS,
  onRefresh,
}: VersionCheckerProps) {
  const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [lastDismissedCommit, setLastDismissedCommit] = useState<string | null>(null)

  const checkVersion = useCallback(async () => {
    if (!currentCommit) return

    try {
      const response = await fetch(versionUrl, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (!response.ok) return

      const data: VersionInfo = await response.json()
      setLatestVersion(data)

      // Check if we're behind
      if (data.commit && data.commit !== currentCommit) {
        const now = Date.now()
        const commitAge = now - data.timestamp
        const safeMs = safeMinutes * 60 * 1000

        // Only show if the new version is older than the safe window
        // (meaning deployment should have completed by now)
        if (commitAge > safeMs) {
          // Don't show if user dismissed this specific commit
          if (lastDismissedCommit !== data.commit) {
            setShowBanner(true)
            setDismissed(false)
          }
        }
      } else {
        // We're up to date
        setShowBanner(false)
      }
    } catch (error) {
      // Silently fail - don't bother users if version check fails
      console.debug('Version check failed:', error)
    }
  }, [currentCommit, versionUrl, safeMinutes, lastDismissedCommit])

  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(checkVersion, 5000)

    // Periodic checks
    const interval = setInterval(checkVersion, checkIntervalMs)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [checkVersion, checkIntervalMs])

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh()
    } else {
      window.location.reload()
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowBanner(false)
    if (latestVersion?.commit) {
      setLastDismissedCommit(latestVersion.commit)
    }
  }

  if (!showBanner || dismissed || !currentCommit) {
    return null
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-800 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>A newer version is available</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="px-2 py-1 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Helper to get version info from Vite environment variables.
 * Apps should call this and pass the result to VersionChecker.
 *
 * Expected env vars (set at build time):
 * - VITE_GIT_COMMIT: Git commit SHA
 * - VITE_BUILD_TIME: Unix timestamp of build
 */
export function getVersionFromEnv(): { commit?: string; buildTime?: number } {
  // These will be replaced at build time by Vite
  const commit = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_GIT_COMMIT as string | undefined)
    : undefined
  const buildTimeStr = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_BUILD_TIME as string | undefined)
    : undefined

  return {
    commit: commit || undefined,
    buildTime: buildTimeStr ? parseInt(buildTimeStr, 10) : undefined,
  }
}
