'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function CurrentAffairsDigestRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/current-affairs?tab=digest');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <LoadingSpinner message="Redirecting to Current Affairs..." />
    </div>
  );
}
