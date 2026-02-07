import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { IDENTITY_URL } from '@/api/client';

export default function LoginPage() {
  useEffect(() => {
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${IDENTITY_URL}/login?returnUrl=${returnUrl}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
        <p className="mt-4 text-sm text-gray-600">
          Redirecting to sign in...
        </p>
      </div>
    </div>
  );
}
