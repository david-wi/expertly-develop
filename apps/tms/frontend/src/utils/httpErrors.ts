/**
 * Maps HTTP status codes to plain-English error messages.
 * Every user-facing error should include a human-readable explanation.
 */

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request was invalid. Please check your input and try again.',
  401: 'You are not logged in. Please sign in and try again.',
  403: 'You don\'t have permission to perform this action.',
  404: 'The requested resource was not found. It may have been moved or deleted.',
  408: 'The request timed out. Please try again.',
  409: 'This conflicts with an existing record. Please review and try again.',
  413: 'The file or data is too large. Please reduce the size and try again.',
  422: 'The data provided is not valid. Please check the fields and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again or contact support.',
  502: 'The server is temporarily unavailable. Please try again in a moment.',
  503: 'The service is temporarily unavailable. Please try again in a moment.',
  504: 'The server took too long to respond. Please try again.',
}

/**
 * Returns a user-friendly error message for an HTTP status code.
 * Includes the numeric code for reference alongside a plain-English explanation.
 */
export function httpErrorMessage(status: number): string {
  const message = STATUS_MESSAGES[status]
  if (message) {
    return `Error ${status}: ${message}`
  }
  if (status >= 500) {
    return `Error ${status}: A server error occurred. Please try again or contact support.`
  }
  if (status >= 400) {
    return `Error ${status}: The request could not be completed. Please try again.`
  }
  return `Unexpected response (${status}). Please try again.`
}
