import { useEffect } from 'react'

/**
 * IdeaBacklog - Redirects to Expertly Admin
 *
 * The Idea Backlog feature has been centralized in Expertly Admin to provide
 * cross-product idea tracking with product filtering.
 */
export default function IdeaBacklog() {
  useEffect(() => {
    // Redirect to Admin with product=manage filter pre-applied
    window.location.href = 'https://admin.ai.devintensive.com/idea-backlog?product=manage'
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-gray-500">Redirecting to Expertly Admin...</p>
        <p className="text-sm text-gray-400 mt-2">
          Idea Backlog has been centralized for cross-product tracking.
        </p>
      </div>
    </div>
  )
}
