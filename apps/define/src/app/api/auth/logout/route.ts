import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const IDENTITY_API_URL = process.env.IDENTITY_API_URL || 'https://identity-api.ai.devintensive.com';
const IDENTITY_URL = process.env.IDENTITY_URL || 'https://identity.ai.devintensive.com';
const SESSION_COOKIE_NAME = 'expertly_session';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  // Call Identity API to invalidate session
  if (sessionToken) {
    try {
      await fetch(`${IDENTITY_API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'X-Session-Token': sessionToken,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Failed to logout from Identity:', error);
    }
  }

  // Clear the cookie
  cookieStore.delete(SESSION_COOKIE_NAME);

  // Redirect to Identity login
  return NextResponse.redirect(new URL('/login', IDENTITY_URL));
}

export async function GET(request: NextRequest) {
  // Support GET for convenience
  return POST(request);
}
