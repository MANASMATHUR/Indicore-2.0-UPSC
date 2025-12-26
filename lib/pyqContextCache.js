const contextStore = new Map();
const displayedQuestionsStore = new Map(); // NEW: Store actual questions shown to user
const CONTEXT_TTL = 60 * 60 * 1000; // 1 hour

function cleanupExpired(key) {
  if (!key) return;
  const entry = contextStore.get(key);
  if (!entry) return;
  if (Date.now() - entry.timestamp > CONTEXT_TTL) {
    contextStore.delete(key);
    displayedQuestionsStore.delete(key); // Also clean displayed questions
  }
}

export function setPyqContext(key, context) {
  if (!key || !context) return;
  contextStore.set(key, { ...context, timestamp: Date.now() });
}

// NEW: Store the actual questions that were displayed to user
export function setDisplayedQuestions(key, questions) {
  if (!key || !questions) return;
  displayedQuestionsStore.set(key, { questions, timestamp: Date.now() });
}

// NEW: Get the last displayed questions for "solve these" requests
export function getDisplayedQuestions(key) {
  if (!key) return null;
  const entry = displayedQuestionsStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CONTEXT_TTL) {
    displayedQuestionsStore.delete(key);
    return null;
  }
  return entry.questions;
}

export function getPyqContext(key) {
  if (!key) return null;
  cleanupExpired(key);
  return contextStore.get(key) || null;
}

export function clearPyqContext(key) {
  if (!key) return;
  contextStore.delete(key);
  displayedQuestionsStore.delete(key); // Also clear displayed questions
}

export function pruneExpiredContexts() {
  const now = Date.now();
  for (const [key, entry] of contextStore.entries()) {
    if (now - entry.timestamp > CONTEXT_TTL) {
      contextStore.delete(key);
      displayedQuestionsStore.delete(key);
    }
  }
}
