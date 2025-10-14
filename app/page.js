'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import LoginModal from '@/components/LoginModal';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Home() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== 'loading') {
      setIsLoading(false);
    }
  }, [status]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <LoginModal />;
  }

  return <ChatInterface user={session.user} />;
}
