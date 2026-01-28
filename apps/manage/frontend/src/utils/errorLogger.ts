/**
 * Centralized error logging utility for Expertly apps.
 *
 * Sends errors to the Admin app's error logging endpoint for centralized
 * tracking and debugging.
 */

// Admin API URL for error logging endpoint
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || 'https://admin-api.ai.devintensive.com'

export type ErrorSeverity = 'info' | 'warning' | 'error'

export interface ErrorLogContext {
  /** URL/page where the error occurred */
  url?: string
  /** Component name where error originated */
  component?: string
  /** Action being performed when error occurred */
  action?: string
  /** Any additional context data */
  additionalContext?: Record<string, unknown>
  /** Error severity level */
  severity?: ErrorSeverity
}

export interface ErrorLogPayload {
  app_name: string
  error_message: string
  stack_trace?: string
  url?: string
  user_id?: string
  user_email?: string
  org_id?: string
  browser_info?: string
  additional_context?: Record<string, unknown>
  severity: ErrorSeverity
  occurred_at: string
}

/**
 * Get browser info string
 */
function getBrowserInfo(): string {
  const ua = navigator.userAgent
  const screen = `${window.screen.width}x${window.screen.height}`
  return `${ua} | Screen: ${screen}`
}

/**
 * Get current user info from the app store if available
 */
function getUserInfo(): { user_id?: string; user_email?: string; org_id?: string } {
  try {
    // Try to get user info from localStorage (common pattern) or app store
    const storedUser = localStorage.getItem('expertly_user')
    if (storedUser) {
      const user = JSON.parse(storedUser)
      return {
        user_id: user.id,
        user_email: user.email,
        org_id: user.organization_id,
      }
    }
  } catch {
    // Ignore errors getting user info
  }
  return {}
}

/**
 * Log an error to the centralized error logging system.
 *
 * This function is designed to never throw - it will silently fail if the
 * logging endpoint is unavailable, to avoid cascading errors.
 *
 * @param error - The error object or error message
 * @param context - Additional context about where/how the error occurred
 *
 * @example
 * ```ts
 * try {
 *   await api.createPlaybook(data)
 * } catch (error) {
 *   logError(error, {
 *     component: 'Playbooks',
 *     action: 'createPlaybook',
 *     additionalContext: { playbookName: data.name }
 *   })
 *   // Show user-friendly error message
 *   setError('Failed to create playbook')
 * }
 * ```
 */
export async function logError(
  error: Error | string | unknown,
  context: ErrorLogContext = {}
): Promise<void> {
  try {
    // Extract error message and stack trace
    let errorMessage: string
    let stackTrace: string | undefined

    if (error instanceof Error) {
      errorMessage = error.message
      stackTrace = error.stack
    } else if (typeof error === 'string') {
      errorMessage = error
    } else {
      errorMessage = String(error)
    }

    // Build the payload
    const userInfo = getUserInfo()
    const payload: ErrorLogPayload = {
      app_name: 'manage',
      error_message: errorMessage,
      stack_trace: stackTrace,
      url: context.url || window.location.href,
      user_id: userInfo.user_id,
      user_email: userInfo.user_email,
      org_id: userInfo.org_id,
      browser_info: getBrowserInfo(),
      additional_context: {
        ...context.additionalContext,
        component: context.component,
        action: context.action,
      },
      severity: context.severity || 'error',
      occurred_at: new Date().toISOString(),
    }

    // Send to admin API (fire and forget - don't block on response)
    fetch(`${ADMIN_API_URL}/api/error-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently ignore any errors from the logging endpoint
      // We don't want error logging to cause more errors
    })

    // Also log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorLogger]', errorMessage, context)
    }
  } catch {
    // Never throw from error logging
    console.error('[ErrorLogger] Failed to log error:', error)
  }
}

/**
 * Create an error logger scoped to a specific component.
 *
 * @param component - The component name to include in all logged errors
 *
 * @example
 * ```ts
 * const logger = createErrorLogger('Playbooks')
 *
 * try {
 *   await api.createPlaybook(data)
 * } catch (error) {
 *   logger.error(error, { action: 'createPlaybook' })
 * }
 * ```
 */
export function createErrorLogger(component: string) {
  return {
    error: (error: Error | string | unknown, context: Omit<ErrorLogContext, 'component' | 'severity'> = {}) =>
      logError(error, { ...context, component, severity: 'error' }),

    warn: (error: Error | string | unknown, context: Omit<ErrorLogContext, 'component' | 'severity'> = {}) =>
      logError(error, { ...context, component, severity: 'warning' }),

    info: (error: Error | string | unknown, context: Omit<ErrorLogContext, 'component' | 'severity'> = {}) =>
      logError(error, { ...context, component, severity: 'info' }),
  }
}

export default logError
