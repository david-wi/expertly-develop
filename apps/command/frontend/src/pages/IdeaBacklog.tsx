import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * IdeaBacklog - Redirects to Expertly Admin
 *
 * The Idea Backlog feature has been centralized in Expertly Admin to provide
 * cross-product idea tracking with product filtering.
 *
 * Accepts ?product=<code> to pre-filter by the originating app.
 */
export default function IdeaBacklog() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Use product from URL param (passed by the originating app), fallback to 'manage'
    const product = searchParams.get('product') || 'manage'
    window.location.href = `https://admin.ai.devintensive.com/idea-backlog?product=${product}`
  }, [searchParams])

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
