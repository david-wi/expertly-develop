import { useEffect, useState } from 'react'
import { api } from '../services/api'

/**
 * Backlog - Redirects to Expertly Admin
 *
 * The Backlog feature has been consolidated into Expertly Admin's unified
 * idea/backlog tracking system. Organization-specific backlog items are
 * preserved via the organization_id parameter.
 */
export default function Backlog() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function redirectToAdmin() {
      try {
        // Get current user to retrieve their organization_id
        const user = await api.getCurrentUser()
        const orgId = user.organization_id

        // Redirect to Admin with product=manage and organization_id for org-specific backlog
        const url = `https://admin.ai.devintensive.com/idea-backlog?product=manage&organization_id=${orgId}`
        window.location.href = url
      } catch (err) {
        console.error('Failed to get user for redirect:', err)
        setError('Failed to redirect. Please try again.')
        setLoading(false)
      }
    }

    redirectToAdmin()
  }, [])

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
