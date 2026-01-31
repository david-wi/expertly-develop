import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Organization } from '../components/UserMenu'

const IDENTITY_API_URL = 'https://identity-api.ai.devintensive.com'
const DEFAULT_STORAGE_KEY = 'expertly_selected_org_id'

export interface OrganizationItem {
  id: string
  name: string
  slug?: string
  is_default?: boolean
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

  // Fetch organizations from Identity API
  useEffect(() => {
    if (skip) {
      setLoading(false)
      return
    }

    const fetchOrgs = async () => {
      try {
        const response = await fetch(`${identityApiUrl}/api/v1/organizations`, {
          credentials: 'include', // Send session cookie
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch organizations: ${response.status}`)
        }

        const data = await response.json()
        const orgs: Organization[] = (data.items || data || []).map((org: OrganizationItem) => ({
          id: org.id,
          name: org.name,
          is_default: org.is_default,
        }))

        setOrganizations(orgs)

        // If no org selected, select default or first one
        if (orgs.length > 0 && !selectedOrgId) {
          const defaultOrg = orgs.find(o => o.is_default) || orgs[0]
          setSelectedOrgId(defaultOrg.id)
          try {
            localStorage.setItem(storageKey, defaultOrg.id)
          } catch {
            // Ignore storage errors
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch organizations'))
        // Don't set loading false on error - leave UI in non-org state
      } finally {
        setLoading(false)
      }
    }

    fetchOrgs()
  }, [identityApiUrl, skip, storageKey, selectedOrgId])

  const handleOrgSwitch = useCallback((orgId: string) => {
    try {
      localStorage.setItem(storageKey, orgId)
    } catch {
      // Ignore storage errors
    }
    // Reload to refresh data with new org context
    window.location.reload()
  }, [storageKey])

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
