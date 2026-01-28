import { useState, useEffect, useCallback } from 'react'

/**
 * Standard user type for the current logged-in user
 * This matches the common shape returned by Identity-integrated apps
 */
export interface CurrentUser {
  id: string
  name: string
  email: string
  role?: string
  organization_id?: string | null
  organization_name?: string | null
}

/**
 * User info formatted for the Sidebar component
 */
export interface SidebarUser {
  name: string
  role?: string
  organization?: string
}

/**
 * Hook for fetching and managing current user state
 *
 * @param fetchFn - Function that fetches the current user from the API
 * @returns Object with user state and helper functions
 *
 * @example
 * ```tsx
 * // In your Layout component
 * const { user, sidebarUser, loading, error, refetch } = useCurrentUser(
 *   () => api.get('/api/v1/users/me').then(r => r.data)
 * )
 *
 * return (
 *   <Sidebar
 *     user={sidebarUser}
 *     // ... other props
 *   />
 * )
 * ```
 */
export function useCurrentUser(fetchFn: () => Promise<CurrentUser>) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userData = await fetchFn()
      setUser(userData)
    } catch (err) {
      console.error('Failed to fetch current user:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Transform user to sidebar-compatible format
  const sidebarUser: SidebarUser | undefined = user
    ? {
        name: user.name,
        role: user.role,
        organization: user.organization_name || undefined,
      }
    : undefined

  return {
    user,
    sidebarUser,
    loading,
    error,
    refetch: fetchUser,
  }
}
