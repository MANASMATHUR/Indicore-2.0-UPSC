/**
 * Comprehensive response cleaning utility
 * Removes garbled text, citations, and incomplete sentences from AI responses
 */

// Patterns that indicate garbled or incomplete responses
const GARBLED_PATTERNS = [
  /(?:PCSC|PCS|UPSC|SSC)\s+exams?\s+(?:need|needs)\s+help/i,
  /I'?m\s+(?:here\s+)?to\s+support/i,
  /Let\s+me\s+know\s+(?:how|what|if)\s+I\s+can\s+(?:help|assist|you)/i,
  /I'?m\s+(?:an|your)\s+(?:AI|assistant|exam)\s+preparation\s+(?:assistant|helper)/i,
  /How\s+can\s+I\s+assist\s+you\s+(?:today|with|in)/i,
  /Feel\s+free\s+to\s+ask\s+(?:me\s+)?(?:any|more)\s+(?:questions?|queries?)/i,
  /(?:requirements?|structure?|response?|answer?|following|as follows):\s*$/i,
  /^I\s+can\s+(?:help|assist|provide)/i,
  /^As\s+an\s+(?:AI|assistant)/i,
  /^(?:I'?m|I am)\s+(?:here|available)\s+to/i,
];

// Patterns for incomplete sentences
const INCOMPLETE_PATTERNS = [
  /\s+(?:and|or|but|so|because|since|although|however)\s*$/i,
  /[^.!?]\s*$/,
  /\s+(?:the|a|an|this|that|these|those)\s*$/i,
  /\s+(?:is|are|was|were|be|been|being)\s*$/i,
  /\s+(?:to|from|with|for|at|in|on|by)\s*$/i,
];

/**
 * Clean AI response by removing citations, garbled text, and incomplete sentences
 * @param {string} response - The raw AI response
 * @returns {string} - Cleaned response
 */
export function cleanAIResponse(response) {
  if (!response || typeof response !== 'string') {
    return '';
  }

  let cleaned = response.trim();

  // Remove citation patterns [1], [2], [1,2], etc.
  cleaned = cleaned.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
  
  // Remove reference patterns like (Source: ...) or [Source: ...]
  cleaned = cleaned.replace(/\[?Source[:\s][^\]]+\]?/gi, '');
  cleaned = cleaned.replace(/\(Source[:\s][^)]+\)/gi, '');

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove garbled patterns
  for (const pattern of GARBLED_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove common unwanted phrases
  cleaned = cleaned.replace(/\b(?:Note:|Note that|Please note|Keep in mind|Remember that|It's important to note)[:.]?\s*/gi, '');
  cleaned = cleaned.replace(/\b(?:I hope this helps|Hope this helps|Let me know if you need more|If you have more questions)[.!]?\s*/gi, '');
  
  // Clean up incomplete sentences at the end
  cleaned = cleanIncompleteSentences(cleaned);

  // Remove trailing punctuation issues
  cleaned = cleaned.replace(/[.,;:]\s*\.+$/g, '.');
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');
  
  // Ensure proper sentence endings
  cleaned = ensureProperEnding(cleaned);

  // Final cleanup
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned;
}

/**
 * Clean incomplete sentences from the end of response
 * @param {string} text - Text to clean
 * @returns {string} - Text with incomplete sentences removed
 */
function cleanIncompleteSentences(text) {
  if (!text || text.length < 20) {
    return text;
  }

  const trimmed = text.trim();
  
  // Only remove incomplete sentences at the very end
  // Check if the last sentence is incomplete
  const lastSentenceMatch = trimmed.match(/[.!?]\s*([^.!?]+)$/);
  if (lastSentenceMatch) {
    const lastSentence = lastSentenceMatch[1].trim();
    
    // If last "sentence" is very short and ends with incomplete pattern, remove it
    if (lastSentence.length < 15) {
      const isIncomplete = INCOMPLETE_PATTERNS.some(pattern => pattern.test(lastSentence));
      if (isIncomplete) {
        // Remove the incomplete last sentence
        return trimmed.substring(0, trimmed.lastIndexOf(lastSentenceMatch[0])).trim();
      }
    }
  }
  
  // Check if text ends with incomplete pattern (no punctuation)
  if (!/[.!?]$/.test(trimmed)) {
    const endsIncomplete = INCOMPLETE_PATTERNS.some(pattern => {
      const match = trimmed.match(new RegExp(pattern.source + '$', pattern.flags));
      return match && match[0].length > 5; // Only if it's a significant fragment
    });
    
    if (endsIncomplete) {
      // Find last complete sentence
      const lastComplete = trimmed.match(/^.*[.!?]\s+/);
      if (lastComplete && lastComplete[0].length > 50) {
        return lastComplete[0].trim();
      }
    }
  }
  
  return trimmed;
}

/**
 * Ensure response has proper ending
 * @param {string} text - Text to fix
 * @returns {string} - Text with proper ending
 */
function ensureProperEnding(text) {
  if (!text || text.length < 10) {
    return text;
  }

  const trimmed = text.trim();
  
  // Don't add punctuation if it already ends properly
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  
  // Remove trailing incomplete words
  if (trimmed.endsWith('-') || trimmed.endsWith(',')) {
    const withoutTrailing = trimmed.slice(0, -1).trim();
    if (withoutTrailing.length > 10) {
      // Find last sentence and end it properly
      const lastPeriod = withoutTrailing.lastIndexOf('.');
      const lastQuestion = withoutTrailing.lastIndexOf('?');
      const lastExclamation = withoutTrailing.lastIndexOf('!');
      const lastPunctuation = Math.max(lastPeriod, lastQuestion, lastExclamation);
      
      if (lastPunctuation > 0) {
        return withoutTrailing.substring(0, lastPunctuation + 1);
      }
      
      return withoutTrailing + '.';
    }
    return withoutTrailing;
  }
  
  // If text is substantial but doesn't end with punctuation, add period
  if (trimmed.length > 50 && !/[.!?]$/.test(trimmed)) {
    // Check if it's a question
    if (/\b(what|where|when|why|who|how|which|is|are|can|could|will|would|should|do|does|did)\b.*\?/i.test(trimmed)) {
      return trimmed + '?';
    }
    return trimmed + '.';
  }
  
  return trimmed;
}

/**
 * Check if response is garbled
 * @param {string} response - Response to check
 * @returns {boolean} - True if response is garbled
 */
export function isGarbledResponse(response) {
  if (!response || typeof response !== 'string') {
    return true;
  }

  const cleaned = response.trim();
  
  // Check for garbled patterns
  if (GARBLED_PATTERNS.some(pattern => pattern.test(cleaned))) {
    return true;
  }
  
  // Check if response is too short
  if (cleaned.length < 20) {
    return true;
  }
  
  // Check if response is mostly punctuation
  const punctuationRatio = (cleaned.match(/[.,!?;:]/g) || []).length / cleaned.length;
  if (punctuationRatio > 0.3) {
    return true;
  }
  
  // Check if response has too many incomplete sentences
  const incompleteCount = INCOMPLETE_PATTERNS.filter(pattern => pattern.test(cleaned)).length;
  if (incompleteCount > 2) {
    return true;
  }
  
  return false;
}

/**
 * Validate and clean response before sending to client
 * @param {string} response - Raw response
 * @param {number} minLength - Minimum acceptable length
 * @returns {string|null} - Cleaned response or null if invalid
 */
export function validateAndCleanResponse(response, minLength = 20) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const cleaned = cleanAIResponse(response);
  
  // Check if response is garbled
  if (isGarbledResponse(cleaned)) {
    return null;
  }
  
  // Check minimum length
  if (cleaned.length < minLength) {
    return null;
  }
  
  return cleaned;
}

