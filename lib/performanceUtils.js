/**
 * Performance Optimization Utilities
 * Caching, memoization, and query optimization helpers
 */

// In-memory cache with TTL
class CacheManager {
    constructor(defaultTTL = 10 * 60 * 1000) { // 10 minutes default
        this.cache = new Map();
        this.defaultTTL = defaultTTL;
    }

    set(key, value, ttl = this.defaultTTL) {
        const expiresAt = Date.now() + ttl;
        this.cache.set(key, { value, expiresAt });

        // Clean up expired entries periodically
        if (this.cache.size % 100 === 0) {
            this.cleanup();
        }
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Global cache instances
export const responseCache = new CacheManager(10 * 60 * 1000); // 10 min
export const pyqCache = new CacheManager(30 * 60 * 1000); // 30 min
export const userDataCache = new CacheManager(5 * 60 * 1000); // 5 min

/**
 * Generate cache key from parameters
 */
export function generateCacheKey(...params) {
    return params.map(p => {
        if (typeof p === 'object') {
            return JSON.stringify(p);
        }
        return String(p);
    }).join(':');
}

/**
 * Memoize async function with cache
 */
export function memoizeAsync(fn, cache = responseCache, keyGenerator = generateCacheKey) {
    return async function (...args) {
        const key = keyGenerator(...args);

        // Check cache first
        const cached = cache.get(key);
        if (cached !== null) {
            return cached;
        }

        // Execute function
        const result = await fn(...args);

        // Store in cache
        cache.set(key, result);

        return result;
    };
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        return new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                resolve(fn(...args));
            }, delay);
        });
    };
}

/**
 * Throttle function
 */
export function throttle(fn, limit = 1000) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Batch multiple requests
 */
export class RequestBatcher {
    constructor(batchFn, delay = 50) {
        this.batchFn = batchFn;
        this.delay = delay;
        this.queue = [];
        this.timeoutId = null;
    }

    add(request) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject });

            if (!this.timeoutId) {
                this.timeoutId = setTimeout(() => this.flush(), this.delay);
            }
        });
    }

    async flush() {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0);
        this.timeoutId = null;

        try {
            const requests = batch.map(item => item.request);
            const results = await this.batchFn(requests);

            batch.forEach((item, index) => {
                item.resolve(results[index]);
            });
        } catch (error) {
            batch.forEach(item => {
                item.reject(error);
            });
        }
    }
}

/**
 * Retry failed operations
 */
export async function retryOperation(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
}

/**
 * Parallel execution with concurrency limit
 */
export async function parallelLimit(tasks, limit = 5) {
    const results = [];
    const executing = [];

    for (const task of tasks) {
        const promise = Promise.resolve().then(() => task());
        results.push(promise);

        if (limit <= tasks.length) {
            const executing = promise.then(() => executing.splice(executing.indexOf(executing), 1));
            executing.push(executing);

            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }

    return Promise.all(results);
}

/**
 * Measure execution time
 */
export async function measureTime(fn, label = 'Operation') {
    const start = Date.now();
    try {
        const result = await fn();
        const duration = Date.now() - start;
        console.log(`[Performance] ${label}: ${duration}ms`);
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        console.log(`[Performance] ${label} (failed): ${duration}ms`);
        throw error;
    }
}

export default {
    CacheManager,
    responseCache,
    pyqCache,
    userDataCache,
    generateCacheKey,
    memoizeAsync,
    debounce,
    throttle,
    RequestBatcher,
    retryOperation,
    parallelLimit,
    measureTime
};
