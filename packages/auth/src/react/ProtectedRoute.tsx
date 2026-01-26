import { type ReactNode } from 'react'
import { useAuth } from './useAuth'

interface ProtectedRouteProps {
  children: ReactNode
  /**
   * Custom loading component
   */
  loadingComponent?: ReactNode
  /**
   * Custom fallback when not authenticated (instead of redirect)
   */
  fallback?: ReactNode
}

/**
 * Route wrapper that only renders children when authenticated
 * Shows loading state while checking, redirects to login if not authenticated
 */
export function ProtectedRoute({
  children,
  loadingComponent,
  fallback,
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return loadingComponent || <DefaultLoading />
  }

  if (!isAuthenticated) {
    // If fallback is provided, show it instead of redirecting
    // (redirect happens in AuthProvider if requireAuth is true)
    return fallback || null
  }

  return <>{children}</>
}

function DefaultLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: '#94a3b8',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid #1e293b',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
        <p>Loading...</p>
      </div>
    </div>
  )
}
