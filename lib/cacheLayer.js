'use strict';

import { getRedisClient } from './redisClient';

class TTLCache {
  constructor({ ttl = 5 * 60 * 1000, max = 100 } = {}) {
    this.ttl = ttl;
    this.max = max;
    this.store = new Map();
  }

  _purgeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (!entry || now - entry.timestamp > (entry.ttl || this.ttl)) {
        this.store.delete(key);
      }
    }
  }

  get(key) {
    if (!key) return null;
    const entry = this.store.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.timestamp > (entry.ttl || this.ttl)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlOverride) {
    if (!key) return;
    this._purgeExpired();
    if (this.store.size >= this.max) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      ttl: typeof ttlOverride === 'number' ? ttlOverride : this.ttl,
      timestamp: Date.now()
    });
  }

  entries() {
    this._purgeExpired();
    return Array.from(this.store.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      timestamp: entry.timestamp
    }));
  }
}

class PersistentCache {
  constructor({ ttl = 5 * 60 * 1000, max = 100, prefix = 'cache' } = {}) {
    this.ttl = ttl;
    this.prefix = prefix;
    this.memoryCache = new TTLCache({ ttl, max });
  }

  _namespaced(key) {
    return `${this.prefix}:${key}`;
  }

  async get(key) {
    if (!key) return null;
    
    // Check memory cache first
    // Note: TTLCache.get() returns null for both "not found" and "cached null value"
    // We need to distinguish these cases, so we check if the key exists first
    // If it exists, we use TTLCache.get() which properly handles TTL and deletion
    const keyExists = this.memoryCache.store && this.memoryCache.store.has(key);
    if (keyExists) {
      // Use TTLCache.get() to properly handle TTL expiration and deletion
      // This respects encapsulation and avoids duplicating TTL logic
      const value = this.memoryCache.get(key);
      // If get() returns a value (including null/undefined), the entry was valid
      // If it returns null and key no longer exists, it was expired (already deleted by get())
      // Since we checked keyExists, if value is null, it means cached null value
      if (value !== null || this.memoryCache.store.has(key)) {
        // Value is null but key still exists = cached null value
        // Or value is non-null = cached value
        return value;
      }
      // Value is null and key no longer exists = was expired (deleted by get())
      // Fall through to Redis lookup
    }

    const redis = getRedisClient();
    if (!redis) {
      return null;
    }

    try {
      const payload = await redis.get(this._namespaced(key));
      if (!payload) {
        // Cache null to avoid repeated Redis lookups for missing keys
        this.memoryCache.set(key, null);
        return null;
      }
      
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch (parseError) {
        // If JSON parse fails, try to recover
        console.warn(`[Cache] JSON parse failed for ${this.prefix}:${key}, attempting recovery`);
        
        // Try to extract value from potentially malformed JSON
        // Normal structure is: {"value": <actual_value>, "timestamp": <number>}
        // Try to find the value field using regex
        let recoveredValue = null;
        let valueRecovered = false; // Track whether we successfully extracted a value (even if it's null)
        
        // Try to match string values: "value": "actual_value"
        const stringValueMatch = payload.match(/"value"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (stringValueMatch) {
          try {
            // Properly unescape JSON string by wrapping in quotes and parsing
            // This handles all standard JSON escape sequences: \\, \", \n, \t, \r, \b, \f, \uXXXX
            recoveredValue = JSON.parse('"' + stringValueMatch[1] + '"');
            valueRecovered = true;
          } catch (parseError) {
            // Fallback to simple unescape if JSON.parse fails (shouldn't happen with valid JSON)
            console.warn(`[Cache] Failed to unescape string value for ${this.prefix}:${key}, using fallback`);
            recoveredValue = stringValueMatch[1].replace(/\\(.)/g, '$1');
            valueRecovered = true;
          }
        } else {
          // Try to match number values: "value": 123 or "value": 123.45
          const numberValueMatch = payload.match(/"value"\s*:\s*(-?\d+\.?\d*)/);
          if (numberValueMatch) {
            recoveredValue = numberValueMatch[1].includes('.') ? parseFloat(numberValueMatch[1]) : parseInt(numberValueMatch[1], 10);
            valueRecovered = true;
          } else {
            // Try to match boolean/null: "value": true/false/null
            const boolNullMatch = payload.match(/"value"\s*:\s*(true|false|null)/);
            if (boolNullMatch) {
              if (boolNullMatch[1] === 'true') recoveredValue = true;
              else if (boolNullMatch[1] === 'false') recoveredValue = false;
              else if (boolNullMatch[1] === 'null') recoveredValue = null;
              valueRecovered = true; // Successfully extracted, even if value is null
            }
          }
        }
        
        // If we successfully recovered a value (including null), cache and return it
        // (following same unwrapping pattern as normal path)
        if (valueRecovered) {
          this.memoryCache.set(key, recoveredValue);
          return recoveredValue;
        }
        
        // If payload is a simple non-JSON string (edge case - shouldn't happen with current set())
        // This handles legacy data that might have been stored as plain strings
        if (typeof payload === 'string' && payload.length < 1000 && !payload.trim().startsWith('{') && !payload.trim().startsWith('[')) {
          this.memoryCache.set(key, payload);
          return payload;
        }
        
        // Cache null for failed parse to avoid repeated attempts
        this.memoryCache.set(key, null);
        return null;
      }
      
      const value = parsed?.value ?? parsed;
      // Always cache the value (including null/undefined) to be consistent with set()
      // This prevents repeated Redis lookups for the same key
      this.memoryCache.set(key, value);
      return value;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Cache] get failed for ${this.prefix}:${key}:`, error.message);
      }
      // Return null on error, don't throw
      return null;
    }
  }

  async set(key, value) {
    if (!key) return;
    
    // Always update memory cache first for fast access
    this.memoryCache.set(key, value);
    
    const redis = getRedisClient();
    if (!redis) return;

    try {
      // Handle circular references and large objects
      let payload;
      try {
        payload = JSON.stringify({
          value,
          timestamp: Date.now()
        });
      } catch (stringifyError) {
        // If value can't be stringified, try to store a simplified version
        if (stringifyError.message.includes('circular') || stringifyError.message.includes('Converting circular')) {
          console.warn(`[Cache] Circular reference detected for ${this.prefix}:${key}, storing simplified version`);
          payload = JSON.stringify({
            value: '[Circular Reference - Not Cached]',
            timestamp: Date.now(),
            error: 'circular_reference'
          });
        } else {
          throw stringifyError;
        }
      }

      // Limit payload size to prevent Redis issues (10MB limit)
      if (payload.length > 10 * 1024 * 1024) {
        console.warn(`[Cache] Payload too large for ${this.prefix}:${key} (${payload.length} bytes), skipping Redis cache`);
        return;
      }

      await redis.set(
        this._namespaced(key),
        payload,
        'PX',
        Math.max(1000, this.ttl)
      );
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Cache] set failed for ${this.prefix}:${key}:`, error.message);
      }
      // Don't throw - memory cache is already updated
    }
  }

  async entries(limit = 50) {
    const redis = getRedisClient();
    if (!redis) {
      return this.memoryCache.entries().slice(-limit);
    }

    try {
      const pattern = `${this.prefix}:*`;
      const keys = await redis.keys(pattern);
      if (!keys || keys.length === 0) {
        return this.memoryCache.entries().slice(-limit);
      }

      const selected = keys.slice(Math.max(0, keys.length - limit));
      const values = await redis.mget(selected);

      return selected.map((namespacedKey, index) => {
        const raw = values[index];
        let parsed = null;
        let timestamp = Date.now();
        if (raw) {
          try {
            const data = JSON.parse(raw);
            parsed = data?.value ?? data;
            timestamp = data?.timestamp || timestamp;
          } catch {
            parsed = raw;
          }
        }
        return {
          key: namespacedKey.replace(`${this.prefix}:`, ''),
          value: parsed,
          timestamp
        };
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Cache] entries failed for ${this.prefix}:`, error.message);
      }
      return this.memoryCache.entries().slice(-limit);
    }
  }
}

const pyqQueryCache = new PersistentCache({
  ttl: 15 * 60 * 1000,
  max: 250,
  prefix: 'pyq-cache'
});

const trendingTopicCache = new PersistentCache({
  ttl: 10 * 60 * 1000,
  max: 100,
  prefix: 'trending-cache'
});

async function storeTrendingSnapshot(key, snapshot) {
  if (!key || !snapshot) return;
  await trendingTopicCache.set(key, {
    ...snapshot,
    capturedAt: snapshot.capturedAt || new Date().toISOString()
  });
}

async function getTrendingSnapshots(limit = 5) {
  const entries = await trendingTopicCache.entries(limit);
  if (!entries || entries.length === 0) {
    return [];
  }
  return entries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .map(entry => ({
      key: entry.key,
      capturedAt: entry.value?.capturedAt || new Date(entry.timestamp).toISOString(),
      categories: entry.value?.categories || [],
      tags: entry.value?.tags || [],
      relevance: entry.value?.relevance || [],
      totalItems: entry.value?.totalItems || 0
    }));
}

async function getTrendingSummary(limit = 6) {
  const snapshots = await getTrendingSnapshots(limit);
  if (snapshots.length === 0) {
    return {
      categories: [],
      tags: [],
      relevance: [],
      updatedAt: null,
      snapshots: []
    };
  }

  const categoryTotals = new Map();
  const tagTotals = new Map();
  const relevanceTotals = new Map();

  snapshots.forEach((snapshot) => {
    (snapshot.categories || []).forEach(cat => {
      if (!cat?.label) return;
      categoryTotals.set(cat.label, (categoryTotals.get(cat.label) || 0) + (cat.count || 0));
    });
    (snapshot.tags || []).forEach(tag => {
      if (!tag?.label) return;
      tagTotals.set(tag.label, (tagTotals.get(tag.label) || 0) + (tag.count || 0));
    });
    (snapshot.relevance || []).forEach(rel => {
      if (!rel?.label) return;
      relevanceTotals.set(rel.label, (relevanceTotals.get(rel.label) || 0) + (rel.count || 0));
    });
  });

  const toSortedArray = (map, maxItems = limit) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([label, count]) => ({ label, count }));

  return {
    categories: toSortedArray(categoryTotals),
    tags: toSortedArray(tagTotals, 10),
    relevance: toSortedArray(relevanceTotals, 3),
    updatedAt: snapshots[0]?.capturedAt || new Date().toISOString(),
    snapshots
  };
}

export {
  TTLCache,
  PersistentCache,
  pyqQueryCache,
  trendingTopicCache,
  storeTrendingSnapshot,
  getTrendingSnapshots,
  getTrendingSummary
};

