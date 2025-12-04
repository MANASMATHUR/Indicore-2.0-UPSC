'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function VocabularyBuilderRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/writing-tools?tab=vocabulary');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-4">
      <LoadingSpinner message="Redirecting to Writing Tools..." />
    </div>
  );
}
