import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from './providers';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PostHogProvider } from '@/components/PostHogProvider';
import dynamic from 'next/dynamic';

// Lazy load non-critical components
const VisitorTracker = dynamic(() => import('@/components/VisitorTracker'), {
  ssr: false
});

// Optimize font loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

export const metadata = {
  title: 'Indicore - AI-Powered Exam Preparation for UPSC, PCS & SSC',
  description: 'Specialized AI assistant for competitive exams with PYQ database, exam-specific knowledge, multilingual support, and comprehensive study tools. Better than ChatGPT, Gemini, or Perplexity for exam preparation.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <PostHogProvider>
            <Providers>
              {children}
              <VisitorTracker />
            </Providers>
          </PostHogProvider>
        </ErrorBoundary>
        <Analytics mode="production" />
        <SpeedInsights />
      </body>
    </html>
  );
}
