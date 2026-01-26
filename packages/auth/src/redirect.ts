const DEFAULT_IDENTITY_URL = 'https://identity.ai.devintensive.com'

/**
 * Redirect to Identity login page
 */
export function redirectToLogin(
  identityUrl: string = DEFAULT_IDENTITY_URL,
  returnUrl?: string
): void {
  if (typeof window === 'undefined') return

  const currentUrl = returnUrl || window.location.href
  const loginUrl = new URL('/login', identityUrl)
  loginUrl.searchParams.set('return_url', currentUrl)

  window.location.href = loginUrl.toString()
}

/**
 * Build login URL (without redirecting)
 */
export function buildLoginUrl(
  identityUrl: string = DEFAULT_IDENTITY_URL,
  returnUrl?: string
): string {
  const loginUrl = new URL('/login', identityUrl)
  if (returnUrl) {
    loginUrl.searchParams.set('return_url', returnUrl)
  }
  return loginUrl.toString()
}
