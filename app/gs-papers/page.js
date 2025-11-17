'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function GSPapersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pyq-archive?view=subject-wise');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to PYQ Archive...</p>
      </div>
    </div>
  );
}
