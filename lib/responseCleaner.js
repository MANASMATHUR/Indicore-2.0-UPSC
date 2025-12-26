/**
 * Comprehensive response cleaning utility
 * Removes garbled text, citations, and incomplete sentences from AI responses
 */

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
  /^(?:I|I'?m|I am)\s+(?:sorry|apologize|regret)\s+(?:but\s+)?(?:I\s+)?(?:don'?t|do not)\s+have\s+(?:access|information)/i,
  /^(?:I|I'?m|I am)\s+(?:unable|cannot)\s+to\s+(?:access|provide|retrieve)/i,
  /^(?:As\s+of\s+)?(?:my\s+)?(?:last\s+)?(?:knowledge\s+)?(?:update|training)/i,
  /^(?:Please\s+)?(?:note\s+)?(?:that\s+)?(?:this\s+)?(?:information\s+)?(?:may\s+)?(?:be\s+)?(?:outdated|incorrect)/i,
  /\(reigned\s+\(/i,
  /From\s+result\s*\([^)]*\)\s*:/i,
  /\([A-Z][a-zA-Z\s]+\):\s*\(/i,
  /[.!?]\s*\([A-Z][^)]+\):\s*[a-z]/i,
  /[a-z]\s*\([A-Z][^)]+\):\s*$/i,
];

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

  const isPyqDbResponse = /(?:PYQ\s+Archive|Previous\s+Year\s+Questions|Year\s+\d{4}\s+[•·]|Total\s+Questions\s*:?\s*(?:Pulled|\d+)|Tips\s+for\s+Better\s+Results)/i.test(cleaned);

  const hasMarkdown = /^#{1,6}\s+|^\*\s+|^-\s+|^\d+\.\s+|^\*\*[^*]+\*\*|^`[^`]+`/m.test(cleaned);

  if (isPyqDbResponse) {
    // For PYQ responses, preserve newlines - they are critical for formatting
    cleaned = cleaned.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
    cleaned = cleaned.replace(/From\s+result[^.!?\n]*/gi, '');
    cleaned = cleaned.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?=\s*[a-z])/g, '');
    cleaned = cleaned.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
    cleaned = cleaned.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
    cleaned = cleaned.replace(/👤|🎓|🌐/g, '');
    // Reduce excessive newlines (3+ to 2) to keep spacing compact but preserve structure
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/^\n+/, ''); // Remove leading newlines
    // CRITICAL: Don't trim newlines - return as is to preserve formatting
    return cleaned;
  }

  if (hasMarkdown) {
    cleaned = cleaned.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
    cleaned = cleaned.replace(/From\s+result[^.!?\n]*/gi, '');
    cleaned = cleaned.replace(/\([A-Z][a-zA-Z\s]{4,}\):\s*(?=\s*[a-z])/g, '');
    cleaned = cleaned.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
    cleaned = cleaned.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
    cleaned = cleaned.replace(/👤|🎓|🌐/g, '');
    cleaned = ensureMarkdownSpacing(cleaned);
    return cleaned.trim();
  }

  cleaned = cleaned.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?![A-Z])/g, '');

  cleaned = cleaned.replace(/From\s+result\s*\([^)]*\)\s*[:.]?\s*/gi, '');
  cleaned = cleaned.replace(/From\s+result\s*[:.]?\s*/gi, '');
  cleaned = cleaned.replace(/From\s+result[^.!?]*/gi, '');

  cleaned = cleaned.replace(/\([A-Z][a-zA-Z\s]{2,}\s*$/gm, '');
  cleaned = cleaned.replace(/\(reigned[^)]*\)/gi, '');

  cleaned = cleaned.replace(/\(reigned\s*\([^)]+\)\s*[^)]*\)/gi, '');

  // Remove broken citation patterns like "(Source Name): text" that appear mid-sentence
  // Be more specific - only remove if it's clearly a citation pattern, not valid content
  cleaned = cleaned.replace(/\s*\([A-Z][a-zA-Z\s]{3,}\):\s*(?=[a-z])/g, ' '); // Only if followed by lowercase (mid-sentence citation)

  // Remove citation patterns [1], [2], [1,2], etc.
  // But preserve PYQ paper names like [GS Paper 1], [Prelims], [Mains], etc.
  // Only remove numeric citations, not paper names
  cleaned = cleaned.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
  // Preserve paper names - restore them if they were accidentally removed
  // This is handled by not removing brackets that contain text

  // Remove reference patterns like (Source: ...) or [Source: ...]
  cleaned = cleaned.replace(/\[?Source[:\s][^\]]+\]?/gi, '');
  cleaned = cleaned.replace(/\(Source[:\s][^)]+\)/gi, '');

  // Remove standalone citation markers that appear mid-sentence
  // But preserve PYQ paper names and other valid content in brackets
  // Only remove if it looks like a citation (ends with colon and not followed by capital letter)
  cleaned = cleaned.replace(/\s*\([A-Z][a-zA-Z\s]+\)\s*:\s*(?![A-Z])/g, '');

  // Clean up any leftover parentheses or brackets
  cleaned = cleaned.replace(/\s*\(\s*\)/g, '');
  cleaned = cleaned.replace(/\s*\[\s*\]/g, '');
  cleaned = cleaned.replace(/\s*\(\s*$/g, '');
  cleaned = cleaned.replace(/\s*\[\s*$/g, '');

  // Remove patterns like "🌐 Translate to..." that appear in responses
  cleaned = cleaned.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');

  // Remove timestamp patterns like "10:43 PM"
  cleaned = cleaned.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');

  // Remove emoji patterns that indicate UI elements
  cleaned = cleaned.replace(/👤|🎓|🌐/g, '');

  // Remove garbled patterns (but preserve the rest of the response)
  // Only remove if they appear at the very start or very end
  for (const pattern of GARBLED_PATTERNS) {
    if (pattern.test(cleaned)) {
      // Check if it's at the start (with word boundary)
      const startMatch = cleaned.match(new RegExp('^' + pattern.source + '\\s+', pattern.flags));
      if (startMatch) {
        cleaned = cleaned.substring(startMatch[0].length).trim();
      }
      // Check if it's at the end (with word boundary or end of string)
      const endMatch = cleaned.match(new RegExp('\\s+' + pattern.source + '$', pattern.flags));
      if (endMatch) {
        cleaned = cleaned.substring(0, cleaned.length - endMatch[0].length).trim();
      }
    }
  }

  // Remove common unwanted phrases (only at start/end)
  cleaned = cleaned.replace(/^(?:Note:|Note that|Please note|Keep in mind|Remember that|It's important to note)[:.]?\s*/gi, '');
  cleaned = cleaned.replace(/\s+(?:I hope this helps|Hope this helps|Let me know if you need more|If you have more questions)[.!]?\s*$/gi, '');

  // Remove mixed/garbled content patterns
  // Patterns where multiple sources are concatenated without proper separation
  cleaned = cleaned.replace(/\n{2,}(?:From\s+result|\([A-Z][^)]+\):)/gi, '\n');

  // Remove orphaned fragments that appear after citations
  cleaned = cleaned.replace(/([.!?])\s*(?:From\s+result|\([A-Z][^)]+\):)[^.!?]*/gi, '$1');

  // Remove broken sentence fragments that start with citations
  cleaned = cleaned.replace(/(?:From\s+result|\([A-Z][^)]+\):)\s*[^.!?]{0,20}(?=\s|$)/gi, '');

  // Remove incomplete thoughts that are clearly garbled
  cleaned = cleaned.replace(/\s+(?:reigned|Middle|East|Eye|Countercurrents|result)[^.!?]{0,30}(?=\s|$)/gi, '');

  // Remove patterns like "text (Source): more text" where citation breaks the flow
  // But preserve valid parentheses content - only remove obvious citation patterns (long source names)
  cleaned = cleaned.replace(/([a-z])\s*\([A-Z][a-zA-Z\s]{5,}\)\s*:\s*([a-z])/gi, '$1 $2');

  // Clean up incomplete sentences at the end
  // But be careful not to remove valid content - only remove clearly incomplete endings
  // Skip this for markdown content as it might have intentional structure
  // Check for markdown again here (in case it wasn't detected at start but appears later)
  const stillHasMarkdown = /^#{1,6}\s+|^\*\s+|^-\s+|^\d+\.\s+|^\*\*[^*]+\*\*|^`[^`]+`/m.test(cleaned);
  if (!stillHasMarkdown) {
    cleaned = cleanIncompleteSentences(cleaned);
  }

  // Improve readability by enforcing line breaks before lists and numbered points
  cleaned = cleaned
    // Insert newline before numbered lists that start mid-line
    .replace(/([^\n])(\s*\d+\.\s)/g, '$1\n$2')
    // Insert newline before bullet lists (-, *, •) that start mid-line
    .replace(/([^\n])(\s*[-*•]\s)/g, '$1\n$2')
    // Insert newline before section headers like "History:-" or "Economy:-"
    .replace(/([^\n])([A-Za-z][A-Za-z &/]{2,40}:-)/g, '$1\n$2')
    // Ensure colon followed immediately by a dash starts a list on a new line
    .replace(/:\s*-\s*/g, ':\n- ')
    // Ensure colon followed by numbered list moves to new line
    .replace(/:\s*(?=\d+\.)/g, ':\n');

  // Remove trailing punctuation issues
  cleaned = cleaned.replace(/[.,;:]\s*\.+$/g, '.');
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');

  // Check for markdown formatting again (may have been added or revealed after cleaning)
  const finalHasMarkdown = /^#{1,6}\s+|^\*\s+|^-\s+|^\d+\.\s+|^\*\*[^*]+\*\*|^`[^`]+`/m.test(cleaned) || hasMarkdown;

  // Remove duplicate sentences (common in garbled responses)
  // But skip for markdown as it might have intentional repetition (like list items)
  if (!finalHasMarkdown) {
    cleaned = removeDuplicateSentences(cleaned);
  }

  // Ensure proper sentence endings
  // Skip for markdown as headers and lists don't need sentence endings
  if (!finalHasMarkdown) {
    cleaned = ensureProperEnding(cleaned);
  }

  // Final cleanup - normalize whitespace but preserve markdown structure
  cleaned = cleaned.trim();

  // For markdown content, preserve structure but reduce excessive spacing
  if (finalHasMarkdown) {
    // Only normalize spaces/tabs within lines
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // Reduce excessive blank lines (3+ to 2) to preserve markdown structure
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
  }

  // For non-markdown content, normalize whitespace
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Normalize spaces/tabs within lines
  // Reduce excessive blank lines (3+ to 2) for paragraph breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned;
}

/**
 * Remove duplicate sentences from response
 * @param {string} text - Text to clean
 * @returns {string} - Text with duplicates removed
 */
function removeDuplicateSentences(text) {
  if (!text || text.length < 50) {
    return text;
  }

  // Split into sentences while preserving punctuation
  const parts = text.split(/([.!?]\s+)/);
  const seen = new Set();
  const unique = [];

  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i]?.trim();
    const punctuation = parts[i + 1] || '';

    if (!sentence || sentence.length < 10) {
      if (sentence) unique.push(sentence + punctuation);
      continue;
    }

    // Normalize for comparison (remove extra spaces, lowercase)
    const normalized = sentence.toLowerCase().replace(/\s+/g, ' ').substring(0, 100);

    // Skip if we've seen this sentence before (allowing for minor variations)
    if (normalized.length > 20 && seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(sentence + punctuation);
  }

  return unique.join('').trim();
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

  let trimmed = text.trim();

  // Remove incomplete fragments at the end
  // Pattern: incomplete words, trailing conjunctions, prepositions, etc.
  const incompleteEndPatterns = [
    /\s+(?:and|or|but|so|because|since|although|however|therefore|moreover|furthermore|additionally|consequently|meanwhile|otherwise|nevertheless|nonetheless)\s*$/i,
    /\s+(?:the|a|an|this|that|these|those|is|are|was|were|be|been|being|to|from|with|for|at|in|on|by|about|through|during|while)\s*$/i,
    /\s*[,\-:;]\s*$/, // Trailing punctuation without sentence end
    /\s+(?:requirements?|structure?|response?|answer?|following|as follows|note|please note|keep in mind|remember that|it's important to note)[:.]?\s*$/i,
    /\s+(?:I|I'?m|I am)\s+(?:can|will|would|should|must|need to|have to|want to|going to|here|available|sorry|apologize|regret|unable|cannot)\s*$/i,
    /\s+(?:Let\s+me|Please|Note|Keep|Remember|It's|This|That|These|Those|As|For|With|By|From|To|In|On|At|About|Through|During|While|Because|Since|Although|However|Therefore|Moreover|Furthermore|Additionally|Consequently|Meanwhile|Otherwise|Nevertheless|Nonetheless)\s*$/i,
  ];

  // Remove incomplete endings
  for (const pattern of incompleteEndPatterns) {
    if (pattern.test(trimmed)) {
      // Find the last complete sentence
      const lastCompleteMatch = trimmed.match(/^(.+[.!?])\s*$/);
      if (lastCompleteMatch && lastCompleteMatch[1].length > 30) {
        trimmed = lastCompleteMatch[1].trim();
      } else {
        // If no complete sentence found, find last sentence boundary
        const lastPeriod = trimmed.lastIndexOf('.');
        const lastQuestion = trimmed.lastIndexOf('?');
        const lastExclamation = trimmed.lastIndexOf('!');
        const lastPunctuation = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (lastPunctuation > 0 && lastPunctuation > trimmed.length * 0.5) {
          trimmed = trimmed.substring(0, lastPunctuation + 1).trim();
        } else if (trimmed.length > 20) {
          // If substantial content but no punctuation, remove incomplete ending and add period
          // Remove the incomplete ending pattern
          trimmed = trimmed.replace(pattern, '').trim();
          // Ensure it ends with proper punctuation
          if (!/[.!?]$/.test(trimmed)) {
            trimmed += '.';
          }
        } else {
          // Too short and incomplete, return empty
          return '';
        }
      }
    }
  }

  // Check if text ends with incomplete pattern (no punctuation)
  if (!/[.!?]$/.test(trimmed)) {
    // Check if it ends with incomplete word or phrase
    const endsIncomplete = incompleteEndPatterns.some(pattern => pattern.test(trimmed));

    if (endsIncomplete && trimmed.length > 50) {
      // Find last complete sentence
      const lastComplete = trimmed.match(/^(.+[.!?])\s+/);
      if (lastComplete && lastComplete[1].length > 50) {
        return lastComplete[1].trim();
      }
      // If no complete sentence but substantial content, add period
      return trimmed.trim() + '.';
    } else if (endsIncomplete && trimmed.length <= 50) {
      // Too short and incomplete
      return '';
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

function ensureMarkdownSpacing(text) {
  if (!text) return '';
  let formatted = text.replace(/\r\n/g, '\n');

  // Markdown requires blank lines between sections, but we should reduce excessive spacing
  // First, reduce excessive spacing (3+ newlines to 2) to normalize
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // Ensure at least a single newline after headings/bold (already handled by content flow)
  // But don't force double newlines if user wants it compact
  formatted = formatted.replace(
    /((?:\*\*[^\n]+\*\*)|(?:#{1,6}\s+[^\n]+))\n(?!\n|[-*•]\s|\d+\.\s)/g,
    '$1\n'
  );

  // Ensure blank line before new major sections ONLY if totally missing
  formatted = formatted.replace(
    /([^\n])(?=(?:\*\*[^\n]+\*\*|#{1,6}\s+[^\n]+))/g,
    '$1\n'
  );

  // Ensure at least a single newline before bullet lists
  formatted = formatted.replace(/([^\n])(?=(?:[-*•]\s))/g, '$1\n');

  // Final pass: reduce any remaining excessive spacing (3+ newlines to 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted;
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
  // Increased threshold from 0.3 to 0.4
  if (punctuationRatio > 0.4) {
    return true;
  }

  // Check for markdown - be very lenient with markdown structure
  const hasMarkdown = /^#{1,6}\s+|^\*\s+|^-\s+|^\d+\.\s+|^\*\*[^*]+\*\*|^`[^`]+`/m.test(cleaned);
  if (hasMarkdown) return false;

  // Check if response has too many incomplete sentences
  const incompleteCount = INCOMPLETE_PATTERNS.filter(pattern => pattern.test(cleaned)).length;
  // Be more lenient for normal text too
  if (incompleteCount > 4) {
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

  // Check minimum length first (before garbled check)
  // Be very lenient - allow shorter responses if they're complete
  // For very short minLength (5-10), be extremely lenient
  const effectiveMinLength = minLength <= 5 ? 3 : (minLength <= 10 ? 5 : Math.max(8, minLength - 5)); // Allow 5 chars below minimum if complete, or 3-5 for very short
  if (cleaned.length < effectiveMinLength) {
    return null;
  }

  // CRITICAL: Check for very short responses BEFORE the garbled check
  // This prevents isGarbledResponse() from rejecting them based on length alone
  // For extremely short responses (3-5 chars), accept if they look complete
  // This handles greetings like "Hi!" or "Hey!"
  if (cleaned.length >= 3 && cleaned.length <= 5 && minLength <= 5) {
    // Only check for actual garbled patterns, not length-based rejection
    const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(cleaned));
    // Accept if no garbled patterns (punctuation optional for very short responses like "Hi")
    if (!hasGarbledPatterns) {
      return cleaned;
    }
  }

  // For very short responses (3-20 chars), be extremely lenient if they look complete
  // This handles cases like "Hi!" (3 chars) or short answers
  if (cleaned.length >= 3 && cleaned.length < 20 && minLength <= 15) {
    // Only check for actual garbled patterns, not length-based rejection
    const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(cleaned));
    const looksComplete = /[.!?]$/.test(cleaned.trim()) &&
      !/\s+(?:and|or|but|the|a|to|from|with|for|I can|Let me)\s*$/i.test(cleaned) &&
      !hasGarbledPatterns;
    if (looksComplete) {
      return cleaned;
    }
  }

  // For shorter responses, check if they're complete (end with punctuation)
  // This allows simple questions to get shorter but complete answers
  if (cleaned.length < minLength && cleaned.length >= effectiveMinLength) {
    const endsWithPunctuation = /[.!?]$/.test(cleaned.trim());
    const hasNoIncompleteEnding = !/\s+(?:and|or|but|the|a|to|from|with|for|I can|Let me)\s*$/i.test(cleaned);
    if (endsWithPunctuation && hasNoIncompleteEnding) {
      return cleaned;
    }
  }

  // Check if response is garbled (but be less strict)
  // For PYQ responses, be even more lenient as they may have different formatting
  const isPyqResponse = /Previous\s+Year\s+Questions|PYQ|Year\s+\d{4}/i.test(cleaned);

  // For short responses (under 20 chars), only check for garbled patterns, not length
  // This prevents rejecting valid short responses, but still respect minLength parameter
  if (cleaned.length < 20) {
    // Only reject if it has actual garbled patterns
    const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(cleaned));
    if (hasGarbledPatterns) {
      return null;
    }
    // Accept short responses only if:
    // 1. minLength is explicitly low (<= 15), OR
    // 2. Response meets effectiveMinLength (already validated at line 443)
    // This respects the function's contract while avoiding isGarbledResponse() length rejection
    if (minLength <= 15 || cleaned.length >= effectiveMinLength) {
      return cleaned;
    }
    // If minLength is high and response doesn't meet it, fall through to normal validation
  } else if (isGarbledResponse(cleaned)) {
    // Check specifically for garbled patterns (not other isGarbledResponse reasons)
    const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(cleaned));

    // For PYQ responses, be more lenient - they may have list formatting
    // Check this BEFORE rejecting for non-pattern reasons
    if (isPyqResponse && cleaned.length > 100) {
      // Allow PYQ responses even if they have some garbled patterns or other issues
      return cleaned;
    }

    // Only be lenient for responses with garbled patterns, not for other issues
    // (excess punctuation, incomplete sentences, etc. should still be rejected)
    if (hasGarbledPatterns) {
      // For responses 20-100 chars, be more lenient - only reject if heavily garbled
      if (cleaned.length < 50) {
        // Check if it's heavily garbled (multiple patterns)
        const garbledPatternCount = GARBLED_PATTERNS.filter(pattern => pattern.test(cleaned)).length;
        if (garbledPatternCount > 1) {
          return null;
        }
        // If only one pattern, allow it if response is substantial
        if (cleaned.length >= 30) {
          return cleaned;
        }
        return null;
      }
    } else {
      // isGarbledResponse returned true for non-pattern reasons (excess punctuation, incomplete sentences, etc.)
      // These should be rejected regardless of length (unless it's a PYQ response, which we already checked)
      return null;
    }
    // For longer responses, check if it's actually garbled or just has some patterns
    // If it has substantial content, clean it more aggressively and return
    if (cleaned.length > 100) {
      // Try one more aggressive cleaning pass to remove any remaining garbled patterns
      let reCleaned = cleaned.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*/g, '');
      reCleaned = reCleaned.replace(/From\s+result[^.!?]*/gi, '');
      reCleaned = reCleaned.replace(/\s+\([A-Z][^)]+\):\s*/g, ' ');
      reCleaned = reCleaned.replace(/\s+(?:reigned|Middle|East|Eye|Countercurrents)[^.!?]{0,30}(?=\s|$)/gi, '');
      reCleaned = reCleaned.trim();
      // If still substantial after cleaning, return it
      if (reCleaned.length > 50) {
        return reCleaned;
      }
    }
  }

  return cleaned;
}

export { GARBLED_PATTERNS };

