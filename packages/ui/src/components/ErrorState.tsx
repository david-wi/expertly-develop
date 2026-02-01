import { AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '../utils/cn'

export interface ErrorStateProps {
  /** Optional title displayed above the message */
  title?: string
  /** The error message to display */
  message: string
  /** Optional callback for retry functionality */
  onRetry?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * ErrorState component for displaying error messages with optional retry.
 *
 * Use this component to show users when something went wrong, replacing
 * empty states or loading spinners after an error occurs.
 *
 * @example
 * ```tsx
 * {error ? (
 *   <ErrorState
 *     title="Unable to load products"
 *     message={error}
 *     onRetry={fetchProducts}
 *   />
 * ) : (
 *   <ProductGrid products={products} />
 * )}
 * ```
 */
export function ErrorState({ title, message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 max-w-md">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="text-left">
          {title && <p className="font-medium mb-1">{title}</p>}
          <p className="text-sm">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try again
        </button>
      )}
    </div>
  )
}
