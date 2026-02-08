/**
 * Tenant context hook for multi-tenant support.
 *
 * Reads selectedOrgId from the Layout outlet context,
 * fetches tenant settings on mount/org change, and
 * provides tenant state to consuming components.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LayoutOutletContext {
  selectedOrgId: string | null
}

export interface TenantSettings {
  id?: string
  org_id: string
  company_name?: string | null
  timezone: string
  currency: string
  date_format: string
  shipment_number_prefix: string
  auto_numbering: boolean
  default_equipment_type: string
  custom_fields: Record<string, unknown>
  branding: {
    logo_url?: string | null
    primary_color?: string
  }
  created_at?: string | null
  updated_at?: string | null
}

export interface UseTenantReturn {
  /** The currently selected organization ID (from Layout context) */
  orgId: string | null
  /** Tenant settings for the current org */
  tenantSettings: TenantSettings | null
  /** Whether tenant settings are currently loading */
  loading: boolean
  /** Error message if settings fetch failed */
  error: string | null
  /** Manually refetch tenant settings */
  refetch: () => void
}

// ---------------------------------------------------------------------------
// Local API helper (avoids importing shared api.ts)
// ---------------------------------------------------------------------------

import { httpErrorMessage } from '../utils/httpErrors'

const TENANT_API = import.meta.env.VITE_API_URL || ''

async function tenantRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${TENANT_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || httpErrorMessage(response.status))
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTenant(): UseTenantReturn {
  const context = useOutletContext<LayoutOutletContext>()
  const orgId = context?.selectedOrgId ?? null

  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the last fetched org_id to avoid redundant refetches
  const lastFetchedOrgRef = useRef<string | null | undefined>(undefined)

  const fetchSettings = useCallback(async () => {
    if (orgId === null) {
      setTenantSettings(null)
      setLoading(false)
      setError(null)
      lastFetchedOrgRef.current = null
      return
    }

    // Skip if we already fetched for this org
    if (lastFetchedOrgRef.current === orgId && tenantSettings !== null) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const headers: Record<string, string> = {}
      if (orgId) {
        headers['X-Organization-Id'] = orgId
      }

      const settings = await tenantRequest<TenantSettings>(
        '/api/v1/tenant/settings',
        { headers },
      )
      setTenantSettings(settings)
      lastFetchedOrgRef.current = orgId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tenant settings'
      setError(message)
      setTenantSettings(null)
    } finally {
      setLoading(false)
    }
  }, [orgId, tenantSettings])

  // Fetch on mount and when orgId changes
  useEffect(() => {
    // Reset cached ref when org changes so fetchSettings will re-run
    if (lastFetchedOrgRef.current !== orgId) {
      lastFetchedOrgRef.current = undefined
    }
    fetchSettings()
  }, [orgId, fetchSettings])

  const refetch = useCallback(() => {
    lastFetchedOrgRef.current = undefined
    fetchSettings()
  }, [fetchSettings])

  return {
    orgId,
    tenantSettings,
    loading,
    error,
    refetch,
  }
}

export default useTenant
