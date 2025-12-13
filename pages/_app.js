import '@/app/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SessionProvider } from 'next-auth/react';
import PageTransition from '@/components/PageTransition';

// Global page transition wrapper for award-winning UX
export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <PageTransition>
        <Component {...pageProps} />
        <Analytics />
      </PageTransition>
    </SessionProvider>
  );
}
