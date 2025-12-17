/**
 * Guest Tracking Utility
 * Client-side tracking for guest users using localStorage and cookies
 */

// Generate unique session ID
export function getOrCreateSessionId() {
    if (typeof window === 'undefined') return null;

    // Check cookie first
    const cookieSessionId = getCookie('sessionId');
    if (cookieSessionId) {
        return cookieSessionId;
    }

    // Check localStorage
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem('sessionId', sessionId);
    }

    // Set cookie (will be set by server on first API call)
    return sessionId;
}

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Get cookie value
function getCookie(name) {
    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop().split(';').shift();
    }
    return null;
}

/**
 * Track interaction (client-side wrapper)
 * @param {Object} interactionData - Interaction data
 */
export async function trackClientInteraction(interactionData) {
    try {
        const sessionId = getOrCreateSessionId();

        const response = await fetch('/api/personalization/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...interactionData,
                sessionId
            })
        });

        if (!response.ok) {
            console.error('Failed to track interaction:', await response.text());
            return null;
        }

        const result = await response.json();

        // Store in localStorage for offline tracking
        storeOfflineInteraction(interactionData);

        return result;
    } catch (error) {
        console.error('Error tracking interaction:', error);
        // Store for later sync
        storeOfflineInteraction(interactionData);
        return null;
    }
}

/**
 * Store interaction offline for later sync
 */
function storeOfflineInteraction(interactionData) {
    if (typeof window === 'undefined') return;

    try {
        const offlineQueue = JSON.parse(localStorage.getItem('offlineInteractions') || '[]');
        offlineQueue.push({
            ...interactionData,
            timestamp: new Date().toISOString()
        });

        // Keep only last 100 interactions
        if (offlineQueue.length > 100) {
            offlineQueue.shift();
        }

        localStorage.setItem('offlineInteractions', JSON.stringify(offlineQueue));
    } catch (error) {
        console.error('Error storing offline interaction:', error);
    }
}

/**
 * Sync offline interactions
 */
export async function syncOfflineInteractions() {
    if (typeof window === 'undefined') return;

    try {
        const offlineQueue = JSON.parse(localStorage.getItem('offlineInteractions') || '[]');

        if (offlineQueue.length === 0) return;

        const sessionId = getOrCreateSessionId();

        // Send all offline interactions
        for (const interaction of offlineQueue) {
            await fetch('/api/personalization/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...interaction,
                    sessionId
                })
            });
        }

        // Clear queue
        localStorage.removeItem('offlineInteractions');

        console.log(`Synced ${offlineQueue.length} offline interactions`);
    } catch (error) {
        console.error('Error syncing offline interactions:', error);
    }
}

/**
 * Get guest preferences from localStorage
 */
export function getGuestPreferences() {
    if (typeof window === 'undefined') return {};

    try {
        const prefs = localStorage.getItem('guestPreferences');
        return prefs ? JSON.parse(prefs) : {};
    } catch (error) {
        console.error('Error getting guest preferences:', error);
        return {};
    }
}

/**
 * Save guest preferences to localStorage
 */
export function saveGuestPreferences(preferences) {
    if (typeof window === 'undefined') return;

    try {
        const existing = getGuestPreferences();
        const updated = { ...existing, ...preferences };
        localStorage.setItem('guestPreferences', JSON.stringify(updated));
    } catch (error) {
        console.error('Error saving guest preferences:', error);
    }
}

/**
 * Clear guest data (called after migration)
 */
export function clearGuestData() {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem('offlineInteractions');
        localStorage.removeItem('guestPreferences');
        // Keep sessionId for tracking purposes
    } catch (error) {
        console.error('Error clearing guest data:', error);
    }
}

/**
 * Track page view
 */
export function trackPageView(pageName, metadata = {}) {
    return trackClientInteraction({
        interactionType: 'page_view',
        feature: pageName,
        action: 'view',
        metadata: {
            ...metadata,
            url: typeof window !== 'undefined' ? window.location.href : '',
            referrer: typeof document !== 'undefined' ? document.referrer : ''
        }
    });
}

/**
 * Track feature usage
 */
export function trackFeatureUsage(feature, action, metadata = {}) {
    return trackClientInteraction({
        interactionType: feature,
        feature,
        action,
        metadata
    });
}

/**
 * Track time spent on page
 */
export class TimeTracker {
    constructor(feature, metadata = {}) {
        this.feature = feature;
        this.metadata = metadata;
        this.startTime = Date.now();
    }

    stop() {
        const timeSpent = Math.floor((Date.now() - this.startTime) / 1000); // in seconds

        return trackClientInteraction({
            interactionType: this.feature,
            feature: this.feature,
            action: 'view',
            metadata: {
                ...this.metadata,
                timeSpent
            }
        });
    }
}

export default {
    getOrCreateSessionId,
    trackClientInteraction,
    syncOfflineInteractions,
    getGuestPreferences,
    saveGuestPreferences,
    clearGuestData,
    trackPageView,
    trackFeatureUsage,
    TimeTracker
};
