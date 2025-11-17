const contextStore = new Map();
const CONTEXT_TTL = 60 * 60 * 1000; // 1 hour

function cleanupExpired(key) {
  if (!key) return;
  const entry = contextStore.get(key);
  if (!entry) return;
  if (Date.now() - entry.timestamp > CONTEXT_TTL) {
    contextStore.delete(key);
  }
}

export function setPyqContext(key, context) {
  if (!key || !context) return;
  contextStore.set(key, { ...context, timestamp: Date.now() });
}

export function getPyqContext(key) {
  if (!key) return null;
  cleanupExpired(key);
  return contextStore.get(key) || null;
}

export function clearPyqContext(key) {
  if (!key) return;
  contextStore.delete(key);
}

export function pruneExpiredContexts() {
  const now = Date.now();
  for (const [key, entry] of contextStore.entries()) {
    if (now - entry.timestamp > CONTEXT_TTL) {
      contextStore.delete(key);
    }
  }
}

