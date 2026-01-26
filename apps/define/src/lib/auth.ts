import { cookies, headers } from 'next/headers';

const IDENTITY_API_URL = process.env.IDENTITY_API_URL || 'https://identity-api.ai.devintensive.com';
const SESSION_COOKIE_NAME = 'expertly_session';

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  organization_id: string;
  organization_name: string | null;
  role: string;
  avatar_url: string | null;
}

/**
 * Get the current authenticated user from the session cookie.
 * Call this from Server Components or Server Actions.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // First try to get user from headers (set by middleware)
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (userId) {
    return {
      id: userId,
      name: headersList.get('x-user-name') || '',
      email: headersList.get('x-user-email') || null,
      organization_id: headersList.get('x-organization-id') || '',
      organization_name: null,
      role: 'member',
      avatar_url: null,
    };
  }

  // Fallback: validate session directly
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const response = await fetch(`${IDENTITY_API_URL}/api/v1/auth/validate`, {
      method: 'GET',
      headers: {
        'X-Session-Token': sessionToken,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.valid || !data.user) {
      return null;
    }

    return data.user as AuthUser;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Check if the current request is authenticated.
 * Call this from Server Components or Server Actions.
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get the session token from cookies.
 * Useful for API routes that need to pass the token.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}
