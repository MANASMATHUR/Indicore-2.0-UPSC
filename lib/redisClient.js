'use strict';

import Redis from 'ioredis';

let redisClient = null;
let redisReady = null;

function createClient() {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (redisClient) {
    return redisClient;
  }

  redisClient = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  });

  redisClient.on('error', (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redis] connection error:', error.message);
    }
  });

  redisReady = redisClient.ping().catch((error) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redis] ping failed:', error.message);
    }
  });

  return redisClient;
}

export function getRedisClient() {
  return createClient();
}

export async function ensureRedisReady() {
  try {
    if (!redisReady) {
      createClient();
    }
    await redisReady;
    return !!redisClient;
  } catch {
    return false;
  }
}

