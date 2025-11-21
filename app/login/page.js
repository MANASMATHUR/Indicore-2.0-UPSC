'use client';

import { useSearchParams } from 'next/navigation';
import LoginModal from '@/components/LoginModal';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect') || '/chat';

  return <LoginModal redirectPath={redirectParam} />;
}

