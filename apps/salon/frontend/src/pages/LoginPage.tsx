import { useEffect } from 'react';
import { Card } from '../components/ui';

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com';

export function LoginPage() {
  useEffect(() => {
    // Redirect to Identity login with return URL
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-100 px-4">
      <Card className="w-full max-w-md" padding="lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary-500 mb-2">
            Salon Booking
          </h1>
          <p className="text-warm-600">Redirecting to login...</p>
          <div className="mt-4">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
          <p className="mt-4 text-sm text-warm-500">
            If you are not redirected,{' '}
            <a
              href={`${IDENTITY_URL}/login?returnUrl=${encodeURIComponent(window.location.origin)}`}
              className="text-primary-500 hover:underline"
            >
              click here
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
