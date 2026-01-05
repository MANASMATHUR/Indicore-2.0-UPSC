import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { responseCache, retryOperation } from '@/lib/performanceUtils';

/**
 * Custom hook for dashboard data with caching, auto-refresh, and error handling
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (default: 5 minutes)
 * @param {boolean} options.enableAutoRefresh - Enable auto-refresh (default: true)
 * @param {boolean} options.enableCache - Enable caching (default: true)
 * 
 * @returns {Object} Dashboard data and control functions
 */
export default function useDashboardData(options = {}) {
    const {
        refreshInterval = 5 * 60 * 1000, // 5 minutes
        enableAutoRefresh = true,
        enableCache = true
    } = options;

    const { data: session } = useSession();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    const refreshIntervalRef = useRef(null);
    const abortControllerRef = useRef(null);

    /**
     * Fetch dashboard data with caching and retry logic
     */
    const fetchData = useCallback(async (forceRefresh = false) => {
        if (!session?.user) {
            setLoading(false);
            return;
        }

        // Check cache first (unless force refresh)
        if (enableCache && !forceRefresh) {
            const cacheKey = `dashboard:${session.user.email}`;
            const cached = responseCache.get(cacheKey);
            if (cached) {
                setData(cached);
                setLoading(false);
                setLastUpdated(new Date());
                return;
            }
        }

        // Cancel previous request if still pending
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        try {
            setError(null);
            if (!data) setLoading(true); // Only show loading on first load

            // Fetch with retry logic
            const result = await retryOperation(async () => {
                const [recsRes, syllabusRes] = await Promise.all([
                    fetch('/api/personalization/recommendations?type=all', {
                        signal: abortControllerRef.current.signal
                    }),
                    fetch('/api/syllabus/progress?exam=UPSC', {
                        signal: abortControllerRef.current.signal
                    })
                ]);

                if (!recsRes.ok || !syllabusRes.ok) {
                    throw new Error('server');
                }

                const [recsData, syllabusData] = await Promise.all([
                    recsRes.json(),
                    syllabusRes.json()
                ]);

                return {
                    ...recsData.recommendations,
                    syllabus: syllabusData.progress,
                    overallSyllabusProgress: syllabusData.overallProgress
                };
            }, 3, 1000);

            if (result) {
                setData(result);
                setLastUpdated(new Date());

                // Cache the result
                if (enableCache) {
                    const cacheKey = `dashboard:${session.user.email}`;
                    responseCache.set(cacheKey, result);
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                // Request was cancelled, ignore
                return;
            }

            console.error('Dashboard data fetch error:', err);

            // Determine error type
            let errorType = 'general';
            if (!navigator.onLine) {
                errorType = 'network';
            } else if (err.message === 'timeout') {
                errorType = 'timeout';
            } else if (err.message === 'server') {
                errorType = 'server';
            }

            setError({ type: errorType, message: err.message });
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [session, enableCache, data]);

    /**
     * Manual refresh function
     */
    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        await fetchData(true); // Force refresh
    }, [fetchData]);

    /**
     * Clear cache and refresh
     */
    const clearCacheAndRefresh = useCallback(async () => {
        if (session?.user) {
            const cacheKey = `dashboard:${session.user.email}`;
            responseCache.delete(cacheKey);
        }
        await refresh();
    }, [session, refresh]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh interval
    useEffect(() => {
        if (!enableAutoRefresh || !session?.user) return;

        refreshIntervalRef.current = setInterval(() => {
            fetchData(true);
        }, refreshInterval);

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [enableAutoRefresh, refreshInterval, fetchData, session]);

    // Online/offline detection
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Refresh data when coming back online
            fetchData(true);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [fetchData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, []);

    return {
        data,
        loading,
        error,
        lastUpdated,
        isRefreshing,
        isOnline,
        refresh,
        clearCacheAndRefresh
    };
}

/**
 * Format last updated timestamp
 */
export function formatLastUpdated(date) {
    if (!date) return 'Never';

    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
}
