const SESSION_COOKIE_NAME = 'expertly_session'

/**
 * Check if the session cookie exists
 */
export function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.includes(`${SESSION_COOKIE_NAME}=`)
}

/**
 * Get the session token from the cookie
 */
export function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === SESSION_COOKIE_NAME && value) {
      return value
    }
  }
  return null
}

/**
 * Set the session cookie
 * Note: This is typically done by the Identity backend response
 * This function is for client-side fallback if needed
 */
export function setSessionCookie(
  token: string,
  domain: string,
  maxAgeSeconds: number = 30 * 24 * 60 * 60
): void {
  if (typeof document === 'undefined') return

  const secure = window.location.protocol === 'https:'
  document.cookie = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `domain=${domain}`,
    'path=/',
    `max-age=${maxAgeSeconds}`,
    secure ? 'secure' : '',
    'samesite=lax',
  ]
    .filter(Boolean)
    .join('; ')
}

/**
 * Clear the session cookie
 */
export function clearSessionCookie(domain: string = '.ai.devintensive.com'): void {
  if (typeof document === 'undefined') return

  document.cookie = [
    `${SESSION_COOKIE_NAME}=`,
    `domain=${domain}`,
    'path=/',
    'max-age=0',
    'expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ')
}
