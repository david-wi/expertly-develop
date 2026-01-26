'use client';

import { AuthProvider } from '@expertly/auth/react';

const IDENTITY_API_URL = process.env.NEXT_PUBLIC_IDENTITY_API_URL || 'https://identity-api.ai.devintensive.com';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider
      config={{
        identityApiUrl: IDENTITY_API_URL,
        cookieDomain: '.ai.devintensive.com',
      }}
      requireAuth={false} // Middleware handles auth redirect
    >
      {children}
    </AuthProvider>
  );
}
