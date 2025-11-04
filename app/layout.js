import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { Providers } from './providers';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Indicore - PCS/UPSC/SSC',
  description: 'AI-powered exam preparation platform with multilingual support, document evaluation, and regional language assistance for PCS, UPSC, and SSC exams',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
}