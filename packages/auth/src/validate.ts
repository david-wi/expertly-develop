import type { AuthUser, ValidateResponse } from './types'

/**
 * Validate a session token against the Identity API
 */
export async function validateSession(
  identityApiUrl: string,
  sessionToken: string
): Promise<ValidateResponse> {
  try {
    const response = await fetch(`${identityApiUrl}/api/v1/auth/validate`, {
      method: 'GET',
      headers: {
        'X-Session-Token': sessionToken,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      return { valid: false, user: null, expires_at: null }
    }

    const data = await response.json()
    return data as ValidateResponse
  } catch (error) {
    console.error('Session validation failed:', error)
    return { valid: false, user: null, expires_at: null }
  }
}

/**
 * Get current user from session
 */
export async function getCurrentUser(
  identityApiUrl: string,
  sessionToken: string
): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${identityApiUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'X-Session-Token': sessionToken,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get current user:', error)
    return null
  }
}

/**
 * Logout - invalidate session
 */
export async function logout(
  identityApiUrl: string,
  sessionToken?: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken
    }

    const response = await fetch(`${identityApiUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',
    })

    return response.ok
  } catch (error) {
    console.error('Logout failed:', error)
    return false
  }
}
