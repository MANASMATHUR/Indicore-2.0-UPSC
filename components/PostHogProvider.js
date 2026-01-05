'use client';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Initialize PostHog only on client side
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We capture manually for better control
        capture_pageleave: true,
        autocapture: true,
        persistence: 'localStorage+cookie',
        loaded: (posthog) => {
            if (process.env.NODE_ENV === 'development') {
                // Disable in development to avoid polluting data
                posthog.opt_out_capturing();
            }
        }
    });
}

// Component to track page views
function PostHogPageView() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (pathname && typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
            let url = window.origin + pathname;
            if (searchParams?.toString()) {
                url = url + '?' + searchParams.toString();
            }
            posthog.capture('$pageview', { '$current_url': url });
        }
    }, [pathname, searchParams]);

    return null;
}

// Provider component
export function PostHogProvider({ children }) {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        // If no PostHog key, just render children without tracking
        return <>{children}</>;
    }

    return (
        <PHProvider client={posthog}>
            <PostHogPageView />
            {children}
        </PHProvider>
    );
}

// Export posthog instance for custom events
export { posthog };
