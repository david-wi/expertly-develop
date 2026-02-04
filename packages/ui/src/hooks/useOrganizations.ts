import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Organization } from '../components/UserMenu'

const IDENTITY_API_URL = 'https://identity-api.ai.devintensive.com'
const DEFAULT_STORAGE_KEY = 'expertly_selected_org_id'

export interface OrganizationItem {
  id: string
  name: string
  slug?: string
  is_default?: boolean
  role?: string
  is_primary?: boolean
}

export interface UseOrganizationsOptions {
  /** Custom storage key for selected org ID. Defaults to 'expertly_selected_org_id' */
  storageKey?: string
  /** Custom Identity API URL. Defaults to production Identity API */
  identityApiUrl?: string
  /** Skip fetching (for apps that manage orgs differently) */
  skip?: boolean
}

export interface UseOrganizationsReturn {
  /** List of organizations the user has access to */
  organizations: Organization[]
  /** Currently selected organization ID */
  selectedOrgId: string | null
  /** Current organization object */
  currentOrg: Organization | undefined
  /** Loading state */
  loading: boolean
  /** Error if fetch failed */
  error: Error | null
  /** Handler to switch organizations (reloads page) */
  handleOrgSwitch: (orgId: string) => void
  /** Config object ready to pass to createDefaultUserMenu */
  organizationsConfig: {
    items: Organization[]
    currentId: string | null
    onSwitch: (orgId: string) => void
    storageKey: string
  } | undefined
}

/**
 * Shared hook for fetching and managing organizations across all Expertly apps.
 * Fetches from Identity API and manages localStorage for selected org.
 *
 * @example
 * ```tsx
 * const { organizationsConfig } = useOrganizations()
 *
 * const userMenu = useMemo(() => createDefaultUserMenu({
 *   onLogout: handleLogout,
 *   organizations: organizationsConfig,
 * }), [handleLogout, organizationsConfig])
 * ```
 */
export function useOrganizations(options: UseOrganizationsOptions = {}): UseOrganizationsReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    identityApiUrl = IDENTITY_API_URL,
    skip = false,
  } = options

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey)
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState<Error | null>(null)

  // Fetch organizations from Identity API and sync session org with localStorage selection
  useEffect(() => {
    if (skip) {
      setLoading(false)
      return
    }

    const fetchOrgsAndSync = async () => {
      try {
        // Fetch current user to get session's organization_id
        const meResponse = await fetch(`${identityApiUrl}/api/v1/auth/me`, {
          credentials: 'include',
        })

        let sessionOrgId: string | null = null
        if (meResponse.ok) {
          const meData = await meResponse.json()
          sessionOrgId = meData.organization_id
        }

        // Fetch organizations the user has access to
        const response = await fetch(`${identityApiUrl}/api/v1/auth/me/organizations`, {
          credentials: 'include', // Send session cookie
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch organizations: ${response.status}`)
        }

        const data = await response.json()
        // Response format: { organizations: [...], is_expertly_admin: bool }
        const orgItems = data.organizations || data.items || data || []
        const orgs: Organization[] = orgItems.map((org: OrganizationItem) => ({
          id: org.id,
          name: org.name,
          is_default: org.is_primary || org.is_default,
        }))

        setOrganizations(orgs)

        // Determine which org should be selected
        let targetOrgId = selectedOrgId

        // If no org selected, select default or first one
        if (orgs.length > 0 && !targetOrgId) {
          const defaultOrg = orgs.find(o => o.is_default) || orgs[0]
          targetOrgId = defaultOrg.id
          setSelectedOrgId(targetOrgId)
          try {
            localStorage.setItem(storageKey, targetOrgId)
          } catch {
            // Ignore storage errors
          }
        }

        // If localStorage has a different org than session, sync the session
        if (targetOrgId && sessionOrgId && targetOrgId !== sessionOrgId) {
          // Verify the target org is in the list of accessible orgs
          const targetOrgValid = orgs.some(o => o.id === targetOrgId)
          if (targetOrgValid) {
            // Sync session to match localStorage selection (no reload needed, this is initial load)
            try {
              await fetch(`${identityApiUrl}/api/v1/auth/switch-organization`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ organization_id: targetOrgId }),
              })
            } catch {
              // If sync fails, clear localStorage and use session's org
              setSelectedOrgId(sessionOrgId)
              try {
                localStorage.setItem(storageKey, sessionOrgId)
              } catch {
                // Ignore storage errors
              }
            }
          } else {
            // Invalid localStorage selection, use session's org
            setSelectedOrgId(sessionOrgId)
            try {
              localStorage.setItem(storageKey, sessionOrgId)
            } catch {
              // Ignore storage errors
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch organizations'))
        // Don't set loading false on error - leave UI in non-org state
      } finally {
        setLoading(false)
      }
    }

    fetchOrgsAndSync()
  }, [identityApiUrl, skip, storageKey, selectedOrgId])

  const handleOrgSwitch = useCallback(async (orgId: string) => {
    try {
      // Call Identity API to switch organization context in session
      const response = await fetch(`${identityApiUrl}/api/v1/auth/switch-organization`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organization_id: orgId }),
      })

      if (!response.ok) {
        console.error('Failed to switch organization:', response.status)
        // Fall through to localStorage update and reload anyway
      }
    } catch (err) {
      console.error('Failed to switch organization:', err)
      // Fall through to localStorage update and reload anyway
    }

    // Update localStorage for UI state
    try {
      localStorage.setItem(storageKey, orgId)
    } catch {
      // Ignore storage errors
    }
    // Reload to refresh data with new org context
    window.location.reload()
  }, [storageKey, identityApiUrl])

  const currentOrg = useMemo(
    () => organizations.find(o => o.id === selectedOrgId),
    [organizations, selectedOrgId]
  )

  // Config object ready for createDefaultUserMenu
  const organizationsConfig = useMemo(() => {
    if (organizations.length === 0) return undefined
    return {
      items: organizations,
      currentId: selectedOrgId,
      onSwitch: handleOrgSwitch,
      storageKey,
    }
  }, [organizations, selectedOrgId, handleOrgSwitch, storageKey])

  return {
    organizations,
    selectedOrgId,
    currentOrg,
    loading,
    error,
    handleOrgSwitch,
    organizationsConfig,
  }
}
