'use client';

import { useEffect, useState } from 'react';
import { getVisitorData } from '@/lib/visitorUtils';
import { useSession } from 'next-auth/react';

let trackingInitialized = false;
let pageLoadTime = Date.now();
let lastPageViewTime = Date.now();

export default function VisitorTracker() {
  const { data: session } = useSession();
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    // Only track once per page load
    if (trackingInitialized) return;
    trackingInitialized = true;

    const trackVisitor = async () => {
      try {
        const visitorData = getVisitorData();
        if (!visitorData) return;

        // Track page view
        const response = await fetch('/api/analytics/track-visitor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...visitorData,
            timeOnSite: 0 // Will be updated on page unload
          }),
        });

        if (response.ok) {
          setIsTracking(true);
        }

        // If user is authenticated, track conversion
        if (session?.user?.email) {
          await trackConversion(session.user.email, visitorData.visitorId);
        }
      } catch (error) {
        console.error('Error tracking visitor:', error);
      }
    };

    // Track immediately
    trackVisitor();

    // Track page visibility changes (when user leaves/returns)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User left the page
        const timeOnSite = Math.floor((Date.now() - lastPageViewTime) / 1000);
        trackTimeOnSite(timeOnSite);
      } else {
        // User returned
        lastPageViewTime = Date.now();
      }
    };

    // Track before page unload
    const handleBeforeUnload = () => {
      const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000);
      trackTimeOnSite(timeOnSite);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Track time on site every 30 seconds
    const intervalId = setInterval(() => {
      const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000);
      if (timeOnSite > 0) {
        trackTimeOnSite(timeOnSite);
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(intervalId);
      
      // Final time tracking
      const timeOnSite = Math.floor((Date.now() - pageLoadTime) / 1000);
      trackTimeOnSite(timeOnSite);
    };
  }, [session]);

  // Track conversion when user signs in
  useEffect(() => {
    if (session?.user?.email) {
      const visitorData = getVisitorData();
      if (visitorData?.visitorId) {
        trackConversion(session.user.email, visitorData.visitorId);
      }
    }
  }, [session]);

  return null; // This component doesn't render anything
}

async function trackTimeOnSite(timeOnSite) {
  try {
    const visitorData = getVisitorData();
    if (!visitorData) return;

    await fetch('/api/analytics/track-visitor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...visitorData,
        timeOnSite,
        updateTimeOnly: true
      }),
    });
  } catch (error) {
    // Silently fail - don't interrupt user experience
  }
}

async function trackConversion(userEmail, visitorId) {
  try {
    await fetch('/api/analytics/track-conversion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        visitorId,
        userEmail
      }),
    });
  } catch (error) {
    // Silently fail
  }
}

