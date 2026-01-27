import { useEffect } from 'react'

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com'

export default function Login() {
  useEffect(() => {
    const returnUrl = encodeURIComponent(window.location.origin)
    window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Redirecting to login...</p>
    </div>
  )
}
