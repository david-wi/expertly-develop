import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../services/api'

/**
 * Backlog - Redirects to Expertly Admin
 *
 * The Backlog feature has been consolidated into Expertly Admin's unified
 * idea/backlog tracking system. Organization-specific backlog items are
 * preserved via the organization_id parameter.
 *
 * Accepts ?product=<code> to pre-filter by the originating app.
 */
export default function Backlog() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function redirectToAdmin() {
      try {
        // Get current user to retrieve their organization_id
        const user = await api.getCurrentUser()
        const orgId = user.organization_id

        // Use product from URL param (passed by the originating app), fallback to 'manage'
        const product = searchParams.get('product') || 'manage'

        // Redirect to Admin work-backlog with product filter and organization_id
        const url = `https://admin.ai.devintensive.com/work-backlog?product=${product}&organization_id=${orgId}`
        window.location.href = url
      } catch (err) {
        console.error('Failed to get user for redirect:', err)
        setError('Failed to redirect. Please try again.')
        setLoading(false)
      }
    }

    redirectToAdmin()
  }, [searchParams])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500">{loading ? 'Redirecting to Expertly Admin...' : 'Loading...'}</p>
        <p className="text-sm text-gray-400 mt-2">
          Work Backlog has been consolidated for unified tracking.
        </p>
      </div>
    </div>
  )
}
