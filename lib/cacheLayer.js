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
    const localValue = this.memoryCache.get(key);
    if (localValue !== null && localValue !== undefined) {
      return localValue;
    }

    const redis = getRedisClient();
    if (!redis) {
      return null;
    }

    try {
      const payload = await redis.get(this._namespaced(key));
      if (!payload) return null;
      const parsed = JSON.parse(payload);
      const value = parsed?.value ?? parsed;
      this.memoryCache.set(key, value);
      return value;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Cache] get failed for ${this.prefix}:`, error.message);
      }
      return null;
    }
  }

  async set(key, value) {
    this.memoryCache.set(key, value);
    const redis = getRedisClient();
    if (!redis) return;

    try {
      const payload = JSON.stringify({
        value,
        timestamp: Date.now()
      });
      await redis.set(
        this._namespaced(key),
        payload,
        'PX',
        Math.max(1000, this.ttl)
      );
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Cache] set failed for ${this.prefix}:`, error.message);
      }
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

