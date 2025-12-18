import '@/app/globals.css';
import '@/styles/premium.css';
import { Analytics } from '@vercel/analytics/react';
import { SessionProvider } from 'next-auth/react';
import PageTransition from '@/components/PageTransition';
import PremiumStyles from '@/components/PremiumStyles';

// Global page transition wrapper for award-winning UX
export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <PageTransition>
        <PremiumStyles />
        <Component {...pageProps} />
        <Analytics />
      </PageTransition>
    </SessionProvider>
  );
}
