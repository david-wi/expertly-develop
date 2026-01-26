import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const IDENTITY_API_URL = process.env.IDENTITY_API_URL || 'https://identity-api.ai.devintensive.com';
const IDENTITY_URL = process.env.IDENTITY_URL || 'https://identity.ai.devintensive.com';
const SESSION_COOKIE_NAME = 'expertly_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to static files, API routes (except those needing auth), and health checks
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname === '/api/health'
  ) {
    return NextResponse.next();
  }

  // Get session token from cookie
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    // No session - redirect to Identity login
    return redirectToLogin(request);
  }

  // Validate session against Identity API
  try {
    const response = await fetch(`${IDENTITY_API_URL}/api/v1/auth/validate`, {
      method: 'GET',
      headers: {
        'X-Session-Token': sessionToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return redirectToLogin(request);
    }

    const data = await response.json();

    if (!data.valid) {
      return redirectToLogin(request);
    }

    // Session is valid - continue with user info in headers
    const requestHeaders = new Headers(request.headers);
    if (data.user) {
      requestHeaders.set('x-user-id', data.user.id);
      requestHeaders.set('x-user-email', data.user.email || '');
      requestHeaders.set('x-user-name', data.user.name);
      requestHeaders.set('x-organization-id', data.user.organization_id);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Auth validation error:', error);
    // On error, allow through but log the issue
    // This prevents the app from being completely inaccessible if Identity is down
    return NextResponse.next();
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const returnUrl = request.url;
  const loginUrl = new URL('/login', IDENTITY_URL);
  loginUrl.searchParams.set('return_url', returnUrl);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
