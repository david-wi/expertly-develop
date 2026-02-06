import { useEffect, useCallback, useRef } from 'react'

/**
 * Hook to track unsaved changes and warn users before they lose data.
 *
 * Features:
 * - Warns on browser refresh/close via beforeunload event
 * - Provides confirmClose function to wrap modal onClose handlers
 * - Tracks hasChanges state that can be passed from parent component
 *
 * Usage:
 * ```tsx
 * const { confirmClose } = useUnsavedChanges(hasChanges)
 *
 * // In modal:
 * <Modal onClose={confirmClose(handleClose)} ... />
 * ```
 */
export function useUnsavedChanges(hasChanges: boolean, message?: string) {
  const defaultMessage = message || 'You have unsaved changes. Are you sure you want to leave?'

  // Use ref to avoid stale closure in beforeunload handler
  const hasChangesRef = useRef(hasChanges)
  useEffect(() => {
    hasChangesRef.current = hasChanges
  }, [hasChanges])

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault()
        // Modern browsers ignore custom messages, but we set it anyway
        e.returnValue = defaultMessage
        return defaultMessage
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [defaultMessage])

  /**
   * Wraps an onClose handler to show confirmation if there are unsaved changes.
   * Returns a new function that checks for unsaved changes before calling the original.
   */
  const confirmClose = useCallback(
    (onClose: () => void) => {
      return () => {
        if (hasChangesRef.current) {
          const confirmed = window.confirm(defaultMessage)
          if (confirmed) {
            onClose()
          }
        } else {
          onClose()
        }
      }
    },
    [defaultMessage]
  )

  return { confirmClose, hasChanges }
}

/**
 * Helper hook to detect changes in form data compared to original data.
 * Returns true if the form data differs from the original.
 */
export function useFormChanges<T extends Record<string, unknown>>(
  formData: T,
  originalData: T | null
): boolean {
  if (!originalData) return false

  return Object.keys(formData).some((key) => {
    const formValue = formData[key]
    const originalValue = originalData[key]

    // Handle null/undefined
    if (formValue == null && originalValue == null) return false
    if (formValue == null || originalValue == null) return true

    // Handle arrays
    if (Array.isArray(formValue) && Array.isArray(originalValue)) {
      if (formValue.length !== originalValue.length) return true
      return formValue.some((v, i) => v !== originalValue[i])
    }

    // Simple comparison for primitives
    return formValue !== originalValue
  })
}
